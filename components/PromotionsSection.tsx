'use client'

import Image from 'next/image'
import { useI18n } from '@/lib/i18n'
import type { Promotion } from '@/lib/types'

export type { Promotion }

type PromotionsSectionProps = {
  promotions: Promotion[]
}

export default function PromotionsSection({ promotions }: PromotionsSectionProps) {
  const { language } = useI18n()

  if (!promotions || promotions.length === 0) return null

  return (
    <section className="promotions-section" aria-label="Promociones y destacados">
      <div className="promotions-grid">
        {promotions.map((promo) => {
          const displayTitle = language === 'en' && promo.title_en ? promo.title_en : promo.title
          const displayDesc = language === 'en' && promo.description_en ? promo.description_en : promo.description

          return (
            <article key={promo.id} className="promo-card">
              {promo.badge_text && (
                <span className="promo-badge">{promo.badge_text}</span>
              )}
              {promo.image_url && (
                <div style={{ position: 'relative', width: 72, height: 72, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
                  <Image
                    src={promo.image_url}
                    alt={displayTitle}
                    fill
                    sizes="72px"
                    style={{ objectFit: 'cover' }}
                    loading="lazy"
                  />
                </div>
              )}
              <div className="promo-card-body">
                <h3>{displayTitle}</h3>
                <p>{displayDesc}</p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
