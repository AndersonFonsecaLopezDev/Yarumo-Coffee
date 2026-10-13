import Image from 'next/image'
import { T } from '@/lib/i18n'

type HeroSectionProps = {
  heroImageUrl: string
}

export default function HeroSection({ heroImageUrl }: HeroSectionProps) {
  return (
    <section className="hero" id="inicio" aria-label="Bienvenida a Yarumo Coffee">
      <div className="hero-copy">
        <span className="eyebrow"><T k="hero_eyebrow" /></span>
        <h1>
          <T k="hero_title_1" /><br />
          <em><T k="hero_title_2" /></em>
        </h1>
        <p>
          <T k="hero_desc" />
        </p>
        <div className="hero-actions">
          <a href="#menu" className="hero-cta" id="cta-ver-carta">
            <T k="hero_cta" />
          </a>
          <span className="hero-badge-delivery">
            <T k="hero_badge" />
          </span>
        </div>
      </div>

      <figure className="hero-photo" aria-label="Café de Yarumo servido en mesa">
        <Image
          src={heroImageUrl || '/yarumo-cover-cafe.webp'}
          alt="Taza de café especial servida en mesa de Yarumo Coffee"
          width={680}
          height={880}
          priority
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 340px, 360px"
          quality={75}
        />
        <figcaption className="hero-photo-caption">
          <span><T k="hero_origin_title" /></span>
          <strong><T k="hero_origin_sub" /></strong>
        </figcaption>
      </figure>
    </section>
  )
}
