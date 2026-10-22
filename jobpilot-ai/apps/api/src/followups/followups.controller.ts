import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/auth';
import { ObjectIdPipe } from '../common/object-id.pipe';
import { ZodPipe } from '../common/zod.pipe';
import { CreateFollowUpDto, FollowUpsService, ListFollowUpsQuery } from './followups.service';

@Controller('followups')
export class FollowUpsController {
  constructor(private readonly svc: FollowUpsService) {}
  @Get() list(@CurrentUser() u: AuthUser, @Query(new ZodPipe(ListFollowUpsQuery)) q: any) { return this.svc.list(u.id, q.status); }
  @Post() create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(CreateFollowUpDto)) dto: any) { return this.svc.create(u.id, dto); }
  @Post(':id/done') done(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.complete(u.id, id); }
  @Post(':id/cancel') cancel(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.cancel(u.id, id); }
}
