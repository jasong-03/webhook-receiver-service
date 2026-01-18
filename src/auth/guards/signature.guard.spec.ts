import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SignatureGuard } from './signature.guard';
import { SignatureService } from '../services/signature.service';
import { SKIP_SIGNATURE_KEY } from '../decorators/skip-signature.decorator';

describe('SignatureGuard', () => {
  let guard: SignatureGuard;
  let signatureService: SignatureService;
  let reflector: Reflector;

  const mockExecutionContext = (
    method: string,
    body: object,
    signature?: string,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          body,
          headers: signature ? { 'x-webhook-signature': signature } : {},
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignatureGuard,
        {
          provide: SignatureService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn().mockReturnValue(false),
          },
        },
      ],
    }).compile();

    guard = module.get<SignatureGuard>(SignatureGuard);
    signatureService = module.get<SignatureService>(SignatureService);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow GET requests without signature', () => {
      const context = mockExecutionContext('GET', {});

      expect(guard.canActivate(context)).toBe(true);
      expect(signatureService.verify).not.toHaveBeenCalled();
    });

    it('should allow DELETE requests without signature', () => {
      const context = mockExecutionContext('DELETE', {});

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should require signature for POST requests', () => {
      const context = mockExecutionContext('POST', { data: 'test' });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Webhook signature is required');
    });

    it('should require signature for PUT requests', () => {
      const context = mockExecutionContext('PUT', { data: 'test' });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should require signature for PATCH requests', () => {
      const context = mockExecutionContext('PATCH', { data: 'test' });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should allow POST with valid signature', () => {
      jest.spyOn(signatureService, 'verify').mockReturnValue(true);
      const body = { data: 'test' };
      const context = mockExecutionContext('POST', body, 'valid-signature');

      expect(guard.canActivate(context)).toBe(true);
      expect(signatureService.verify).toHaveBeenCalledWith(
        JSON.stringify(body),
        'valid-signature',
      );
    });

    it('should deny POST with invalid signature', () => {
      jest.spyOn(signatureService, 'verify').mockReturnValue(false);
      const body = { data: 'test' };
      const context = mockExecutionContext('POST', body, 'invalid-signature');

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Invalid webhook signature');
    });

    it('should skip signature verification when decorated with SkipSignature', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      const context = mockExecutionContext('POST', { data: 'test' });

      expect(guard.canActivate(context)).toBe(true);
      expect(signatureService.verify).not.toHaveBeenCalled();
    });

    it('should check SKIP_SIGNATURE_KEY metadata', () => {
      jest.spyOn(signatureService, 'verify').mockReturnValue(true);
      const context = mockExecutionContext('POST', {}, 'signature');
      guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(SKIP_SIGNATURE_KEY, [
        expect.anything(),
        expect.anything(),
      ]);
    });
  });
});
