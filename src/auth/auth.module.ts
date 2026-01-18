import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SignatureService } from './services/signature.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { SignatureGuard } from './guards/signature.guard';

@Module({
  imports: [ConfigModule],
  providers: [SignatureService, ApiKeyGuard, SignatureGuard],
  exports: [SignatureService, ApiKeyGuard, SignatureGuard],
})
export class AuthModule {}
