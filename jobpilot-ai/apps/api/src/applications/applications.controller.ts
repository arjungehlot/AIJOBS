import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/auth';
import { ObjectIdPipe } from '../common/object-id.pipe';
import { ZodPipe } from '../common/zod.pipe';
import { ApplicationsService, ApproveDto, DraftDto, ListQuery, StatusDto } from './applications.service';

@Controller()
export class ApplicationsController {
  constructor(private readonly svc: ApplicationsService) {}

  @Get('overview') overview(@CurrentUser() u: AuthUser) { return this.svc.overview(u.id); }

  @Get('applications') list(@CurrentUser() u: AuthUser, @Query(new ZodPipe(ListQuery)) q: any) { return this.svc.list(u.id, q); }
  @Post('applications/drafts') draft(@CurrentUser() u: AuthUser, @Body(new ZodPipe(DraftDto)) dto: any) { return this.svc.createDraft(u.id, dto); }
  @Get('applications/:id') get(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.get(u.id, id); }
  @Post('applications/:id/approve') approve(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string, @Body(new ZodPipe(ApproveDto)) dto: any) { return this.svc.approve(u.id, id, dto); }
  @Post('applications/:id/send') send(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.send(u.id, id); }
  @Post('applications/:id/reconcile') reconcile(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.reconcile(u.id, id); }
  @Patch('applications/:id/status') status(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string, @Body(new ZodPipe(StatusDto)) dto: any) { return this.svc.setStatus(u.id, id, dto.status); }
  @Get('applications/:id/activity') activity(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.activity(u.id, id); }
}
