import Link from 'next/link';

/**
 * The JobPilot AI logo. `light` has dark text for light backgrounds; `dark` has a white wordmark for dark or
 * gradient backgrounds. Plain <img> on purpose: the files are small, pre-sized PNGs served from /brand.
 */
export function BrandLogo({ variant = 'light', height = 30, href = '/', label = 'JobPilot AI, go to the home page' }: { variant?: 'light' | 'dark'; height?: number; href?: string | null; label?: string }) {
  const img = <img className="brand-full" src={`/brand/logo-${variant}.png`} alt="JobPilot AI" height={height} style={{ height, width: 'auto' }} />;
  return href ? <Link href={href} className="brand" aria-label={label} title="Home page">{img}<img className="brand-mark" src="/brand/mark.png" alt="" aria-hidden="true" width={34} height={34} /></Link> : <span className="brand">{img}</span>;
}

/** Just the app icon (rounded square). */
export function BrandMark({ size = 32 }: { size?: number }) {
  return <img src="/brand/mark.png" alt="JobPilot AI" width={size} height={size} style={{ width: size, height: size, display: 'block' }} />;
}
