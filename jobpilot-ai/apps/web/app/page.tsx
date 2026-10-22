import Link from 'next/link';
import { BarChart, Donut, Funnel, Legend, PALETTE } from '@/components/charts';
import { Icon, Logo } from '@/components/ui';

const FEATURES = [
  { icon: 'scan', c: 'c-indigo', t: 'Analyze any job', d: 'Paste a description or drop a screenshot. Missing details stay empty for you to fill, never guessed.', live: true },
  { icon: 'target', c: 'c-sky', t: 'Explainable match score', d: 'See which required and preferred skills you cover, what is missing, and how confident the score is.', live: true },
  { icon: 'send', c: 'c-violet', t: 'Approve, then send', d: 'A send gate checks recipient trust, duplicates and daily limits. Unclear outcomes are verified, not retried blindly.', live: true },
  { icon: 'kanban', c: 'c-emerald', t: 'Tracker and audit trail', d: 'Every status change and action is recorded with who did it, when, and the result.', live: true },
  { icon: 'mail', c: 'c-amber', t: 'Gmail and Outlook reply tracking', d: 'Connect your mailbox, match replies to applications and extract interview details.', live: false },
  { icon: 'bot', c: 'c-rose', t: 'Controlled autonomous agent', d: 'Scheduled discovery and approved auto-sending inside limits you set, with a one-click stop.', live: false },
];
const STEPS = [
  ['Set your profile', 'Skills, experience, preferred modes and cities, excluded companies, and daily limits.'],
  ['Add a job', 'From a screenshot or pasted text. Review the extracted fields before saving.'],
  ['See the fit', 'A 0 to 100 score with a plain-language breakdown and honest gaps.'],
  ['Approve and track', 'Review the draft, approve it, send, and follow the full history.'],
];
const PLANS = [
  { n: 'Free', d: 'Try the workflow', f: ['1 career profile', 'Job analyzer and scoring', 'Manual applications', 'Basic tracking'] },
  { n: 'Pro', d: 'For active searches', f: ['Multiple career profiles', 'AI application drafts', 'Email integration', 'Analytics'], hl: true },
  { n: 'Premium Agent', d: 'Automation with guardrails', f: ['Scheduled discovery', 'Auto-send within your rules', 'Follow-up automation', 'Higher limits'] },
  { n: 'Teams', d: 'Coaches and career services', f: ['Multiple job seekers', 'Coach dashboard', 'Shared templates', 'Reporting'] },
];
const FAQ = [
  ['Will it apply to jobs without asking me?', 'Not unless you enable it. In the current build every application needs your approval, and recipients that are not verified need an extra confirmation.'],
  ['Does it make things up in my applications?', 'The drafting rules only use facts from your profile. Where you lack a required skill, the draft says so plainly instead of claiming it.'],
  ['What does the match score mean?', 'It is an estimate of fit between the listing and your profile. It is not a prediction of whether you will be hired.'],
  ['Which parts are working today?', 'Job analysis, scoring, drafts, approval, guarded sending (with a test mailer), tracking and the audit log. Gmail and Outlook, inbox sync and the autonomous agent are planned and marked as such.'],
  ['Is my data private?', 'Your records are scoped to your account on the server. Job posts and emails are treated as untrusted text and cannot change your rules.'],
];

