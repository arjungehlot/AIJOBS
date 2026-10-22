import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/auth';
import { ObjectIdPipe } from '../common/object-id.pipe';
import { ZodPipe } from '../common/zod.pipe';
import { ImportDto, InboxService, LinkDto } from './inbox.service';

@Controller('inbox')
export class InboxController {
  constructor(private readonly svc: InboxService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }
  @Post() import(@CurrentUser() u: AuthUser, @Body(new ZodPipe(ImportDto)) dto: any) { return this.svc.import(u.id, dto); }
  @Post(':id/link') link(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string, @Body(new ZodPipe(LinkDto)) dto: any) { return this.svc.link(u.id, id, dto.applicationId); }
  @Post(':id/apply') apply(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.applySuggestion(u.id, id); }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.remove(u.id, id); }
}
