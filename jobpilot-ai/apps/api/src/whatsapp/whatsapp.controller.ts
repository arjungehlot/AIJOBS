import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { SendJobDto, WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly svc: WhatsappService) {}
  @Get('status') status() { return this.svc.status(); }
  @Post('send-job') sendJob(@CurrentUser() u: AuthUser, @Body(new ZodPipe(SendJobDto)) d: any) { return this.svc.sendForJob(u.id, d); }
}
