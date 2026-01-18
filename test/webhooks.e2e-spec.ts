import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Webhooks (e2e)', () => {
  let app: INestApplication;
  const apiKey = 'dev-api-key-12345';
  const webhookSecret = 'dev-webhook-secret-67890';

  const generateSignature = (payload: string): string => {
    return crypto
      .createHmac('sha256', webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/webhooks', () => {
    const validPayload = {
      source: 'stripe',
      event: 'payment.completed',
      payload: { orderId: '12345', amount: 100 },
    };

    it('should reject request without API key', () => {
      const payloadStr = JSON.stringify(validPayload);
      const signature = generateSignature(payloadStr);

      return request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('X-Webhook-Signature', signature)
        .send(validPayload)
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('API key is required');
        });
    });

    it('should reject request with invalid API key', () => {
      const payloadStr = JSON.stringify(validPayload);
      const signature = generateSignature(payloadStr);

      return request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('X-API-Key', 'invalid-key')
        .set('X-Webhook-Signature', signature)
        .send(validPayload)
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid API key');
        });
    });

    it('should reject request without signature', () => {
      return request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('X-API-Key', apiKey)
        .send(validPayload)
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toBe('Webhook signature is required');
        });
    });

    it('should reject request with invalid signature', () => {
      return request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('X-API-Key', apiKey)
        .set('X-Webhook-Signature', 'invalid-signature')
        .send(validPayload)
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid webhook signature');
        });
    });

    it('should create webhook with valid credentials', () => {
      const payloadStr = JSON.stringify(validPayload);
      const signature = generateSignature(payloadStr);

      return request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('X-API-Key', apiKey)
        .set('X-Webhook-Signature', signature)
        .send(validPayload)
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          );
          expect(res.body.message).toBe('Webhook received');
        });
    });

    it('should reject invalid payload - missing source', () => {
      const invalidPayload = {
        event: 'payment.completed',
        payload: { orderId: '12345' },
      };
      const payloadStr = JSON.stringify(invalidPayload);
      const signature = generateSignature(payloadStr);

      return request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('X-API-Key', apiKey)
        .set('X-Webhook-Signature', signature)
        .send(invalidPayload)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Validation failed');
          expect(res.body.errors).toContain('source should not be empty');
        });
    });

    it('should accept payload with empty object (some webhooks have no data)', () => {
      const validPayload = {
        source: 'stripe',
        event: 'ping',
        payload: {},
      };
      const payloadStr = JSON.stringify(validPayload);
      const signature = generateSignature(payloadStr);

      return request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('X-API-Key', apiKey)
        .set('X-Webhook-Signature', signature)
        .send(validPayload)
        .expect(201);
    });

    it('should handle idempotency - return same ID for same key', async () => {
      const idempotencyKey = `test-idemp-${Date.now()}`;
      const payloadStr = JSON.stringify(validPayload);
      const signature = generateSignature(payloadStr);

      const response1 = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('X-API-Key', apiKey)
        .set('X-Webhook-Signature', signature)
        .set('X-Idempotency-Key', idempotencyKey)
        .send(validPayload)
        .expect(201);

      const response2 = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('X-API-Key', apiKey)
        .set('X-Webhook-Signature', signature)
        .set('X-Idempotency-Key', idempotencyKey)
        .send(validPayload)
        .expect(201);

      expect(response1.body.id).toBe(response2.body.id);
    });
  });

  describe('GET /api/v1/webhooks', () => {
    it('should reject request without API key', () => {
      return request(app.getHttpServer())
        .get('/api/v1/webhooks')
        .expect(401);
    });

    it('should return paginated webhooks', () => {
      return request(app.getHttpServer())
        .get('/api/v1/webhooks')
        .set('X-API-Key', apiKey)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.meta).toHaveProperty('total');
          expect(res.body.meta).toHaveProperty('page');
          expect(res.body.meta).toHaveProperty('limit');
          expect(res.body.meta).toHaveProperty('totalPages');
        });
    });

    it('should support pagination parameters', () => {
      return request(app.getHttpServer())
        .get('/api/v1/webhooks?page=1&limit=5')
        .set('X-API-Key', apiKey)
        .expect(200)
        .expect((res) => {
          expect(res.body.meta.page).toBe(1);
          expect(res.body.meta.limit).toBe(5);
        });
    });

    it('should support filter by source', () => {
      return request(app.getHttpServer())
        .get('/api/v1/webhooks?source=stripe')
        .set('X-API-Key', apiKey)
        .expect(200);
    });
  });

  describe('GET /api/v1/webhooks/:id', () => {
    it('should reject request without API key', () => {
      return request(app.getHttpServer())
        .get('/api/v1/webhooks/123e4567-e89b-12d3-a456-426614174000')
        .expect(401);
    });

    it('should return 404 for non-existent webhook', () => {
      return request(app.getHttpServer())
        .get('/api/v1/webhooks/123e4567-e89b-12d3-a456-426614174000')
        .set('X-API-Key', apiKey)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('not found');
        });
    });

    it('should return 400 for invalid UUID', () => {
      return request(app.getHttpServer())
        .get('/api/v1/webhooks/invalid-uuid')
        .set('X-API-Key', apiKey)
        .expect(400);
    });

    it('should return webhook by ID', async () => {
      // First create a webhook
      const payload = {
        source: 'test',
        event: 'test.event',
        payload: { data: 'test' },
      };
      const payloadStr = JSON.stringify(payload);
      const signature = generateSignature(payloadStr);

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('X-API-Key', apiKey)
        .set('X-Webhook-Signature', signature)
        .send(payload)
        .expect(201);

      const webhookId = createResponse.body.id;

      // Then retrieve it
      return request(app.getHttpServer())
        .get(`/api/v1/webhooks/${webhookId}`)
        .set('X-API-Key', apiKey)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(webhookId);
          expect(res.body.source).toBe('test');
          expect(res.body.event).toBe('test.event');
        });
    });
  });

  describe('GET /api/health', () => {
    it('should return health status without authentication', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
        });
    });

    it('should return X-Request-ID header', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.headers['x-request-id']).toBeDefined();
        });
    });
  });
});
