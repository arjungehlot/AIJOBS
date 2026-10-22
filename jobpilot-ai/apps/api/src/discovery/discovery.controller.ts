import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { DiscoverDto, DiscoveryService } from './discovery.service';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly svc: DiscoveryService) {}
  @Get('sources') sources() { return this.svc.sources(); }
  @Post('search') search(@CurrentUser() u: AuthUser, @Body(new ZodPipe(DiscoverDto)) dto: any) { return this.svc.search(u.id, dto); }
}
