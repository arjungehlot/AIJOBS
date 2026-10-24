import { HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { DemoResult, RateLimiter, demoMessages, parseDemoReply } from '../domain/nvidia-demo';

export const DemoDto = z.object({ text: z.string().trim().min(40, 'Paste at least a few lines of the job post').max(4000, 'Keep it under 4,000 characters') });

const BASE = () => (process.env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
const MODEL = () => (process.env.NVIDIA_MODEL ?? 'nvidia/nemotron-3-ultra-550b-a55b').trim();

/** Public landing-page demo. The key stays on the server; callers are limited per IP and overall. */
@Injectable()
export class DemoService {
  private perIp = new RateLimiter(4, 10 * 60_000);
  private overall = new RateLimiter(120, 60 * 60_000);

  status() { return { enabled: !!process.env.NVIDIA_API_KEY?.trim() }; }

  async analyze(ip: string, text: string): Promise<DemoResult> {
    const key = process.env.NVIDIA_API_KEY?.trim();
    if (!key) throw new ServiceUnavailableException('The live demo is not switched on for this site yet.');
    const wait = this.perIp.take(`ip:${ip}`) || this.overall.take('all');
    if (wait) throw new HttpException({ message: `Demo limit reached. Try again in ${wait} seconds, or create a free account.`, retryAfter: wait }, HttpStatus.TOO_MANY_REQUESTS);
    let res: Response;
    try {
      res = await fetch(`${BASE()}/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ model: MODEL(), messages: demoMessages(text), temperature: 0.2, max_tokens: 700, stream: false }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new HttpException('The AI service did not answer in time. Please try again.', HttpStatus.GATEWAY_TIMEOUT);
    }
    if (res.status === 429) throw new HttpException('The AI service is busy right now. Please try again in a minute.', HttpStatus.TOO_MANY_REQUESTS);
    if (!res.ok) throw new HttpException('The AI service could not process that request.', HttpStatus.BAD_GATEWAY); // upstream detail is never forwarded
    const json: any = await res.json().catch(() => null);
    const out = parseDemoReply(String(json?.choices?.[0]?.message?.content ?? ''));
    if (!out) throw new HttpException('The AI reply could not be read. Please try again.', HttpStatus.BAD_GATEWAY);
    return out;
  }
}
