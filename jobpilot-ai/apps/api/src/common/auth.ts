import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, createParamDecorator,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';
import { Reflector } from '@nestjs/core';
import jwt from 'jsonwebtoken';
import { env } from './env';

export type Role = 'user' | 'admin' | 'super_admin';
export interface AuthUser { id: string; role: Role }

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const SUPER_ADMIN_ONLY = 'superAdminOnly';
/** Route (or controller) is only for the super admin. The role is read from the database, not the token. */
export const SuperAdmin = () => SetMetadata(SUPER_ADMIN_ONLY, true);

// Short cache so every request does not hit the database. Admin changes clear it immediately.
const cache = new Map<string, { role: Role; status: string; exp: number }>();
export const invalidateAuthCache = (id?: string) => (id ? cache.delete(id) : cache.clear());

export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext): AuthUser =>
  ctx.switchToHttp().getRequest().user);

export function signToken(u: AuthUser): string {
  return jwt.sign({ sub: u.id, role: u.role }, env.authSecret, { expiresIn: '7d' });
}

/** Global guard: every route needs a valid Bearer token unless marked @Public(). Role and suspension come from the database. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, @InjectModel(User.name) private readonly users: Model<User>) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const req = ctx.switchToHttp().getRequest();
    const h: string | undefined = req.headers['authorization'];
    if (!h?.startsWith('Bearer ')) throw new UnauthorizedException();
    let id: string;
    try { id = String((jwt.verify(h.slice(7), env.authSecret) as jwt.JwtPayload).sub); } catch { throw new UnauthorizedException(); }

    let c = cache.get(id);
    if (!c || c.exp < Date.now()) {
      const u = await this.users.findById(id).select('role status').lean();
      if (!u) throw new UnauthorizedException();
      c = { role: u.role as Role, status: u.status ?? 'active', exp: Date.now() + 15_000 };
      cache.set(id, c);
    }
    if (c.status === 'suspended') throw new ForbiddenException('This account is suspended');
    req.user = { id, role: c.role } satisfies AuthUser;
    if (this.reflector.getAllAndOverride<boolean>(SUPER_ADMIN_ONLY, targets) && c.role !== 'super_admin') throw new ForbiddenException('Super admin only');
    return true;
  }
}
