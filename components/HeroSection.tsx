import Image from 'next/image'

type HeroSectionProps = {
  heroImageUrl: string
}

export default function HeroSection({ heroImageUrl }: HeroSectionProps) {
  return (
    <section className="hero" id="inicio" aria-label="Bienvenida a Yarumo Coffee">
      <div className="hero-copy">
        <span className="eyebrow">Armenia · Quindío · Colombia</span>
        <h1>
          Donde cada taza<br />
          <em>cuenta una historia.</em>
        </h1>
        <p>
          Café especial cultivado en las montañas del Quindío, tostado con precisión y servido con calidez en tu mesa.
        </p>
        <div className="hero-actions">
          <a href="#menu" className="hero-cta" id="cta-ver-carta">
            Ver carta digital ↓
          </a>
          <span className="hero-badge-delivery">
            ☕ Atención en mesa y domicilios
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
          sizes="(max-width: 768px) 90vw, 340px"
        />
        <figcaption className="hero-photo-caption">
          <span>Café de Origen</span>
          <strong>Armenia, Quindío</strong>
        </figcaption>
      </figure>
    </section>
  )
}
