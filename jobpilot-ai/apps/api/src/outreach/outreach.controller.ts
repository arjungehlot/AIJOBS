import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/auth';
import { ObjectIdPipe } from '../common/object-id.pipe';
import { ZodPipe } from '../common/zod.pipe';
import { CampaignDto, DraftDto, EnhanceDto, ImageDto, OutreachService, ParseDto, PreviewDto } from './outreach.service';

@Controller('outreach')
export class OutreachController {
  constructor(private readonly svc: OutreachService) {}
  @Get('limits') limits(@CurrentUser() u: AuthUser) { return this.svc.limits(u.id); }
  @Post('parse') parse(@CurrentUser() u: AuthUser, @Body(new ZodPipe(ParseDto)) d: any) { return this.svc.parse(u.id, d.text); }
  @Post('from-image') fromImage(@CurrentUser() u: AuthUser, @Body(new ZodPipe(ImageDto)) d: any) { return this.svc.fromImage(u.id, d); }
  @Post('enhance') enhance(@CurrentUser() u: AuthUser, @Body(new ZodPipe(EnhanceDto)) d: any) { return this.svc.enhance(u.id, d); }
  @Post('draft') draft(@CurrentUser() u: AuthUser, @Body(new ZodPipe(DraftDto)) d: any) { return this.svc.draft(u.id, d); }
  @Post('preview') preview(@CurrentUser() u: AuthUser, @Body(new ZodPipe(PreviewDto)) d: any) { return this.svc.preview(u.id, d); }
  @Get('campaigns') list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }
  @Post('campaigns') create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(CampaignDto)) d: any) { return this.svc.create(u.id, d); }
  @Get('campaigns/:id') detail(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.detail(u.id, id); }
  @Post('campaigns/:id/start') start(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.start(u.id, id); }
  @Post('campaigns/:id/pause') pause(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.pause(u.id, id); }
  @Post('campaigns/:id/cancel') cancel(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.cancel(u.id, id); }
  @Post('campaigns/:id/retry') retry(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.retryFailed(u.id, id); }
}
