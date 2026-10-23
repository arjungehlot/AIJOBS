'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui';

const STEPS = [
  { k: 'Create profile', d: 'Your role, skills and limits. Once.', ic: 'user' },
  { k: 'Find jobs', d: 'One click. The agent scans every board.', ic: 'search' },
  { k: 'Apply', d: 'Emails written and sent with your resume.', ic: 'send' },
  { k: 'Interview', d: 'Replies tracked, interviews saved.', ic: 'award' },
];
const DUR = 52; // ticks of 120 ms per step
const MATCHES = [['Node.js Developer', 'Zeta Cloud', 92, 'hr@zetacloud.example'], ['Full Stack Engineer', 'Brightpay', 88, 'careers@brightpay.example'], ['React Developer', 'Northwind', 85, 'jobs@northwind.example']] as const;
const ROLE = 'Full Stack Developer';

export function Console() {
  const [step, setStep] = useState(0); const [t, setT] = useState(0); const [hold, setHold] = useState(false); const [still, setStill] = useState(false);
  useEffect(() => { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setStill(true); setT(999); } }, []);
  useEffect(() => {
    if (still || hold) return;
    const id = setInterval(() => setT((x) => { if (x + 1 >= DUR) { setStep((s) => (s + 1) % STEPS.length); return 0; } return x + 1; }), 120);
    return () => clearInterval(id);
  }, [still, hold]);
  const go = (i: number) => { setStep(i); setT(still ? 999 : 0); };
  const found = Math.min(40, Math.max(0, Math.floor((t - 8) * 1.6)));

  return (
    <div className="cs" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onFocus={() => setHold(true)} onBlur={() => setHold(false)}>
      <div className="cs-bar"><i /><i /><i /><span>JobPilot AI agent</span><em>{hold ? 'Paused' : 'Live demo'}</em></div>
      <div className="cs-body">
        <ol className="cs-rail" aria-label="How the agent works">
          {STEPS.map((s, i) => (
            <li key={s.k}><button type="button" className={i === step ? 'on' : i < step ? 'done' : ''} onClick={() => go(i)} aria-current={i === step}>
              <span className="n">{i < step ? '✓' : i + 1}</span><span className="tx"><b>{s.k}</b><small>{s.d}</small></span>
              {i === step && !still && <span className="bar"><i style={{ width: `${(t / DUR) * 100}%` }} /></span>}
            </button></li>
          ))}
        </ol>

        <div className="cs-stage">
          {step === 0 && (<div className="st">
            <div className="hd"><b>Create your profile</b><span className="ct">takes about two minutes</span></div>
            <div className="fm"><span>Target role</span><div className="in">{ROLE.slice(0, Math.max(0, t) * 2)}{t * 2 < ROLE.length && <u />}</div></div>
            <div className="fm"><span>Skills</span><div className="chips">{['Node.js', 'React', 'MongoDB', 'TypeScript'].map((k, i) => <span key={k} className={`ck y ${t > 12 + i * 4 ? 'show' : ''}`}>{k}</span>)}</div></div>
            <div className="fm two"><div><span>Location</span><div className={`in ${t > 30 ? '' : 'ph'}`}>{t > 30 ? 'India · Remote' : 'Where?'}</div></div><div><span>Minimum salary</span><div className={`in ${t > 33 ? '' : 'ph'}`}>{t > 33 ? '₹50,000 / month' : 'Optional'}</div></div></div>
            <div className="fm two"><div><span>Max emails per day</span><div className={`in ${t > 36 ? '' : 'ph'}`}>{t > 36 ? '10' : '–'}</div></div><div><span>Resume</span><div className={`in ${t > 38 ? '' : 'ph'}`}>{t > 38 ? '📄 Resume.pdf' : 'Upload'}</div></div></div>
            <div className={`ok-bar ${t > 44 ? 'show' : ''}`}>✓ Profile saved. Ready to search.</div>
          </div>)}

          {step === 1 && (<div className="st">
            <div className="hd"><b>Find jobs</b><span className="ct">posted in the last 5 days</span></div>
            <div className="go"><span className="field">{ROLE}</span><span className={`gobtn ${t > 3 ? 'press' : ''}`}><Icon name="search" size={13} />Find jobs</span></div>
            <div className={`scan ${t > 6 ? 'show' : ''}`}>
              <div className="pr"><i style={{ width: `${Math.min(100, Math.max(0, (t - 6) * 4))}%` }} /></div>
              <small>{t < 30 ? <>Reading 7 job boards · <b>{found}</b> openings found</> : <>Scored against your profile · <b>40</b> openings checked</>}</small>
            </div>
            <div className="ml2">
              {MATCHES.map(([ti, co, sc], i) => (
                <div key={ti} className={`mt ${t > 30 + i * 5 ? 'show' : ''}`}>
                  <span className="lgo">{co[0]}</span><span className="tt"><b>{ti}</b><small>{co}</small></span><span className="scr">{sc}<em>match</em></span>
                </div>))}
            </div>
            <p className={`note ${t > 47 ? 'show' : ''}`}>The agent picked the 3 best matches. Weak fits were skipped.</p>
          </div>)}

          {step === 2 && (<div className="st">
            <div className="hd"><b>Applying for you</b><span className="ct">within your limit: 10 a day</span></div>
            {MATCHES.map(([ti, co, , em], i) => { const a = 4 + i * 12; const stage = t > a + 9 ? 3 : t > a + 5 ? 2 : t > a ? 1 : 0; return (
              <div key={ti} className={`apx ${stage ? 'show' : ''} ${stage === 3 ? 'fin' : ''}`}>
                <span className="lgo">{co[0]}</span>
                <span className="tt"><b>{ti} · {co}</b><small>{stage === 1 ? 'Writing the email from your resume…' : stage === 2 ? 'Attaching Resume.pdf…' : stage === 3 ? `Sent to ${em}` : ''}</small></span>
                <span className="stt">{stage === 3 ? '✓ Sent' : stage ? <i className="spin" /> : ''}</span>
              </div>); })}
            <div className={`ok-bar ${t > 44 ? 'show' : ''}`}><Icon name="send" size={13} />3 applications sent with your resume. 7 left today.</div>
          </div>)}

          {step === 3 && (<div className="st">
            <div className="hd"><b>Interview</b><span className="ct">replies are matched to the job</span></div>
            <div className={`rp ${t > 3 ? 'show' : ''}`}>
              <span className="lgo">Z</span>
              <div><b>Zeta Cloud HR</b><small>Interview invitation · Node.js Developer</small>
                <p>We would like to invite you for an interview on 28 Oct at 11:00 AM IST.</p></div>
            </div>
            <div className={`iv ${t > 14 ? 'show' : ''}`}><span className="d"><b>28</b>Oct</span><div><b>Interview · 11:00 AM IST</b><small>Saved to your tracker with a prep plan</small></div></div>
            <div className="pl">{['Applied', 'Replied', 'Interview'].map((s, i) => <span key={s} className={(i === 0) || (i === 1 && t > 8) || (i === 2 && t > 20) ? 'on' : ''}>{s}</span>)}</div>
          </div>)}
        </div>
      </div>
      <div className="cs-foot">Sample data. Nothing here is really sent.</div>
    </div>
  );
}
