import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AiProvider, DraftContext, JobInput, UNTRUSTED_NOTICE } from './ai.provider';
import { ExtractedJob, ExtractedJobSchema } from './extraction.schema';
import { z } from 'zod';

const EXTRACT_PROMPT_VERSION = 'extract-job@1';
const DRAFT_PROMPT_VERSION = 'draft-email@1';

const FIELDS = `Return one JSON object with keys: company, title, description, location, workMode (remote|hybrid|onsite),
employmentType, requiredSkills[], preferredSkills[], experienceMin, experienceMax, salaryMin, salaryMax, currency,
applicationUrl, applicationEmail, hrContactName, providerJobId, applicationInstructions. Use null for anything not clearly present.`;

const DraftSchema = z.object({ subject: z.string().min(1).max(200), body: z.string().min(1).max(6000) });

/**
 * OpenAI-compatible chat completions client. NOT verified against the live API
 * in this repository: it needs OPENAI_API_KEY and OPENAI_MODEL and a manual smoke test.
 */
@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private readonly base = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';

  async extractJob(input: JobInput): Promise<ExtractedJob> {
    const user =
      input.kind === 'text'
        ? [{ type: 'text', text: `${FIELDS}\n\n<job_content>\n${input.text}\n</job_content>` }]
        : [{ type: 'text', text: FIELDS }, { type: 'image_url', image_url: { url: `data:${input.mime};base64,${input.base64}` } }];
    const json = await this.chat([{ role: 'system', content: UNTRUSTED_NOTICE }, { role: 'user', content: user }], EXTRACT_PROMPT_VERSION);
    return ExtractedJobSchema.parse(json); // throws on malformed output; caller maps to a 502
  }

  async draftEmail(c: DraftContext) {
    const facts = JSON.stringify(c);
    const json = await this.chat([
      { role: 'system', content: 'Write a short, honest job application email using ONLY the facts provided. Do not invent experience, employers, achievements or personal connections. Return JSON {"subject","body"}.' },
      { role: 'user', content: facts },
    ], DRAFT_PROMPT_VERSION);
    return DraftSchema.parse(json);
  }

  private async chat(messages: unknown[], promptVersion: string): Promise<unknown> {
    const key = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL;
    if (!key || !model) throw new ServiceUnavailableException('AI provider is not configured');
    const started = Date.now();
    const res = await fetch(`${this.base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, response_format: { type: 'json_object' }, temperature: 0 }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new ServiceUnavailableException(`AI provider error ${res.status}`);
    const data: any = await res.json();
    // Log metadata only, never prompt content.
    console.log(JSON.stringify({ evt: 'ai_call', promptVersion, model, ms: Date.now() - started, usage: data.usage }));
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new ServiceUnavailableException('AI returned no content');
    return JSON.parse(text);
  }
}
