import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/auth';
import { ObjectIdPipe } from '../common/object-id.pipe';
import { ZodPipe } from '../common/zod.pipe';
import { CareerProfilesService, ProfileDto, ProfilePatchDto } from './career-profiles.service';

@Controller('career-profiles')
export class CareerProfilesController {
  constructor(private readonly svc: CareerProfilesService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }
  @Post() create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(ProfileDto)) dto: any) { return this.svc.create(u.id, dto); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.get(u.id, id); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string, @Body(new ZodPipe(ProfilePatchDto)) dto: any) {
    return this.svc.update(u.id, id, dto);
  }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.remove(u.id, id); }
}
