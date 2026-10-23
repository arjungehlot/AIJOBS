import Link from 'next/link';
import { Icon, Logo } from '@/components/ui';
import { Console } from '@/components/landing/Console';
import { Gate } from '@/components/landing/Gate';
import { Reveal } from '@/components/landing/Reveal';
import { SourceLogo } from '@/components/landing/SourceLogo';

const SOURCES: [string, string][] = [['Remotive', 'remotive.com'], ['Arbeitnow', 'arbeitnow.com'], ['Remote OK', 'remoteok.com'], ['Jobicy', 'jobicy.com'], ['Himalayas', 'himalayas.app'], ['The Muse', 'themuse.com'], ['Adzuna India', 'adzuna.in']];
const ALSO: [string, string][] = [['LinkedIn', 'linkedin.com'], ['Naukri', 'naukri.com'], ['Indeed', 'indeed.com']];
const PLANS = [
  { n: 'Free', d: 'Try the whole workflow on a few jobs', f: ['1 career profile', 'Job analyzer and scoring', 'Manual applications', 'Basic tracking'] },
  { n: 'Pro', d: 'For an active search', f: ['Several career profiles', 'AI-written emails', 'Gmail sending and reply tracking', 'Analytics'], hl: true },
  { n: 'Premium Agent', d: 'Automation inside your limits', f: ['Scheduled job discovery', 'Auto-send within your rules', 'Follow-up reminders', 'Higher daily limits'] },
  { n: 'Teams', d: 'For coaches and career services', f: ['Several job seekers', 'Coach dashboard', 'Shared templates', 'Reporting'] },
];
const FAQ = [
  ['Will it apply to jobs without asking me?', 'No, unless you switch on Autonomous mode and auto-send yourself. By default every email waits for your approval, and an address you typed by hand needs one more confirmation.'],
  ['Does the AI make things up about me?', 'It writes only from your profile and resume. If a required skill is missing, the email says so plainly instead of claiming it.'],
  ['Where do the jobs come from?', 'Public job boards that offer open feeds. For LinkedIn, Naukri and Indeed, the Job Finder opens a ready search in a new tab, because those sites do not allow importing their listings.'],
  ['What does the match score mean?', 'It estimates how well a listing fits your profile. It does not predict whether you will be hired.'],
  ['Is my data private?', 'Your records are tied to your account on the server. Job posts and incoming emails are treated as plain text and cannot change your rules.'],
];

