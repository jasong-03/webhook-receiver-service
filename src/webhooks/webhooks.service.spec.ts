import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { Webhook } from './entities/webhook.entity';
import { CreateWebhookDto } from './dto';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let repository: Repository<Webhook>;

  const mockWebhook: Webhook = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    source: 'stripe',
    event: 'payment.completed',
    payload: { orderId: '12345', amount: 100 },
    signature: 'test-signature',
    idempotencyKey: 'unique-key-001',
    receivedAt: new Date('2024-01-01T00:00:00Z'),
    status: 'pending',
  };

  const mockQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[mockWebhook], 1]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: getRepositoryToken(Webhook),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    repository = module.get<Repository<Webhook>>(getRepositoryToken(Webhook));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateWebhookDto = {
      source: 'stripe',
      event: 'payment.completed',
      payload: { orderId: '12345' },
    };

    it('should create a new webhook', async () => {
      jest.spyOn(repository, 'create').mockReturnValue(mockWebhook);
      jest.spyOn(repository, 'save').mockResolvedValue(mockWebhook);

      const result = await service.create(createDto, 'sig', 'key');

      expect(result.isNew).toBe(true);
      expect(result.webhook).toEqual(mockWebhook);
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });

    it('should generate UUID for new webhook', async () => {
      jest.spyOn(repository, 'create').mockImplementation((data) => data as Webhook);
      jest.spyOn(repository, 'save').mockImplementation(async (data) => data as Webhook);

      const result = await service.create(createDto);

      expect(result.webhook.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('should return existing webhook for duplicate idempotency key', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockWebhook);

      const result = await service.create(createDto, 'sig', 'existing-key');

      expect(result.isNew).toBe(false);
      expect(result.webhook).toEqual(mockWebhook);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should create new webhook when no idempotency key provided', async () => {
      jest.spyOn(repository, 'create').mockReturnValue(mockWebhook);
      jest.spyOn(repository, 'save').mockResolvedValue(mockWebhook);

      const result = await service.create(createDto);

      expect(result.isNew).toBe(true);
      expect(repository.findOne).not.toHaveBeenCalled();
    });

    it('should set default status to pending', async () => {
      jest.spyOn(repository, 'create').mockImplementation((data) => data as Webhook);
      jest.spyOn(repository, 'save').mockImplementation(async (data) => data as Webhook);

      const result = await service.create(createDto);

      expect(result.webhook.status).toBe('pending');
    });

    it('should store signature when provided', async () => {
      jest.spyOn(repository, 'create').mockImplementation((data) => data as Webhook);
      jest.spyOn(repository, 'save').mockImplementation(async (data) => data as Webhook);

      const result = await service.create(createDto, 'my-signature');

      expect(result.webhook.signature).toBe('my-signature');
    });
  });

  describe('findAll', () => {
    it('should return paginated webhooks', async () => {
      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter by source when provided', async () => {
      await service.findAll({ page: 1, limit: 20, source: 'stripe' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'webhook.source = :source',
        { source: 'stripe' },
      );
    });

    it('should filter by event when provided', async () => {
      await service.findAll({ page: 1, limit: 20, event: 'payment.completed' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'webhook.event = :event',
        { event: 'payment.completed' },
      );
    });

    it('should calculate correct offset for pagination', async () => {
      await service.findAll({ page: 3, limit: 10 });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20); // (3-1) * 10
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should order by receivedAt descending', async () => {
      await service.findAll({ page: 1, limit: 20 });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('webhook.receivedAt', 'DESC');
    });

    it('should calculate totalPages correctly', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([[], 25]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(3); // ceil(25/10)
    });
  });

  describe('findOne', () => {
    it('should return webhook when found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockWebhook);

      const result = await service.findOne(mockWebhook.id);

      expect(result).toEqual(mockWebhook);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: mockWebhook.id } });
    });

    it('should throw NotFoundException when webhook not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        'Webhook with ID "non-existent-id" not found',
      );
    });
  });

  describe('count', () => {
    it('should return total count of webhooks', async () => {
      jest.spyOn(repository, 'count').mockResolvedValue(42);

      const result = await service.count();

      expect(result).toBe(42);
    });
  });
});
