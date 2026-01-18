import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './api-key.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let reflector: Reflector;
  const validApiKey = 'valid-api-key-12345';

  const mockExecutionContext = (apiKey?: string, isPublic = false): ExecutionContext => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: apiKey ? { 'x-api-key': apiKey } : {},
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;

    return mockContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(validApiKey),
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

    guard = module.get<ApiKeyGuard>(ApiKeyGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow access with valid API key', () => {
      const context = mockExecutionContext(validApiKey);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny access with invalid API key', () => {
      const context = mockExecutionContext('invalid-api-key');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid API key');
    });

    it('should deny access when API key is missing', () => {
      const context = mockExecutionContext();

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('API key is required');
    });

    it('should allow access to public routes without API key', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      const context = mockExecutionContext();

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should check IS_PUBLIC_KEY metadata', () => {
      const context = mockExecutionContext(validApiKey);
      guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        expect.anything(),
        expect.anything(),
      ]);
    });

    it('should deny access with empty API key', () => {
      const context = mockExecutionContext('');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });
});
