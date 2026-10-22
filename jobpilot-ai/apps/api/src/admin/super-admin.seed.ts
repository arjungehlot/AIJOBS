import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { env } from '../common/env';
import { User } from '../users/user.schema';

/**
 * Creates the super admin from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD at startup.
 * The .env file is the source of truth: if the password there changes, the stored hash is updated.
 * Only the hash is stored. The plain password is never written to the database or logged.
 */
@Injectable()
export class SuperAdminSeed implements OnApplicationBootstrap {
  private readonly log = new Logger('SuperAdminSeed');
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  async onApplicationBootstrap() {
    const email = env.superAdminEmail, password = env.superAdminPassword;
    if (!email || !password) { this.log.warn('SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set. No super admin was created.'); return; }
    if (process.env.NODE_ENV === 'production' && password.length < 12) { this.log.error('SUPER_ADMIN_PASSWORD must be at least 12 characters in production. Skipping seed.'); return; }

    const existing = await this.users.findOne({ email });
    if (!existing) {
      await this.users.create({ email, name: env.superAdminName, passwordHash: await bcrypt.hash(password, 12), role: 'super_admin', plan: 'teams', status: 'active' });
      this.log.log(`Super admin created: ${email}`);
      return;
    }
    const set: Record<string, unknown> = {};
    if (existing.role !== 'super_admin') set.role = 'super_admin';
    if (existing.status !== 'active') set.status = 'active';
    if (!(await bcrypt.compare(password, existing.passwordHash))) set.passwordHash = await bcrypt.hash(password, 12);
    if (Object.keys(set).length) {
      await this.users.updateOne({ _id: existing._id }, { $set: set });
      this.log.log(`Super admin ${email} synced from .env (${Object.keys(set).map((k) => (k === 'passwordHash' ? 'password' : k)).join(', ')})`);
    } else this.log.log(`Super admin ready: ${email}`);
  }
}
