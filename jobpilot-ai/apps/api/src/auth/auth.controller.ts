import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthUser, CurrentUser, Public } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { AuthService, LoginDto, RegisterDto } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post('register')
  register(@Body(new ZodPipe(RegisterDto)) dto: any) { return this.auth.register(dto); }

  @Public() @Post('login')
  login(@Body(new ZodPipe(LoginDto)) dto: any) { return this.auth.login(dto); }

  @Get('me')
  me(@CurrentUser() u: AuthUser) { return this.auth.me(u.id); }
}
