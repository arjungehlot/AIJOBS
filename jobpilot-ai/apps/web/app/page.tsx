import Link from 'next/link';
import './landing.css';
import './cosmos.css';
import { Icon } from '@/components/ui';
import { Magnetic, Tilt } from '@/components/nx/Interactive';
import { LiveDemo } from '@/components/nx/LiveDemo';
import { CountUp, FadeIn } from '@/components/nx/Motion';
import { Nav } from '@/components/nx/Nav';
import { ScrollExperience } from '@/components/nx/ScrollExperience';

const STATS: { to: number; suffix?: string; label: string }[] = [
  { to: 7, label: 'job boards at once' }, { to: 30, suffix: '+', label: 'countries to filter' },
  { to: 5, suffix: ' days', label: 'freshest postings' }, { to: 3, label: 'files per email' },
];
const STEPS = [
  ['Create your profile', 'Target roles, skills, countries and salary. Upload your resume once.'],
  ['Press Find jobs', 'The agent reads 7 boards, hides stale posts and scores every opening.'],
  ['Review tailored emails', 'Written from your own resume and signature. Nothing is invented.'],
  ['Send and track', 'Approve, or let the agent send within your limit. Replies land in your tracker.'],
];
const TESTIMONIALS = [
  ['I stopped copy-pasting the same email. The gaps it pointed out in my resume were uncomfortable and useful.', 'Sample user · Backend developer'],
  ['The match score made me skip roles I would never have got. My applications became fewer and better.', 'Sample user · Career switcher'],
  ['Having every sent email and reply in one tracker is what finally made my search feel organised.', 'Sample user · Final-year student'],
];
const FAQ = [
  ['Will it apply to jobs without asking me?', 'No, unless you switch on Autonomous mode and auto-send yourself. By default every email waits for your approval.'],
  ['Does the AI make things up about me?', 'It writes only from your profile and resume. If a required skill is missing, the email says so plainly instead of claiming it.'],
  ['Where do the jobs come from?', 'Public job boards with open feeds. For LinkedIn, Naukri and Indeed, the Job Finder opens a ready search in a new tab, because those sites do not allow importing.'],
  ['What does the match score mean?', 'It estimates how well a listing fits your profile. It does not predict whether you will be hired.'],
  ['Is the live demo using my data?', 'It sends only the text you paste to our server, which asks NVIDIA Nemotron for an analysis. The API key never reaches your browser.'],
];

