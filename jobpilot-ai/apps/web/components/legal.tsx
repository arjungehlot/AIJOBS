import { BrandLogo } from '@/components/brand';
import type { ReactNode } from 'react';

export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'ui@smartitbox.in';

export function Legal({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main style={{ maxWidth: 780, margin: '0 auto', padding: '40px 20px 80px', fontSize: 15, lineHeight: 1.7 }}>
      <BrandLogo variant="light" height={36} />
      <h1 style={{ fontFamily: 'var(--display)', fontSize: 34, margin: '18px 0 4px' }}>{title}</h1>
      <p style={{ color: '#64748B', marginTop: 0 }}>Last updated: {updated}</p>
      <div className="legal-body">{children}</div>
      <style>{`.legal-body h2{font-size:20px;margin:30px 0 6px}.legal-body ul{padding-left:22px}.legal-body li{margin:4px 0}`}</style>
    </main>
  );
}
