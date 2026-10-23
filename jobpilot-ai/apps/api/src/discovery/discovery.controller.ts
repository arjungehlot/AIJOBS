import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { DiscoverDto, DiscoveryService } from './discovery.service';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly svc: DiscoveryService) {}
  @Get('sources') sources() { return this.svc.sources(); }
  @Get('countries') countries() { return this.svc.countries(); }
  @Get('links') links(@Query('q') q = '', @Query('days') days = '5', @Query('loc') loc = '') { return this.svc.externalLinks(q, Number(days) || 5, loc); }
  @Post('start') start(@CurrentUser() u: AuthUser, @Body(new ZodPipe(DiscoverDto)) dto: any) { return this.svc.start(u.id, dto); }
  @Get('status/:id') status(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('since') since?: string) { return this.svc.status(u.id, id, Math.max(0, Number(since) || 0)); }
  @Post('search') search(@CurrentUser() u: AuthUser, @Body(new ZodPipe(DiscoverDto)) dto: any) { return this.svc.search(u.id, dto); }
}
