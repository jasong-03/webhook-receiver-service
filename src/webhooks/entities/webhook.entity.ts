import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type WebhookStatus = 'pending' | 'processed' | 'failed';

@Entity('webhooks')
export class Webhook {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ length: 100 })
  @Index()
  source: string;

  @Column({ length: 100 })
  @Index()
  event: string;

  @Column('simple-json')
  payload: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  signature: string | null;

  @Column({ type: 'text', nullable: true, unique: true })
  @Index()
  idempotencyKey: string | null;

  @CreateDateColumn()
  @Index()
  receivedAt: Date;

  @Column({ default: 'pending' })
  status: WebhookStatus;
}
