import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SignatureService } from './signature.service';
import * as crypto from 'crypto';

describe('SignatureService', () => {
  let service: SignatureService;
  const webhookSecret = 'test-webhook-secret';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignatureService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(webhookSecret),
          },
        },
      ],
    }).compile();

    service = module.get<SignatureService>(SignatureService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generate', () => {
    it('should generate a valid HMAC-SHA256 signature', () => {
      const payload = '{"test":"data"}';
      const signature = service.generate(payload);

      // Verify it's a valid hex string
      expect(signature).toMatch(/^[a-f0-9]{64}$/);

      // Verify it matches expected HMAC
      const expected = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload, 'utf8')
        .digest('hex');
      expect(signature).toBe(expected);
    });

    it('should generate different signatures for different payloads', () => {
      const signature1 = service.generate('{"data":"one"}');
      const signature2 = service.generate('{"data":"two"}');

      expect(signature1).not.toBe(signature2);
    });

    it('should generate consistent signatures for same payload', () => {
      const payload = '{"consistent":"payload"}';
      const signature1 = service.generate(payload);
      const signature2 = service.generate(payload);

      expect(signature1).toBe(signature2);
    });
  });

  describe('verify', () => {
    it('should return true for valid signature', () => {
      const payload = '{"valid":"payload"}';
      const signature = service.generate(payload);

      expect(service.verify(payload, signature)).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const payload = '{"valid":"payload"}';
      const invalidSignature = 'invalid-signature-that-is-not-valid-hex';

      expect(service.verify(payload, invalidSignature)).toBe(false);
    });

    it('should return false for tampered payload', () => {
      const originalPayload = '{"original":"data"}';
      const tamperedPayload = '{"tampered":"data"}';
      const signature = service.generate(originalPayload);

      expect(service.verify(tamperedPayload, signature)).toBe(false);
    });

    it('should return false for empty signature', () => {
      const payload = '{"test":"data"}';

      expect(service.verify(payload, '')).toBe(false);
    });

    it('should return false for null signature', () => {
      const payload = '{"test":"data"}';

      expect(service.verify(payload, null as unknown as string)).toBe(false);
    });

    it('should return false for signature with wrong length', () => {
      const payload = '{"test":"data"}';
      const shortSignature = 'abc123';

      expect(service.verify(payload, shortSignature)).toBe(false);
    });
  });

  describe('verifyWithSecret', () => {
    it('should verify with custom secret', () => {
      const payload = '{"custom":"secret"}';
      const customSecret = 'my-custom-secret';
      const signature = crypto
        .createHmac('sha256', customSecret)
        .update(payload, 'utf8')
        .digest('hex');

      expect(service.verifyWithSecret(payload, signature, customSecret)).toBe(true);
    });

    it('should return false for wrong custom secret', () => {
      const payload = '{"custom":"secret"}';
      const correctSecret = 'correct-secret';
      const wrongSecret = 'wrong-secret';
      const signature = crypto
        .createHmac('sha256', correctSecret)
        .update(payload, 'utf8')
        .digest('hex');

      expect(service.verifyWithSecret(payload, signature, wrongSecret)).toBe(false);
    });

    it('should return false for empty secret', () => {
      const payload = '{"test":"data"}';
      const signature = 'some-signature';

      expect(service.verifyWithSecret(payload, signature, '')).toBe(false);
    });

    it('should return false for null secret', () => {
      const payload = '{"test":"data"}';
      const signature = 'some-signature';

      expect(service.verifyWithSecret(payload, signature, null as unknown as string)).toBe(false);
    });
  });
});
