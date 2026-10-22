import { Controller, Get } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/auth';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}
  @Get() insights(@CurrentUser() u: AuthUser) { return this.svc.insights(u.id); }
}
