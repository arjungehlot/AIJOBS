import { config } from 'dotenv';
import { resolve } from 'node:path';
import { parseKeys } from '../ai/key-pool';

// The API is started from apps/api, but a single .env at the repo root is the normal layout.
// Earlier files win, so apps/api/.env can override the root one.
const ENV_FILES = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env'), resolve(__dirname, '../../../../.env')];
const FOUND_ENV_FILES: string[] = [];
for (const f of ENV_FILES) if (config({ path: f }).parsed) FOUND_ENV_FILES.push(f);

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const env = {
  get port() { return Number(process.env.PORT ?? 4000); },
  get webUrl() { return process.env.WEB_URL ?? 'http://localhost:3000'; },
  get mongoUri() { return req('MONGODB_URI'); },
  get authSecret() {
    const s = req('AUTH_SECRET');
    if (s === 'change-me' && process.env.NODE_ENV === 'production') throw new Error('Set a real AUTH_SECRET');
    return s;
  },
  get tokenKey() { return req('TOKEN_ENCRYPTION_KEY'); },
  /** One or many keys: GEMINI_API_KEY=key1,key2,key3 (also GEMINI_API_KEYS and GOOGLE_API_KEY). */
  get geminiKeys() { return parseKeys(process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEYS, process.env.GOOGLE_API_KEY); },
  get geminiKey() { return this.geminiKeys[0] ?? ''; },
  get geminiVisionModel() { return (process.env.GEMINI_VISION_MODEL ?? 'gemini-flash-lite-latest').trim(); },
  get geminiDefaultModel() { return (process.env.GEMINI_MODEL ?? 'gemini-flash-latest').trim(); },
  /**
   * A Gemini key switches AI on. The old .env.example shipped AI_PROVIDER=mock, so "mock" must not override a key;
   * use AI_PROVIDER=off to force the offline demo even when a key exists.
   */
  get aiProvider() { return process.env.AI_PROVIDER === 'off' ? 'mock' : (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ? 'gemini' : 'mock'; },
  get envFilesLoaded() { return FOUND_ENV_FILES; },
  get autoRunEnabled() { return (process.env.AGENT_AUTORUN ?? 'true') !== 'false'; },
  /** Emails the HR-outreach feature may send per user per 24 hours (Gmail's own cap is far higher; this keeps outreach polite). */
  get outreachDailyLimit() { return Math.max(1, Math.min(400, Number(process.env.OUTREACH_DAILY_LIMIT ?? 50) || 50)); },
  get googleClientId() { return process.env.GOOGLE_CLIENT_ID ?? ''; },
  get googleClientSecret() { return process.env.GOOGLE_CLIENT_SECRET ?? ''; },
  get gmailRedirectUri() { return process.env.GMAIL_REDIRECT_URI || `http://localhost:${process.env.PORT ?? 4000}/api/v1/integrations/gmail/callback`; },
  /** Optional free keys from developer.adzuna.com. Adds India-wide listings. */
  /** Himalayas API key (optional, raises the rate limit). Accepts HIMALAYAS_API_KEY, or the name "Himalayas". */
  get himalayasKey() { return (process.env.HIMALAYAS_API_KEY ?? process.env.Himalayas ?? process.env.HIMALAYAS ?? '').trim(); },
  get adzunaId() { return (process.env.ADZUNA_APP_ID ?? '').trim(); },
  get adzunaKey() { return (process.env.ADZUNA_APP_KEY ?? '').trim(); },
  get adzunaConfigured() { return !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY); },
  get gmailConfigured() { return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET); },
  get superAdminEmail() { return (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase(); },
  get superAdminPassword() { return process.env.SUPER_ADMIN_PASSWORD ?? ''; },
  get superAdminName() { return (process.env.SUPER_ADMIN_NAME ?? 'Super Admin').trim() || 'Super Admin'; },
  get mailProvider() { return process.env.MAIL_PROVIDER ?? 'mock'; },
};