export default function Landing() {
  const labels = ['1', '2', '3', '4', '5', '6', '7'].map((d) => `D${d}`);
  return (
    <div className="lp">
      <header className="lp-nav">
        <Logo size={16} />
        <nav className="links" aria-label="Sections"><a href="#features">Features</a><a href="#how">How it works</a><a href="#control">Control</a><a href="#pricing">Plans</a><a href="#faq">FAQ</a></nav>
        <span className="sp" />
        <Link href="/login" className="btn">Log in</Link>
        <Link href="/register" className="btn primary">Start free</Link>
      </header>

      <section className="hero">
        <div className="hero-in">
          <span className="eyebrow"><b>New</b>Screenshot to application in minutes</span>
          <h1>Your AI job search agent. <em>From discovery to interview.</em></h1>
          <p className="lead">Find suitable jobs, understand your fit, draft honest applications and track every reply from one calm workspace. You stay in control of everything that gets sent.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link href="/register" className="btn primary lg">Start free<Icon name="arrow" size={15} /></Link>
            <a href="#how" className="btn lg">See how it works</a>
          </div>

          <div className="mock" aria-label="Product preview with sample data">
            <div className="mock-bar"><i /><i /><i /><span className="faint" style={{ marginLeft: 8 }}>Sample preview, not real results</span></div>
            <div className="mock-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                {[['Jobs discovered', '412', 'c-indigo', 'briefcase'], ['Suitable jobs', '74', 'c-sky', 'target'], ['Applications sent', '36', 'c-violet', 'send'], ['Interviews', '3', 'c-amber', 'users']].map(([l, v, c, i]) => (
                  <div className="card kpi" key={l}><span className={`chip ${c}`}><Icon name={i} size={14} /></span><span className="v">{v}</span><span className="l">{l}</span></div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                <div className="card"><div className="card-h"><h2>Weekly activity</h2><Legend items={[{ label: 'Found', color: PALETTE[1] }, { label: 'Sent', color: PALETTE[0] }]} /></div>
                  <BarChart height={150} width={380} labels={labels} series={[{ name: 'Found', color: PALETTE[1], values: [12, 18, 9, 22, 30, 14, 24] }, { name: 'Sent', color: PALETTE[0], values: [1, 2, 0, 3, 4, 2, 3] }]} /></div>
                <div className="card"><div className="card-h"><h2>Pipeline</h2></div>
                  <Funnel stages={[{ stage: 'Analyzed', count: 268 }, { stage: 'Shortlisted', count: 41 }, { stage: 'Applied', count: 36 }, { stage: 'Replied', count: 9 }, { stage: 'Interview', count: 3 }]} /></div>
                <div className="card"><div className="card-h"><h2>Status</h2></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Donut size={104} center="36" sub="applications" parts={[{ label: 'Awaiting', value: 24, color: PALETTE[1] }, { label: 'Replied', value: 5, color: PALETTE[2] }, { label: 'Interview', value: 3, color: PALETTE[0] }, { label: 'Rejected', value: 4, color: PALETTE[5] }]} />
                    <Legend items={[{ label: 'Awaiting', color: PALETTE[1] }, { label: 'Replied', color: PALETTE[2] }, { label: 'Interview', color: PALETTE[0] }, { label: 'Rejected', color: PALETTE[5] }]} />
                  </div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" id="features">
        <h2>Everything between “found it” and “got the reply”</h2>
        <p className="sub">Built around one rule: the AI proposes, and the system checks every action against your rules before it happens.</p>
        <div className="feat">
          {FEATURES.map((f) => (
            <div className="card" key={f.t}>
              <span className={`chip ${f.c}`}><Icon name={f.icon} size={17} /></span>
              <h3>{f.t} <span className={`pill ${f.live ? 'ok' : 'gray'}`} style={{ marginLeft: 6 }}>{f.live ? 'Available' : 'Planned'}</span></h3>
              <p>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sec" id="how">
        <h2>How it works</h2>
        <p className="sub">Four steps from a job post to a tracked application.</p>
        <div className="flow">{STEPS.map(([t, d], i) => <div className="card" key={t}><div className="n">{i + 1}</div><h3>{t}</h3><p className="muted" style={{ marginTop: 4, lineHeight: 1.55 }}>{d}</p></div>)}</div>
      </section>

      <section className="sec" id="control">
        <div className="band">
          <div><h2>Privacy and control by design</h2><p style={{ color: '#CBD5E1', marginTop: 10, lineHeight: 1.6 }}>Automation is only useful if you trust it. Every limit is yours to set and every action leaves a record.</p></div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Nothing is sent without your approval.</li><li>Unverified recipients need an explicit confirmation.</li>
            <li>Duplicate applications are blocked, even under concurrent requests.</li><li>Unclear send results are checked with the provider, not retried blindly.</li>
          </ul>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Missing details stay empty instead of being invented.</li><li>Job posts and emails cannot change your rules.</li>
            <li>An append-only audit log of every action.</li><li>No fake testimonials or hiring-success claims, here or in the app.</li>
          </ul>
        </div>
      </section>

      <section className="sec" id="pricing">
        <h2>Plans</h2>
        <p className="sub">Pricing is set at launch. Plan limits are enforced on the server.</p>
        <div className="price">
          {PLANS.map((p) => (
            <div className={`card ${p.hl ? 'hl' : ''}`} key={p.n}>
              <div><h3 style={{ fontSize: 16 }}>{p.n}</h3><p className="muted">{p.d}</p></div>
              <ul>{p.f.map((x) => <li key={x}>{x}</li>)}</ul>
              <Link href="/register" className={`btn ${p.hl ? 'primary' : ''}`} style={{ justifyContent: 'center', marginTop: 'auto' }}>Start free</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="sec" id="faq" style={{ maxWidth: 760 }}>
        <h2>Questions</h2>
        <p className="sub">Straight answers about what it does and does not do.</p>
        {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
      </section>

      <section className="cta">
        <h2 style={{ fontSize: 28, letterSpacing: '-0.025em' }}>Try it on one real job</h2>
        <p className="muted" style={{ margin: '8px 0 18px' }}>Create a profile, paste a job and see the fit in a couple of minutes.</p>
        <Link href="/register" className="btn primary lg">Start free<Icon name="arrow" size={15} /></Link>
      </section>
      <footer className="foot"><span>© JobPilot AI</span><span>Privacy policy and terms to be published before launch.</span></footer>
    </div>
  );
}
