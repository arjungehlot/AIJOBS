import './globals.css';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

const inter = Inter({ subsets: ['latin'], variable: '--font', display: 'swap' });

export const metadata = {
  title: 'JobPilot AI — Your AI Job Search Agent',
  description: 'Find suitable jobs, score the fit, draft honest applications and track every reply from one workspace.',
};

export default function Root({ children }: { children: ReactNode }) {
  return (<html lang="en" className={inter.variable}><body>{children}</body></html>);
}
