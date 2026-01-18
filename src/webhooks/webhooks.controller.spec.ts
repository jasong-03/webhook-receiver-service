import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { SignatureService } from '../auth/services/signature.service';
import { SignatureGuard } from '../auth/guards/signature.guard';
import { Reflector } from '@nestjs/core';
import { CreateWebhookDto, QueryWebhookDto } from './dto';
import { Webhook } from './entities/webhook.entity';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let service: WebhooksService;

  const mockWebhook: Webhook = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    source: 'stripe',
    event: 'payment.completed',
    payload: { orderId: '12345', amount: 100 },
    signature: 'test-signature',
    idempotencyKey: null,
    receivedAt: new Date('2024-01-01T00:00:00Z'),
    status: 'pending',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: WebhooksService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: SignatureService,
          useValue: {
            verify: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn().mockReturnValue(false),
          },
        },
        SignatureGuard,
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    service = module.get<WebhooksService>(WebhooksService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateWebhookDto = {
      source: 'stripe',
      event: 'payment.completed',
      payload: { orderId: '12345' },
    };

    it('should create a new webhook', async () => {
      jest.spyOn(service, 'create').mockResolvedValue({
        webhook: mockWebhook,
        isNew: true,
      });

      const result = await controller.create(createDto, 'signature', 'idempotency-key');

      expect(result.id).toBe(mockWebhook.id);
      expect(result.message).toBe('Webhook received');
      expect(service.create).toHaveBeenCalledWith(createDto, 'signature', 'idempotency-key');
    });

    it('should return idempotent message for duplicate webhook', async () => {
      jest.spyOn(service, 'create').mockResolvedValue({
        webhook: mockWebhook,
        isNew: false,
      });

      const result = await controller.create(createDto, 'signature', 'existing-key');

      expect(result.message).toBe('Webhook already processed (idempotent)');
    });

    it('should pass signature to service', async () => {
      jest.spyOn(service, 'create').mockResolvedValue({
        webhook: mockWebhook,
        isNew: true,
      });

      await controller.create(createDto, 'my-signature');

      expect(service.create).toHaveBeenCalledWith(createDto, 'my-signature', undefined);
    });

    it('should handle undefined headers', async () => {
      jest.spyOn(service, 'create').mockResolvedValue({
        webhook: mockWebhook,
        isNew: true,
      });

      await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto, undefined, undefined);
    });
  });

  describe('findAll', () => {
    it('should return paginated webhooks', async () => {
      const paginatedResult = {
        data: [
          {
            id: mockWebhook.id,
            source: mockWebhook.source,
            event: mockWebhook.event,
            payload: mockWebhook.payload,
            receivedAt: mockWebhook.receivedAt,
            status: mockWebhook.status,
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };

      jest.spyOn(service, 'findAll').mockResolvedValue(paginatedResult);

      const query: QueryWebhookDto = { page: 1, limit: 20 };
      const result = await controller.findAll(query);

      expect(result).toEqual(paginatedResult);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should pass filter parameters to service', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      const query: QueryWebhookDto = {
        page: 2,
        limit: 10,
        source: 'github',
        event: 'push',
      };

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return a single webhook', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockWebhook);

      const result = await controller.findOne(mockWebhook.id);

      expect(result.id).toBe(mockWebhook.id);
      expect(result.source).toBe(mockWebhook.source);
      expect(result.event).toBe(mockWebhook.event);
      expect(service.findOne).toHaveBeenCalledWith(mockWebhook.id);
    });

    it('should map webhook entity to response DTO', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockWebhook);

      const result = await controller.findOne(mockWebhook.id);

      // Verify response doesn't include internal fields like signature
      expect(result).not.toHaveProperty('signature');
      expect(result).not.toHaveProperty('idempotencyKey');
    });
  });
});
