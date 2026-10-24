import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Public } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { DemoDto, DemoService } from './demo.service';

@Controller('demo')
export class DemoController {
  constructor(private readonly svc: DemoService) {}
  @Public() @Get('status') status() { return this.svc.status(); }
  @Public() @Post('analyze') analyze(@Req() req: any, @Body(new ZodPipe(DemoDto)) dto: { text: string }) {
    return this.svc.analyze(String(req.ip ?? req.socket?.remoteAddress ?? 'unknown'), dto.text);
  }
}
