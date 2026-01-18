import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

interface CachedResponse {
  data: unknown;
  timestamp: number;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private readonly cache = new Map<string, CachedResponse>();
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    // Only apply to POST/PUT/PATCH methods
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return next.handle();
    }

    const idempotencyKey = request.headers['x-idempotency-key'] as string;

    // If no idempotency key, proceed normally
    if (!idempotencyKey) {
      return next.handle();
    }

    // Clean up expired cache entries periodically
    this.cleanExpiredEntries();

    // Check cache for existing response
    const cached = this.cache.get(idempotencyKey);
    if (cached) {
      this.logger.log(`Returning cached response for idempotency key: ${idempotencyKey}`);
      return of(cached.data);
    }

    // Process request and cache the response
    return next.handle().pipe(
      tap((data) => {
        this.cache.set(idempotencyKey, {
          data,
          timestamp: Date.now(),
        });
        this.logger.log(`Cached response for idempotency key: ${idempotencyKey}`);
      }),
    );
  }

  private cleanExpiredEntries(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.TTL) {
        this.cache.delete(key);
      }
    }
  }
}
