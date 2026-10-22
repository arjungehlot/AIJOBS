import {
  CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import jwt from 'jsonwebtoken';
import { env } from './env';

export interface AuthUser { id: string; role: 'user' | 'admin' }

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext): AuthUser =>
  ctx.switchToHttp().getRequest().user);

export function signToken(u: AuthUser): string {
  return jwt.sign({ sub: u.id, role: u.role }, env.authSecret, { expiresIn: '7d' });
}

/** Global guard: every route needs a valid Bearer token unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    const h: string | undefined = req.headers['authorization'];
    if (!h?.startsWith('Bearer ')) throw new UnauthorizedException();
    try {
      const p = jwt.verify(h.slice(7), env.authSecret) as jwt.JwtPayload;
      req.user = { id: String(p.sub), role: p.role === 'admin' ? 'admin' : 'user' } satisfies AuthUser;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
