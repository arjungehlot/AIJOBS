'use client';
import { useState } from 'react';

/** The site's own icon, fetched from its favicon at view time. Falls back to the first letter if it cannot load. */
export function SourceLogo({ name, domain }: { name: string; domain: string }) {
  const [bad, setBad] = useState(false);
  return (
    <span className="slg">
      {bad ? <i className="ltr" aria-hidden="true">{name[0]}</i> : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" width={22} height={22} loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} />
      )}
      <b>{name}</b>
    </span>
  );
}
