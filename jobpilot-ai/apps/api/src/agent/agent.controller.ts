import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { AgentConfigDto, AgentService, RunDto } from './agent.service';

@Controller('agent')
export class AgentController {
  constructor(private readonly svc: AgentService) {}
  @Get() config(@CurrentUser() u: AuthUser) { return this.svc.getConfig(u.id); }
  @Put() update(@CurrentUser() u: AuthUser, @Body(new ZodPipe(AgentConfigDto)) dto: any) { return this.svc.update(u.id, dto); }
  @Post('pause') pause(@CurrentUser() u: AuthUser) { return this.svc.setPaused(u.id, true); }
  @Post('resume') resume(@CurrentUser() u: AuthUser) { return this.svc.setPaused(u.id, false); }
  @Post('stop') stop(@CurrentUser() u: AuthUser) { return this.svc.stop(u.id); }
  @Get('runs') runs(@CurrentUser() u: AuthUser) { return this.svc.runsList(u.id); }
  @Post('run') run(@CurrentUser() u: AuthUser, @Body(new ZodPipe(RunDto)) dto: any) { return this.svc.run(u.id, dto.dryRun); }
}
