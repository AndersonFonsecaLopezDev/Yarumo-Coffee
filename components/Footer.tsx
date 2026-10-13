import Link from 'next/link'
import { SITE_CONFIG } from '@/lib/site-config'
import { T } from '@/lib/i18n'

export default function Footer() {
  return (
    <footer className="footer" role="contentinfo">
      <span><T k="footer_tagline" /></span>
      <nav aria-label="Footer links">
        <Link href="/recomendaciones"><T k="footer_leave_review" /></Link>{' '}
        ·{' '}
        <a href={SITE_CONFIG.social.googleReviews} target="_blank" rel="noreferrer">
          <T k="footer_google_reviews" />
        </a>{' '}
        ·{' '}
        <a href={SITE_CONFIG.social.instagram} target="_blank" rel="noreferrer">
          Instagram ↗
        </a>
      </nav>
    </footer>
  )
}
