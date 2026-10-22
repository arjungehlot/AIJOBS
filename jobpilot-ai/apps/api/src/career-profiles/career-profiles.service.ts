import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { z } from 'zod';
import { User } from '../users/user.schema';
import { CareerProfile } from './career-profile.schema';

const list = z.array(z.string().trim().min(1).max(80)).max(100).default([]);
export const ProfileDto = z.object({
  name: z.string().trim().min(1).max(80),
  targetTitles: list, skills: list, workModes: z.array(z.enum(['remote', 'hybrid', 'onsite'])).default([]),
  locations: list, employmentTypes: list, excludedCompanies: list, excludedKeywords: list,
  yearsExperience: z.number().min(0).max(60).default(0),
  minSalary: z.number().min(0).optional(), currency: z.string().length(3).default('INR'),
  minMatchScore: z.number().min(0).max(100).default(70),
  maxDailyApplications: z.number().int().min(0).max(200).default(10),
});
export const ProfilePatchDto = ProfileDto.partial();

const PLAN_PROFILE_LIMIT: Record<string, number> = { free: 1, pro: 10, premium_agent: 10, teams: 50 };

@Injectable()
export class CareerProfilesService {
  constructor(
    @InjectModel(CareerProfile.name) private readonly model: Model<CareerProfile>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  list(userId: string) { return this.model.find({ userId }).sort({ createdAt: 1 }).lean(); }

  async get(userId: string, id: string) {
    const p = await this.model.findOne({ _id: id, userId }).lean();
    if (!p) throw new NotFoundException('Career profile not found');
    return p;
  }

  async create(userId: string, dto: z.infer<typeof ProfileDto>) {
    // Plan limits are enforced here on the server, never in the UI.
    const user = await this.users.findById(userId).lean();
    const limit = PLAN_PROFILE_LIMIT[user?.plan ?? 'free'] ?? 1;
    if ((await this.model.countDocuments({ userId })) >= limit) {
      throw new ForbiddenException(`Your plan allows ${limit} career profile${limit === 1 ? '' : 's'}`);
    }
    return this.model.create({ ...dto, userId });
  }

  async update(userId: string, id: string, dto: z.infer<typeof ProfilePatchDto>) {
    const p = await this.model.findOneAndUpdate({ _id: id, userId }, { $set: dto }, { new: true }).lean();
    if (!p) throw new NotFoundException('Career profile not found');
    return p;
  }

  async remove(userId: string, id: string) {
    const r = await this.model.deleteOne({ _id: id, userId });
    if (!r.deletedCount) throw new NotFoundException('Career profile not found');
    return { deleted: true };
  }
}
