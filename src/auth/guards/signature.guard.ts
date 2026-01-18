import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SignatureService } from '../services/signature.service';
import { SKIP_SIGNATURE_KEY } from '../decorators/skip-signature.decorator';

@Injectable()
export class SignatureGuard implements CanActivate {
  constructor(
    private readonly signatureService: SignatureService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if signature verification should be skipped
    const skipSignature = this.reflector.getAllAndOverride<boolean>(
      SKIP_SIGNATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipSignature) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Only verify signature for POST/PUT/PATCH requests with body
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return true;
    }

    const signature = request.headers['x-webhook-signature'] as string;

    if (!signature) {
      throw new ForbiddenException('Webhook signature is required');
    }

    // Get raw body for signature verification
    const rawBody = JSON.stringify(request.body);

    const isValid = this.signatureService.verify(rawBody, signature);

    if (!isValid) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    return true;
  }
}
