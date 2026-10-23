import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Public } from '../common/auth';
import { GmailService } from './gmail.service';

const ListQ = z.object({ folder: z.enum(['inbox', 'sent', 'all']).default('inbox'), q: z.string().max(200).optional(), pageToken: z.string().max(500).optional() });
const ComposeDto = z.object({ to: z.string().trim().max(320), subject: z.string().trim().min(1).max(300), body: z.string().trim().min(1).max(20000), threadId: z.string().regex(/^[a-f0-9]{8,32}$/i).optional() });
const TrackDto = z.object({ threadIds: z.array(z.string().regex(/^[a-f0-9]{8,32}$/i)).max(20) });

@Controller('integrations/gmail')
export class GmailController {
  constructor(private readonly svc: GmailService) {}
  @Get('status') status(@CurrentUser() u: AuthUser) { return this.svc.status(u.id); }
  /** Returns the Google consent URL. The web app navigates to it (a redirect would lose the Bearer header). */
  @Get('connect') connect(@CurrentUser() u: AuthUser) { return { url: this.svc.connectUrl(u.id) }; }
  /** Called by Google's redirect, so it cannot carry a Bearer token. The signed `state` identifies the user. */
  @Public() @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string, @Res() res: Response) {
    res.redirect(await this.svc.handleCallback(code, state, error));
  }
  @Get('messages') messages(@CurrentUser() u: AuthUser, @Query(new ZodPipe(ListQ)) q: any) { return this.svc.listMessages(u.id, q); }
  @Get('threads/:id') thread(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.getThread(u.id, id); }
  /** View (inline) or download one attachment. Only types a browser can show safely are ever sent inline. */
  @Get('messages/:mid/attachments/:part') async attachment(@CurrentUser() u: AuthUser, @Param('mid', new ZodPipe(z.string().regex(/^[a-f0-9]{8,32}$/i))) mid: string, @Param('part', new ZodPipe(z.string().regex(/^\d+(\.\d+){0,8}$/))) part: string, @Query('download') download: string | undefined, @Res() res: Response) {
    const f = await this.svc.getAttachment(u.id, mid, part);
    const SAFE_INLINE = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain'];
    const inline = download !== '1' && SAFE_INLINE.includes(f.mime);
    const name = f.filename.replace(/[\r\n"\\/]/g, '_');
    res.setHeader('Content-Type', inline ? f.mime : 'application/octet-stream');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(f.filename)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(f.data);
  }
  @Post('tracking') tracking(@CurrentUser() u: AuthUser, @Body(new ZodPipe(TrackDto)) d: any) { return this.svc.tracking(u.id, d.threadIds); }
  @Post('send') send(@CurrentUser() u: AuthUser, @Body(new ZodPipe(ComposeDto)) d: any) { return this.svc.compose(u.id, d); }
  @Post('disconnect') disconnect(@CurrentUser() u: AuthUser) { return this.svc.disconnect(u.id); }
  @Post('sync') sync(@CurrentUser() u: AuthUser) { return this.svc.sync(u.id); }
}
