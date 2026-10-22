import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, SuperAdmin } from '../common/auth';
import { ObjectIdPipe } from '../common/object-id.pipe';
import { ZodPipe } from '../common/zod.pipe';
import { AdminService, AuditQuery, UserListQuery, UserPatchDto } from './admin.service';

@SuperAdmin()
@Controller('admin')
export class AdminController {
  constructor(private readonly svc: AdminService) {}
  @Get('overview') overview() { return this.svc.overview(); }
  @Get('users') users(@Query(new ZodPipe(UserListQuery)) q: any) { return this.svc.listUsers(q); }
  @Patch('users/:id') update(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string, @Body(new ZodPipe(UserPatchDto)) dto: any) { return this.svc.updateUser(u.id, id, dto); }
  @Get('audit') audit(@Query(new ZodPipe(AuditQuery)) q: any) { return this.svc.auditLog(q); }
  @Get('system') system() { return this.svc.system(); }
}
