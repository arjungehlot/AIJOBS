import { Controller, Get } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/auth';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}
  /** One call with everything the Overview page shows. Read-only; every query is scoped to the signed-in user. */
  @Get() get(@CurrentUser() u: AuthUser) { return this.svc.build(u.id); }
}
