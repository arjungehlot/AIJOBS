import { Body, Controller, Delete, Get, Patch, Post, Put } from '@nestjs/common';
import { AuthUser, CurrentUser, Public } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { GmailService } from '../mail/gmail.service';
import { AuthService, AvatarDto, LoginDto, ProfileDto, RegisterDto } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly gmail: GmailService) {}

  /** Start of "Continue with Google". Returns the Google URL; the web app navigates to it. */
  @Public() @Get('google/start')
  googleStart() { return { url: this.gmail.loginUrl() }; }

  @Public() @Post('register')
  register(@Body(new ZodPipe(RegisterDto)) dto: any) { return this.auth.register(dto); }

  @Public() @Post('login')
  login(@Body(new ZodPipe(LoginDto)) dto: any) { return this.auth.login(dto); }

  @Get('me')
  me(@CurrentUser() u: AuthUser) { return this.auth.me(u.id); }

  @Patch('profile')
  profile(@CurrentUser() u: AuthUser, @Body(new ZodPipe(ProfileDto)) dto: any) { return this.auth.updateProfile(u.id, dto); }

  @Put('avatar')
  setAvatar(@CurrentUser() u: AuthUser, @Body(new ZodPipe(AvatarDto)) dto: any) { return this.auth.setAvatar(u.id, dto); }

  @Delete('avatar')
  removeAvatar(@CurrentUser() u: AuthUser) { return this.auth.removeAvatar(u.id); }
}
