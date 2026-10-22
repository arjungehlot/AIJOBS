import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/auth';
import { ObjectIdPipe } from '../common/object-id.pipe';
import { ZodPipe } from '../common/zod.pipe';
import { AnalyzeImageDto, AnalyzeTextDto, CreateJobDto, JobsService, ListJobsQuery, MatchDto } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly svc: JobsService) {}

  @Get() list(@CurrentUser() u: AuthUser, @Query(new ZodPipe(ListJobsQuery)) q: any) { return this.svc.list(u.id, q); }
  @Post() create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(CreateJobDto)) dto: any) { return this.svc.create(u.id, dto); }
  @Post('analyze') analyze(@Body(new ZodPipe(AnalyzeTextDto)) dto: any) { return this.svc.analyzeText(dto); }
  @Post('analyze-screenshot') analyzeShot(@Body(new ZodPipe(AnalyzeImageDto)) dto: any) { return this.svc.analyzeImage(dto); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.get(u.id, id); }
  @Post(':id/match') match(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string, @Body(new ZodPipe(MatchDto)) dto: any) {
    return this.svc.match(u.id, id, dto);
  }
  @Post(':id/shortlist') shortlist(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.setShortlist(u.id, id, true); }
  @Post(':id/unshortlist') unshortlist(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.svc.setShortlist(u.id, id, false); }
}
