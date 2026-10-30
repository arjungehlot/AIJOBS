import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/auth';
import { ObjectIdPipe } from '../common/object-id.pipe';
import { ZodPipe } from '../common/zod.pipe';
import { EnhanceResumeDto, JobRefDto, ResumeDto, ResumeUploadDto, ResumesService } from './resumes.service';

@Controller('resumes')
export class ResumesController {
  constructor(private readonly svc: ResumesService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }
  @Post() create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(ResumeDto)) dto: any) { return this.svc.create(u.id, dto); }
  @Post('enhance') enhance(@CurrentUser() u: AuthUser, @Body(new ZodPipe(EnhanceResumeDto)) dto: any) { return this.svc.enhance(u.id, dto); }
  @Post('upload') upload(@CurrentUser() u: AuthUser, @Body(new ZodPipe(ResumeUploadDto)) dto: any) { return this.svc.upload(u.id, dto); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.get(u.id, id); }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.remove(u.id, id); }
  @Post(':id/analyze') analyze(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string, @Body(new ZodPipe(JobRefDto)) dto: any) { return this.svc.analyze(u.id, id, dto.jobId); }
  @Post(':id/tailor') tailor(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string, @Body(new ZodPipe(JobRefDto)) dto: any) { return this.svc.tailor(u.id, id, dto.jobId); }
}