export default function Landing() {
  return (
    <div className="nx cosmos">
      <a className="nx-skip" href="#main">Skip to content</a>
      <Nav />
      <ScrollExperience>
        <main id="main">
          <section className="nx-zone text-left" data-zone id="top">
            <div className="nx-sc-in nx-hero-copy">
              <div className="nx-stag">
                <span className="nx-badge"><i />AI-powered career growth</span>
                <h1>Your Next Career Move, <span className="nx-grad nx-glow">Powered by AI.</span></h1>
                <p className="nx-lead">Discover the right opportunities, analyze job posts instantly, and apply smarter with your personal AI career assistant.</p>
                <div className="nx-cta">
                  <Magnetic><Link href="/register" className="nx-btn solid lg">Find My Dream Job<Icon name="arrow" size={16} /></Link></Magnetic>
                  <Magnetic><a href="#match" className="nx-btn ghost lg">Explore Features</a></Magnetic>
                </div>
                <dl className="nx-strip">{STATS.map((s) => (<div key={s.label}><dt><CountUp to={s.to} suffix={s.suffix} /></dt><dd>{s.label}</dd></div>))}</dl>
              </div>
            </div>
            <a className="nx-scroll" href="#match" aria-label="Scroll to features"><span /></a>
          </section>

          <section className="nx-zone text-right" data-zone id="match">
            <div className="nx-sc-in nx-glass">
              <div className="nx-stag">
                <span className="nx-eyebrow">AI job matching</span>
                <h2 className="nx-glow">A whole world of openings, matched to you.</h2>
                <p>The agent reads 7 job boards across 30+ countries and scores every opening against your skills, experience, location and salary. Gaps are named, not hidden.</p>
                <ul className="nx-ticks"><li>Pick one country or many</li><li>Only fresh postings, 5 days by default</li><li>Matched and missing skills on every score</li></ul>
              </div>
            </div>
          </section>

          <section className="nx-zone text-left" data-zone id="resume">
            <div className="nx-sc-in nx-glass">
              <div className="nx-stag">
                <span className="nx-eyebrow">Resume analysis</span>
                <h2 className="nx-glow">Your resume, read once and understood.</h2>
                <p>Upload your PDF. The AI pulls out skills, titles and years of experience, then reuses only verified facts in every application.</p>
                <ul className="nx-ticks"><li>Skills and titles extracted automatically</li><li>Nothing added that is not in your document</li><li>Default resume attached to every email</li></ul>
              </div>
            </div>
          </section>

          <section className="nx-zone text-right" data-zone id="analyze">
            <div className="nx-sc-in nx-glass">
              <div className="nx-stag">
                <span className="nx-eyebrow">Screenshot-to-job analysis</span>
                <h2 className="nx-glow">Snap a job post. Get the facts.</h2>
                <p>Upload a screenshot or paste the text in the Job Analyzer. It extracts the role, required skills and contact details, then scores your fit.</p>
                <Magnetic><Link href="/register" className="nx-btn ghost">Try the Job Analyzer<Icon name="arrow" size={15} /></Link></Magnetic>
              </div>
            </div>
          </section>

          <section className="nx-zone text-left" data-zone id="email">
            <div className="nx-sc-in nx-glass">
              <div className="nx-stag">
                <span className="nx-eyebrow">Tailored HR emails</span>
                <h2 className="nx-glow">Every email written for the role, and for you.</h2>
                <p>Drafted from your resume and signature, with your resume and up to three extra files attached. You approve before anything is sent.</p>
                <ul className="nx-ticks"><li>Honest about missing skills</li><li>Duplicate applications blocked</li><li>Replies matched to the right job</li></ul>
              </div>
            </div>
          </section>

          <section className="nx-zone text-right" data-zone id="journey">
            <div className="nx-sc-in nx-glass">
              <div className="nx-stag">
                <span className="nx-eyebrow">How it works</span>
                <h2 className="nx-glow">Your career journey in four steps.</h2>
                <ol className="nx-steps2">{STEPS.map(([t, d], i) => (<li key={t}><span>{i + 1}</span><div><b>{t}</b><p>{d}</p></div></li>))}</ol>
              </div>
            </div>
          </section>

          <div className="nx-after">
            <section className="nx-sec" id="demo">
              <div className="nx-wrap">
                <div data-reveal><span className="nx-eyebrow">Live AI demo</span><h2 className="nx-glow">Analyze a real job post in seconds</h2><p className="nx-sublead">Powered by NVIDIA Nemotron through our secure backend. Paste a post and see what the AI finds.</p></div>
                <div data-reveal><LiveDemo /></div>
              </div>
            </section>

            <section className="nx-sec" id="product">
              <div className="nx-wrap">
                <div data-reveal><span className="nx-eyebrow">Product</span><h2 className="nx-glow">One calm dashboard for the whole search</h2><p className="nx-sublead">Illustrative preview with sample data.</p></div>
                <div data-reveal data-parallax="-6">
                  <Tilt className="nx-dash" max={6}>
                    <div className="nx-bar"><i /><i /><i /><span>jobpilot.ai/dashboard</span></div>
                    <div className="nx-dash-body">
                      <aside>{['Dashboard', 'Job Finder', 'Applications', 'Mailbox', 'Analytics'].map((x, i) => <span key={x} className={i === 0 ? 'on' : ''}>{x}</span>)}</aside>
                      <div className="nx-dash-main">
                        <div className="nx-kpis">{[['Applied', '24'], ['Replies', '9'], ['Interviews', '3'], ['Avg match', '86%']].map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>
                        <div className="nx-chart">{[30, 52, 41, 68, 55, 80, 72, 90].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
                        <div className="nx-table">{[['Senior React Engineer', 'Northwind', 'Interview'], ['Node.js Backend Developer', 'Zeta Cloud', 'Replied'], ['Full Stack Engineer', 'Brightpay', 'Applied']].map(([r, c, s]) => (<div key={r}><span>{r}</span><span>{c}</span><em>{s}</em></div>))}</div>
                      </div>
                    </div>
                  </Tilt>
                </div>
              </div>
            </section>

            <section className="nx-sec" aria-labelledby="nx-t">
              <div className="nx-wrap">
                <div data-reveal><span className="nx-eyebrow">Testimonials</span><h2 id="nx-t" className="nx-glow">What early users could say</h2><p className="nx-sublead">Sample content for layout only. Replace with real customer quotes before launch.</p></div>
                <div className="nx-quotes">{TESTIMONIALS.map(([q, who], i) => (<div key={who + i} data-reveal><Tilt className="nx-card nx-quote" max={5}><span className="nx-tag">Sample</span><p>“{q}”</p><small>{who}</small></Tilt></div>))}</div>
              </div>
            </section>

            <section className="nx-sec narrow" id="faq">
              <div className="nx-wrap">
                <div data-reveal><span className="nx-eyebrow">FAQ</span><h2 className="nx-glow">Questions, answered</h2></div>
                <div className="nx-faq">{FAQ.map(([q, a]) => <div data-reveal key={q}><details><summary>{q}</summary><p>{a}</p></details></div>)}</div>
              </div>
            </section>

            <section className="nx-final">
              <div className="nx-wrap" data-reveal>
                <h2 className="nx-glow">Step through the portal.</h2>
                <p>Create a profile, upload your resume, and let the agent find your first five matches.</p>
                <Magnetic><Link href="/register" className="nx-btn solid lg">Find My Dream Job<Icon name="arrow" size={16} /></Link></Magnetic>
              </div>
            </section>

            <footer className="nx-foot">
              <div className="nx-wrap nx-foot-in">
                <div><Link href="/" className="nx-logo"><i><Icon name="send" size={15} /></i>JobPilot AI</Link><p>Your job search, with you at the controls.</p></div>
                <nav aria-label="Product"><b>Product</b><a href="#match">Job matching</a><a href="#resume">Resume analysis</a><a href="#journey">How it works</a><a href="#demo">Live demo</a></nav>
                <nav aria-label="Account"><b>Account</b><Link href="/login">Log in</Link><Link href="/register">Create account</Link></nav>
                <nav aria-label="Legal"><b>Legal</b><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link></nav>
              </div>
              <div className="nx-wrap nx-legal">© {new Date().getFullYear()} JobPilot AI. Company names, testimonials and dashboard figures on this page are samples.</div>
            </footer>
          </div>
        </main>
      </ScrollExperience>
    </div>
  );
}
