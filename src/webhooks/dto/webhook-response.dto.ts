import { ApiProperty } from '@nestjs/swagger';
import { Webhook, WebhookStatus } from '../entities/webhook.entity';

export class WebhookResponseDto {
  @ApiProperty({ description: 'Webhook ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Webhook source' })
  source: string;

  @ApiProperty({ description: 'Event type' })
  event: string;

  @ApiProperty({ description: 'Webhook payload' })
  payload: Record<string, unknown>;

  @ApiProperty({ description: 'Timestamp when webhook was received' })
  receivedAt: Date;

  @ApiProperty({ description: 'Processing status', enum: ['pending', 'processed', 'failed'] })
  status: WebhookStatus;

  static fromEntity(webhook: Webhook): WebhookResponseDto {
    const dto = new WebhookResponseDto();
    dto.id = webhook.id;
    dto.source = webhook.source;
    dto.event = webhook.event;
    dto.payload = webhook.payload;
    dto.receivedAt = webhook.receivedAt;
    dto.status = webhook.status;
    return dto;
  }
}

export class PaginatedWebhooksResponseDto {
  @ApiProperty({ type: [WebhookResponseDto], description: 'List of webhooks' })
  data: WebhookResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    example: { total: 150, page: 1, limit: 20, totalPages: 8 },
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class CreateWebhookResponseDto {
  @ApiProperty({ description: 'Created webhook ID' })
  id: string;

  @ApiProperty({ description: 'Confirmation message' })
  message: string;
}
