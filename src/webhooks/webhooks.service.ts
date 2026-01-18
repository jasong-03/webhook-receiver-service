import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Webhook } from './entities/webhook.entity';
import {
  CreateWebhookDto,
  QueryWebhookDto,
  WebhookResponseDto,
  PaginatedWebhooksResponseDto,
} from './dto';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(Webhook)
    private readonly webhookRepository: Repository<Webhook>,
  ) {}

  async create(
    createWebhookDto: CreateWebhookDto,
    signature?: string,
    idempotencyKey?: string,
  ): Promise<{ webhook: Webhook; isNew: boolean }> {
    // Check idempotency - return existing webhook if key already used
    if (idempotencyKey) {
      const existing = await this.webhookRepository.findOne({
        where: { idempotencyKey },
      });

      if (existing) {
        return { webhook: existing, isNew: false };
      }
    }

    const webhook = this.webhookRepository.create({
      id: uuidv4(),
      source: createWebhookDto.source,
      event: createWebhookDto.event,
      payload: createWebhookDto.payload,
      signature: signature || null,
      idempotencyKey: idempotencyKey || null,
      status: 'pending',
    });

    const saved = await this.webhookRepository.save(webhook);
    return { webhook: saved, isNew: true };
  }

  async findAll(query: QueryWebhookDto): Promise<PaginatedWebhooksResponseDto> {
    const { page = 1, limit = 20, source, event } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.webhookRepository.createQueryBuilder('webhook');

    if (source) {
      queryBuilder.andWhere('webhook.source = :source', { source });
    }

    if (event) {
      queryBuilder.andWhere('webhook.event = :event', { event });
    }

    queryBuilder
      .orderBy('webhook.receivedAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [webhooks, total] = await queryBuilder.getManyAndCount();

    return {
      data: webhooks.map(WebhookResponseDto.fromEntity),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Webhook> {
    const webhook = await this.webhookRepository.findOne({ where: { id } });

    if (!webhook) {
      throw new NotFoundException(`Webhook with ID "${id}" not found`);
    }

    return webhook;
  }

  async count(): Promise<number> {
    return this.webhookRepository.count();
  }
}
