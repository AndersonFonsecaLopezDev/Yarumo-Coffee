import Link from 'next/link'
import { GOOGLE_REVIEWS_URL } from '@/lib/site-url'

export default function Footer() {
  return (
    <footer className="footer" role="contentinfo">
      <span>Yarumo Coffee · Donde cada taza cuenta una historia.</span>
      <nav aria-label="Enlaces del pie de página">
        <Link href="/recomendaciones">Dejar recomendación</Link>{' '}
        ·{' '}
        <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer" aria-label="Abrir reseñas de Google de Yarumo Coffee">
          Reseñas de Google ↗
        </a>{' '}
        ·{' '}
        <a href="https://www.instagram.com/yarumocafearmenia/" target="_blank" rel="noreferrer" aria-label="Abrir Instagram de Yarumo Coffee">
          Instagram ↗
        </a>
      </nav>
    </footer>
  )
}
