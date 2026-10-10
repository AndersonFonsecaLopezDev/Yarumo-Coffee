import Image from 'next/image'

export type Promotion = {
  id: string
  title: string
  description: string
  badge_text: string | null
  image_url: string | null
  linked_menu_item_id: string | null
  starts_at?: string
  ends_at?: string | null
  sort_order: number
}

type PromotionsSectionProps = {
  promotions: Promotion[]
}

export default function PromotionsSection({ promotions }: PromotionsSectionProps) {
  if (!promotions || promotions.length === 0) return null

  return (
    <section className="promotions-section" aria-label="Promociones y destacados">
      <div className="promotions-grid">
        {promotions.map((promo) => (
          <article key={promo.id} className="promo-card">
            {promo.badge_text && (
              <span className="promo-badge">{promo.badge_text}</span>
            )}
            {promo.image_url && (
              <div style={{ position: 'relative', width: 72, height: 72, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
                <Image
                  src={promo.image_url}
                  alt={promo.title}
                  fill
                  sizes="72px"
                  style={{ objectFit: 'cover' }}
                  loading="lazy"
                />
              </div>
            )}
            <div className="promo-card-body">
              <h3>{promo.title}</h3>
              <p>{promo.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
