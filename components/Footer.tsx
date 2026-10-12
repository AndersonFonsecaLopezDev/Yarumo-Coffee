import Link from 'next/link'
import { GOOGLE_REVIEWS_URL } from '@/lib/site-url'
import { T } from '@/lib/i18n'

export default function Footer() {
  return (
    <footer className="footer" role="contentinfo">
      <span><T k="footer_tagline" /></span>
      <nav aria-label="Footer links">
        <Link href="/recomendaciones"><T k="footer_leave_review" /></Link>{' '}
        ·{' '}
        <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer">
          <T k="footer_google_reviews" />
        </a>{' '}
        ·{' '}
        <a href="https://www.instagram.com/yarumocafearmenia/" target="_blank" rel="noreferrer">
          Instagram ↗
        </a>
      </nav>
    </footer>
  )
}
