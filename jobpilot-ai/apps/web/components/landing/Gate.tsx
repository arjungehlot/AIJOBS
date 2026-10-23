'use client';
import { useState } from 'react';

const CASES = {
  ok: { label: 'HR email from the job post', rows: [[1, 'Recipient is listed in the job post'], [1, 'No earlier application to this company'], [1, 'Under today’s limit (3 of 10)'], [1, 'Resume PDF is attached']], out: ['go', 'Ready. Press Send and it goes out.'] },
  typed: { label: 'An address typed by hand', rows: [[0, 'Recipient is not verified. Tick “I confirm this address” first'], [1, 'No earlier application to this company'], [1, 'Under today’s limit (3 of 10)'], [1, 'Resume PDF is attached']], out: ['hold', 'Waiting for your confirmation.'] },
  limit: { label: 'Tenth email of the day', rows: [[1, 'Recipient is listed in the job post'], [1, 'No earlier application to this company'], [0, 'Daily limit reached (10 of 10). Try again tomorrow'], [1, 'Resume PDF is attached']], out: ['stop', 'Blocked. Nothing was sent.'] },
} as const;

export function Gate() {
  const [k, setK] = useState<keyof typeof CASES>('ok'); const c = CASES[k];
  return (
    <div className="gate">
      <div className="gt-tabs" role="tablist" aria-label="Try a case">
        {(Object.keys(CASES) as (keyof typeof CASES)[]).map((x) => <button key={x} role="tab" aria-selected={k === x} className={k === x ? 'on' : ''} onClick={() => setK(x)}>{CASES[x].label}</button>)}
      </div>
      <ul key={k} className="gt-rows">
        {c.rows.map(([ok, t], i) => <li key={t} style={{ animationDelay: `${i * 90}ms` }} className={ok ? 'y' : 'n'}><span>{ok ? '✓' : '!'}</span>{t}</li>)}
      </ul>
      <div className={`gt-out ${c.out[0]}`} key={k + 'o'}>{c.out[1]}</div>
    </div>
  );
}
