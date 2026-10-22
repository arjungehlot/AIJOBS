import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { AiSettingsService, SetModelDto } from './ai-settings.service';

@Controller('ai')
export class AiSettingsController {
  constructor(private readonly svc: AiSettingsService) {}
  @Get('settings') status(@CurrentUser() u: AuthUser, @Query('refresh') refresh?: string) { return this.svc.status(u.id, refresh === '1'); }
  @Put('settings') set(@CurrentUser() u: AuthUser, @Body(new ZodPipe(SetModelDto)) dto: any) { return this.svc.setModel(u.id, dto.model); }
  @Post('test') test(@CurrentUser() u: AuthUser) { return this.svc.test(u.id); }
}
