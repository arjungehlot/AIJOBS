import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { ObjectIdPipe } from '../common/object-id.pipe';
import { AiSettingsService, AttachmentUploadDto, DefaultsDto, SetModelDto, SignatureDto } from './ai-settings.service';

@Controller('ai')
export class AiSettingsController {
  constructor(private readonly svc: AiSettingsService) {}
  @Get('settings') status(@CurrentUser() u: AuthUser, @Query('refresh') refresh?: string) { return this.svc.status(u.id, refresh === '1'); }
  @Put('settings') set(@CurrentUser() u: AuthUser, @Body(new ZodPipe(SetModelDto)) dto: any) { return this.svc.setModel(u.id, dto.model); }
  @Get('signature') async signature(@CurrentUser() u: AuthUser) { return { signature: await this.svc.signatureFor(u.id) }; }
  @Put('signature') setSignature(@CurrentUser() u: AuthUser, @Body(new ZodPipe(SignatureDto)) dto: any) { return this.svc.setSignature(u.id, dto.signature); }
  @Get('defaults') defaults(@CurrentUser() u: AuthUser) { return this.svc.defaults(u.id); }
  @Put('defaults') setDefaults(@CurrentUser() u: AuthUser, @Body(new ZodPipe(DefaultsDto)) dto: any) { return this.svc.setDefaults(u.id, dto); }
  @Post('attachments') addAttachment(@CurrentUser() u: AuthUser, @Body(new ZodPipe(AttachmentUploadDto)) dto: any) { return this.svc.addAttachment(u.id, dto); }
  @Delete('attachments/:id') removeAttachment(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.removeAttachment(u.id, id); }
  @Post('test') test(@CurrentUser() u: AuthUser) { return this.svc.test(u.id); }
}
