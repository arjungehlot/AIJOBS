/** Reads Google's 429 body so the app can say WHICH limit was hit and when to retry. Pure: no network. */
export interface QuotaInfo { message: string; retryAfterSec?: number; scope: 'minute' | 'day' | 'unknown'; noFreeQuota: boolean; metric?: string }

export function parseQuotaError(body: any): QuotaInfo {
  const err = body?.error ?? {};
  const details: any[] = Array.isArray(err.details) ? err.details : [];
  let retryAfterSec: number | undefined;
  let scope: QuotaInfo['scope'] = 'unknown'; let noFreeQuota = false; let metric: string | undefined;
  for (const d of details) {
    if (typeof d?.retryDelay === 'string') { const m = d.retryDelay.match(/([\d.]+)s/); if (m) retryAfterSec = Math.ceil(Number(m[1])); }
    for (const v of Array.isArray(d?.violations) ? d.violations : []) {
      const id = String(v?.quotaId ?? '');
      if (/PerDay/i.test(id)) scope = 'day'; else if (/PerMinute/i.test(id) && scope !== 'day') scope = 'minute';
      if (String(v?.quotaValue) === '0') noFreeQuota = true;
      metric = metric ?? (typeof v?.quotaMetric === 'string' ? v.quotaMetric.split('/').pop() : undefined);
    }
  }
  const message = String(err.message ?? '');
  if (/limit:\s*0\b/.test(message)) noFreeQuota = true;
  if (scope === 'unknown' && /per day|daily/i.test(message)) scope = 'day';
  if (scope === 'unknown' && /per minute/i.test(message)) scope = 'minute';
  return { message, retryAfterSec, scope, noFreeQuota, metric };
}

/** A human sentence for the UI. */
export function quotaMessage(model: string, q: QuotaInfo, triedFallback: boolean): string {
  const wait = q.retryAfterSec ? ` Try again in about ${q.retryAfterSec} seconds.` : '';
  if (q.noFreeQuota) return `Google gives your key no free quota for "${model}"${triedFallback ? ' (and the fallback model)' : ''}. Pick a different model in AI Settings, or enable billing on the Google AI Studio project.`;
  if (q.scope === 'day') return `Today's free quota for "${model}" is used up${triedFallback ? ' (the fallback model too)' : ''}. It resets daily; meanwhile try another model in AI Settings.`;
  if (q.scope === 'minute') return `Too many AI requests in the last minute for "${model}" (free tier is small).${wait || ' Wait a minute.'}`;
  return `Gemini rate limit reached for "${model}".${wait || ' Wait a minute or pick another model.'}`;
}