export default function Landing() {
  return (
    <div className="lp2">
      <header className="l2-nav">
        <Logo size={16} />
        <nav aria-label="Sections"><a href="#tour">Tour</a><a href="#control">Control</a><a href="#pricing">Plans</a><a href="#faq">FAQ</a></nav>
        <span className="sp" />
        <Link href="/login" className="btn">Log in</Link>
        <Link href="/register" className="btn primary">Start free</Link>
      </header>

      <section className="l2-hero">
        <svg className="l2-path" viewBox="0 0 1200 520" preserveAspectRatio="none" aria-hidden="true">
          <path id="fp" d="M-20 430 C 180 330, 300 470, 520 330 S 860 120, 1220 170" fill="none" stroke="#6366F1" strokeOpacity=".28" strokeWidth="2" strokeDasharray="3 9" strokeLinecap="round" />
        </svg>
        <span className="l2-plane" aria-hidden="true"><Icon name="send" size={14} /></span>
        <div className="l2-hero-in">
          <div className="copy">
            <span className="badge"><i />Hassle-free job applications</span>
            <h1>Set up once. Your AI agent finds jobs and applies for you.</h1>
            <p>Create a profile, press <b>Find jobs</b>, and the agent does the rest: it picks the best matches, writes each email, attaches your resume, sends within your daily limit and tracks every reply.</p>
            <div className="row">
              <Link href="/register" className="btn primary lg">Start free<Icon name="arrow" size={15} /></Link>
              <a href="#tour" className="btn lg">See how it works</a>
            </div>
            <dl className="stats">
              <div><dt>7</dt><dd>job boards searched at once</dd></div>
              <div><dt>5 days</dt><dd>newest postings only</dd></div>
              <div><dt>You</dt><dd>approve every email sent</dd></div>
            </dl>
          </div>
          <Console />
        </div>
      </section>

      <section className="l2-src" aria-label="Job sources">
        <span>Reads openings from</span>
        <div className="mq"><div className="trk">{[...SOURCES, ...SOURCES].map(([n, d], i) => <SourceLogo key={i} name={n} domain={d} />)}</div></div>
        <span className="also">Also opens <span className="als">{ALSO.map(([n, d]) => <SourceLogo key={n} name={n} domain={d} />)}</span> searches</span>
      </section>

      <section className="l2-sec" id="tour">
        <h2>From “Find jobs” to the interview invite</h2>
        <p className="sub">The agent does the slow parts. You stay in charge of every send.</p>
        <div className="bento">
          <Reveal className="bx b-find">
            <div className="tx"><h3>Finds fresh jobs</h3><p>Reads 7 job boards at once and hides anything older than 5 days, so you never write to a closed role.</p></div>
            <div className="viz">
              {[['Node.js Developer', 'Zeta Cloud', '1d'], ['Full Stack Engineer', 'Brightpay', '2d'], ['React Developer', 'Northwind', '4d'], ['Backend Engineer', 'Oldco', '9d']].map(([t, c, a], i) => (
                <div key={t} className={`vr ${i === 3 ? 'old' : ''}`} style={{ ['--i' as any]: i }}><span className="lgo">{c[0]}</span><span><b>{t}</b><small>{c}</small></span><em>{a}</em></div>))}
            </div>
          </Reveal>
          <Reveal className="bx b-score">
            <div className="tx"><h3>Scores every match</h3><p>Compares skills, experience, location and salary with your profile. Gaps are named, not hidden.</p></div>
            <div className="viz">
              <div className="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="48" fill="none" stroke="#E6E9F8" strokeWidth="11" /><circle className="arc" cx="60" cy="60" r="48" fill="none" stroke="url(#g2)" strokeWidth="11" strokeLinecap="round" strokeDasharray="302" transform="rotate(-90 60 60)" /><defs><linearGradient id="g2" x1="0" x2="1"><stop offset="0" stopColor="#6366F1" /><stop offset="1" stopColor="#10B981" /></linearGradient></defs></svg><b>92</b></div>
              <div className="gp"><span className="y">✓ Node.js</span><span className="y">✓ React</span><span className="n">✕ Kubernetes</span></div>
            </div>
          </Reveal>
          <Reveal className="bx b-write">
            <div className="tx"><h3>Writes and attaches</h3><p>Writes each email from your resume, then adds your signature, resume and extra files.</p></div>
            <div className="viz mail">
              <p className="l1">Hello Hiring Team,</p><p className="l2">I am applying for the Node.js Developer role. I have built ERP modules with Node.js, Express and MongoDB.</p>
              <p className="l3">Best regards, <b>Arjun Gehlot</b></p>
              <div className="fl"><span>📄 Resume.pdf</span><span>📎 Cover_Letter.pdf</span></div>
            </div>
          </Reveal>
          <Reveal className="bx b-track">
            <div className="tx"><h3>Tracks replies and interviews</h3><p>Matches Gmail replies to the right job, updates its status and saves interview dates with a prep plan.</p></div>
            <div className="viz tl">
              {[['Applied', '23 Oct', 'email sent with resume'], ['Replied', '24 Oct', 'HR answered'], ['Interview', '28 Oct', '11:00 AM IST, saved to tracker']].map(([s, d, n], i) => (
                <div key={s} className="ev" style={{ ['--i' as any]: i }}><i /><span><b>{s}</b><small>{d} · {n}</small></span></div>))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="l2-ctl" id="control">
        <div className="in">
          <div className="cp">
            <h2>The AI proposes. The server decides.</h2>
            <p>Automation only helps if you can trust it. Every email passes the same checks, whoever or whatever asked for it. Try a few cases.</p>
            <ul>
              <li>Nothing is sent without your approval.</li>
              <li>Duplicate applications are blocked.</li>
              <li>A daily limit you choose, and an emergency stop.</li>
              <li>An audit log of every action.</li>
            </ul>
          </div>
          <Gate />
        </div>
      </section>

      <section className="l2-sec" id="pricing">
        <h2>Plans</h2>
        <p className="sub">Pricing is set at launch. Limits are enforced on the server.</p>
        <div className="plans">
          {PLANS.map((p) => (
            <div className={`pl ${p.hl ? 'hl' : ''}`} key={p.n}>
              <h3>{p.n}</h3><p>{p.d}</p>
              <ul>{p.f.map((x) => <li key={x}>{x}</li>)}</ul>
              <Link href="/register" className={`btn ${p.hl ? 'primary' : ''}`}>Start free</Link>
            </div>))}
        </div>
      </section>

      <section className="l2-sec narrow" id="faq">
        <h2>Questions</h2>
        {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
      </section>

      <section className="l2-cta">
        <h2>Send your first application today</h2>
        <p>Create a profile, upload your resume, and let it find the first five jobs.</p>
        <Link href="/register" className="btn primary lg">Start free<Icon name="arrow" size={15} /></Link>
      </section>
      <footer className="l2-foot"><Logo size={14} /><span>Your job search, with you at the controls.</span></footer>
    </div>
  );
}
