import { config } from 'dotenv';
import { resolve } from 'node:path';

// The API is started from apps/api, but a single .env at the repo root is the normal layout.
// Earlier files win, so apps/api/.env can override the root one.
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(__dirname, '../../../../.env') });

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
  get geminiKey() { return (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim(); },
  get geminiDefaultModel() { return (process.env.GEMINI_MODEL ?? 'gemini-2.5-flash').trim(); },
  /** AI_PROVIDER wins; otherwise Gemini is used automatically when a key is present. */
  get aiProvider() { return process.env.AI_PROVIDER ?? (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? 'gemini' : 'mock'); },
  get autoRunEnabled() { return (process.env.AGENT_AUTORUN ?? 'true') !== 'false'; },
  get googleClientId() { return process.env.GOOGLE_CLIENT_ID ?? ''; },
  get googleClientSecret() { return process.env.GOOGLE_CLIENT_SECRET ?? ''; },
  get gmailRedirectUri() { return process.env.GMAIL_REDIRECT_URI || `http://localhost:${process.env.PORT ?? 4000}/api/v1/integrations/gmail/callback`; },
  get gmailConfigured() { return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET); },
  get superAdminEmail() { return (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase(); },
  get superAdminPassword() { return process.env.SUPER_ADMIN_PASSWORD ?? ''; },
  get superAdminName() { return (process.env.SUPER_ADMIN_NAME ?? 'Super Admin').trim() || 'Super Admin'; },
  get mailProvider() { return process.env.MAIL_PROVIDER ?? 'mock'; },
};
