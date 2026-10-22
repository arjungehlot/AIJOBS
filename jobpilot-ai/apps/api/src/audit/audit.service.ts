import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Actor, AuditLog } from './audit.schema';

export interface AuditEntry {
  userId: string; actor: Actor; action: string; entityType: string; entityId: string;
  result: 'success' | 'failure' | 'blocked'; detail?: string; meta?: Record<string, unknown>;
}

/** Append-only. There is intentionally no update or delete method. */
@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private readonly model: Model<AuditLog>) {}

  record(e: AuditEntry) { return this.model.create(e); }

  countSince(userId: string, action: string, since: Date) { return this.model.countDocuments({ userId, action, createdAt: { $gte: since } }); }

  timeline(userId: string, entityType: string, entityId: string) {
    return this.model.find({ userId, entityType, entityId }).sort({ createdAt: -1 }).limit(200).lean();
  }
}
