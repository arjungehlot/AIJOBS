import Link from 'next/link';
import type { ReactNode } from 'react';
import { Gauge } from '@/components/charts';
import { Icon, Logo } from '@/components/ui';

/** Centered card with a brand panel. Preview cards are illustrative samples, labelled as such. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-box">
        <aside className="auth-hero" aria-label="About JobPilot AI">
          <Link href="/" aria-label="JobPilot AI home"><Logo size={18} /></Link>
          <div>
            <h2>Your AI job search agent, with you in control.</h2>
            <p style={{ marginTop: 8 }}>Understand every match, apply with honest drafts, and approve each email before it goes out.</p>
          </div>
          <div className="stack" style={{ gap: 12 }}>
            <div className="float"><Gauge value={92} label="Match score" size={46} color="#4F46E5" /><div><b>Senior Node.js Engineer</b><span className="faint">Explained: 5 of 6 required skills matched</span></div></div>
            <div className="float"><span className="ic c-emerald"><Icon name="mail" size={16} /></span><div><b>Reply classified: interview invite</b><span className="faint">You choose whether to update the status</span></div></div>
            <div className="float"><span className="ic c-indigo"><Icon name="shield" size={16} /></span><div><b>Waiting for your approval</b><span className="faint">Nothing is sent without it</span></div></div>
          </div>
          <div className="hero-note">Sample preview, not real data.</div>
        </aside>
        <section className="auth-pane">{children}</section>
      </div>
    </div>
  );
}
