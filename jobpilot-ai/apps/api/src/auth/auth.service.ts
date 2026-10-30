import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { z } from 'zod';
import { signToken } from '../common/auth';
import { User } from '../users/user.schema';

export const RegisterDto = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(200),
});
export const ProfileDto = z.object({ name: z.string().trim().min(1).max(120) });
export const AvatarDto = z.object({ image: z.string().max(200_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'Must be a JPEG, PNG or WebP image') });
export const LoginDto = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

@Injectable()
export class AuthService {
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  async register(dto: z.infer<typeof RegisterDto>) {
    if (await this.users.exists({ email: dto.email })) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    try {
      const u = await this.users.create({ name: dto.name, email: dto.email, passwordHash });
      return this.session(u);
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Email already registered');
      throw e;
    }
  }

  async login(dto: z.infer<typeof LoginDto>) {
    const u = await this.users.findOne({ email: dto.email });
    // Same error for unknown email and wrong password.
    if (!u || !(await bcrypt.compare(dto.password, u.passwordHash))) throw new UnauthorizedException('Invalid credentials');
    if (u.status === 'suspended') throw new ForbiddenException('This account is suspended. Contact support.');
    await this.users.updateOne({ _id: u._id }, { $set: { lastLoginAt: new Date() } });
    return this.session(u);
  }

  async me(id: string) {
    const u = await this.users.findById(id).lean();
    if (!u) throw new UnauthorizedException();
    return this.view(u);
  }

  private view(u: any) {
    return { id: String(u._id), name: u.name, email: u.email, plan: u.plan, role: u.role, image: u.avatar || u.picture || null, hasCustomImage: !!u.avatar };
  }

  async updateProfile(id: string, dto: z.infer<typeof ProfileDto>) {
    const u = await this.users.findByIdAndUpdate(id, { $set: { name: dto.name } }, { new: true }).lean();
    if (!u) throw new UnauthorizedException();
    return this.view(u);
  }

  async setAvatar(id: string, dto: z.infer<typeof AvatarDto>) {
    const u = await this.users.findByIdAndUpdate(id, { $set: { avatar: dto.image } }, { new: true }).lean();
    if (!u) throw new UnauthorizedException();
    return this.view(u);
  }

  async removeAvatar(id: string) {
    const u = await this.users.findByIdAndUpdate(id, { $unset: { avatar: '' } }, { new: true }).lean();
    if (!u) throw new UnauthorizedException();
    return this.view(u);
  }

  private session(u: any) {
    const user = { id: String(u._id), name: u.name, email: u.email, plan: u.plan, role: u.role };
    return { token: signToken({ id: user.id, role: u.role }), user };
  }
}
