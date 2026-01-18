import {
  IsString,
  IsNotEmpty,
  IsObject,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWebhookDto {
  @ApiProperty({
    description: 'Source of the webhook (e.g., stripe, github, shopify)',
    example: 'stripe',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  source: string;

  @ApiProperty({
    description: 'Event type (e.g., payment.completed, issue.created)',
    example: 'payment.completed',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  event: string;

  @ApiProperty({
    description: 'Webhook payload data',
    example: { orderId: '12345', amount: 100, currency: 'USD' },
  })
  @IsObject()
  @IsNotEmpty()
  payload: Record<string, unknown>;
}
