import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
  ApiSecurity,
} from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import {
  CreateWebhookDto,
  QueryWebhookDto,
  WebhookResponseDto,
  PaginatedWebhooksResponseDto,
  CreateWebhookResponseDto,
} from './dto';
import { SignatureGuard } from '../auth/guards/signature.guard';

@ApiTags('webhooks')
@ApiSecurity('api-key')
@Controller({
  path: 'webhooks',
  version: '1',
})
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @UseGuards(SignatureGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Receive a new webhook' })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API key for authentication',
    required: true,
  })
  @ApiHeader({
    name: 'X-Webhook-Signature',
    description: 'HMAC-SHA256 signature of the payload',
    required: true,
  })
  @ApiHeader({
    name: 'X-Idempotency-Key',
    description: 'Unique key to prevent duplicate processing',
    required: false,
  })
  @ApiResponse({
    status: 201,
    description: 'Webhook received successfully',
    type: CreateWebhookResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing API key' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid webhook signature' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async create(
    @Body() createWebhookDto: CreateWebhookDto,
    @Headers('x-webhook-signature') signature?: string,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<CreateWebhookResponseDto> {
    const { webhook, isNew } = await this.webhooksService.create(
      createWebhookDto,
      signature,
      idempotencyKey,
    );

    return {
      id: webhook.id,
      message: isNew ? 'Webhook received' : 'Webhook already processed (idempotent)',
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all webhooks with pagination' })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API key for authentication',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'List of webhooks',
    type: PaginatedWebhooksResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Query() query: QueryWebhookDto,
  ): Promise<PaginatedWebhooksResponseDto> {
    return this.webhooksService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a webhook by ID' })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API key for authentication',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Webhook UUID' })
  @ApiResponse({
    status: 200,
    description: 'Webhook found',
    type: WebhookResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<WebhookResponseDto> {
    const webhook = await this.webhooksService.findOne(id);
    return WebhookResponseDto.fromEntity(webhook);
  }
}
