import 'dotenv/config';

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
  get aiProvider() { return process.env.AI_PROVIDER ?? 'mock'; },
  get mailProvider() { return process.env.MAIL_PROVIDER ?? 'mock'; },
};
