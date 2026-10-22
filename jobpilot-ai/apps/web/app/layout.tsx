import './globals.css';
import type { ReactNode } from 'react';

export const metadata = { title: 'JobPilot AI', description: 'Your AI Job Search Agent. From Discovery to Interview.' };

export default function Root({ children }: { children: ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
