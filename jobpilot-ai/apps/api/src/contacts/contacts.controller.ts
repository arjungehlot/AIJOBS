import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/auth';
import { ObjectIdPipe } from '../common/object-id.pipe';
import { ZodPipe } from '../common/zod.pipe';
import { ContactDto, ContactPatchDto, ContactQuery, ContactsService, SuppressDto } from './contacts.service';

@Controller()
export class ContactsController {
  constructor(private readonly svc: ContactsService) {}
  @Get('contacts') list(@CurrentUser() u: AuthUser, @Query(new ZodPipe(ContactQuery)) q: any) { return this.svc.list(u.id, q); }
  @Post('contacts') create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(ContactDto)) dto: any) { return this.svc.create(u.id, dto); }
  @Patch('contacts/:id') update(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string, @Body(new ZodPipe(ContactPatchDto)) dto: any) { return this.svc.update(u.id, id, dto); }
  @Post('contacts/:id/suppress') suppress(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string, @Body(new ZodPipe(SuppressDto)) dto: any) { return this.svc.setSuppressed(u.id, id, dto.suppressed); }
  @Delete('contacts/:id') remove(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.remove(u.id, id); }
  @Get('companies') companies(@CurrentUser() u: AuthUser) { return this.svc.companies(u.id); }
}
