import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MenuExperience, {
  type MenuItem,
  type MenuCategory,
  type Promotion,
} from '@/components/MenuExperience'
import ThemeToggle from '@/components/ThemeToggle'
import { SITE_URL, GOOGLE_REVIEWS_URL } from '@/lib/site-url'

const cafeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CafeOrCoffeeShop',
  name: 'Yarumo Coffee',
  image: `${SITE_URL}/yarumo-cover-cafe-og.webp`,
  url: SITE_URL,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Carrera 19 # 21 Norte-01 Local 1',
    addressLocality: 'Armenia',
    addressRegion: 'Quindío',
    addressCountry: 'CO',
  },
  sameAs: [
    'https://www.instagram.com/yarumocafearmenia/',
    'https://maps.app.goo.gl/yr8DTNsgNKm6NQb6A?g_st=iw',
  ],
}

// Server Component: the menu, categories, and active promotions are fetched and rendered on the server
async function getInitialData(): Promise<{
  menu: MenuItem[]
  categories: MenuCategory[]
  promotions: Promotion[]
  heroImageUrl: string
  whatsappDeliveryNumber: string
}> {
  const supabase = await createClient()

  const [menuRes, catRes, promoRes, settingsRes] = await Promise.all([
    supabase
      .from('menu_items')
      .select('id,name,description,price_cop,category,category_id,sort_order,image_url,gallery_urls')
      .eq('available', true)
      .order('sort_order')
      .order('name'),
    supabase
      .from('menu_categories')
      .select('id,name,slug,icon,sort_order')
      .eq('active', true)
      .order('sort_order'),
    supabase
      .from('promotions')
      .select('id,title,description,badge_text,image_url,linked_menu_item_id,sort_order,starts_at,ends_at')
      .eq('active', true)
      .order('sort_order'),
    supabase
      .from('site_settings')
      .select('key,value'),
  ])

  const settingsMap = (settingsRes.data || []).reduce(
    (acc, row) => ({ ...acc, [row.key]: row.value }),
    {} as Record<string, string>,
  )

  const heroImageUrl = settingsMap['hero_image_url'] || '/yarumo-cover-cafe.webp'
  const whatsappDeliveryNumber = settingsMap['whatsapp_delivery_number'] || '573192208938'

  return {
    menu: (menuRes.data || []) as MenuItem[],
    categories: (catRes.data || []) as MenuCategory[],
    promotions: (promoRes.data || []) as Promotion[],
    heroImageUrl,
    whatsappDeliveryNumber,
  }
}

export default async function Home() {
  const { menu, categories, promotions, heroImageUrl, whatsappDeliveryNumber } = await getInitialData()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(cafeJsonLd) }}
      />
      <header className="header">
        <a className="brand" href="#inicio">
          <Image src="/yarumo-logo.webp" alt="Yarumo Coffee" width={44} height={44} priority />
          <span>
            <strong>Yarumo</strong>
            <small>COFFEE</small>
          </span>
        </a>
        <nav className="nav-links">
          <a href="#menu">Carta</a>
          <Link href="/recomendaciones">Opiniones</Link>
          <a href="#visitanos">Visítanos</a>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ThemeToggle />
          <a className="instagram-link" href="https://www.instagram.com/yarumocafearmenia/" target="_blank" rel="noreferrer">
            Instagram ↗
          </a>
        </div>
      </header>

      <main id="inicio">
        <MenuExperience
          initialMenu={menu}
          initialCategories={categories}
          initialPromotions={promotions}
          heroImageUrl={heroImageUrl}
          whatsappDeliveryNumber={whatsappDeliveryNumber}
        />

        <section className="visit-strip" id="visitanos">
          <div>
            <span className="eyebrow">Ven a vernos</span>
            <h2>
              Tu mesa<br />
              <em>te espera.</em>
            </h2>
          </div>
          <div>
            <p>
              Carrera 19 # 21 Norte-01 Local 1<br />
              Armenia, Quindío
            </p>
            <a href="https://maps.app.goo.gl/yr8DTNsgNKm6NQb6A?g_st=iw" target="_blank" rel="noreferrer">
              Abrir en Google Maps ↗
            </a>
          </div>
        </section>

        <footer className="footer">
          <span>Yarumo Coffee · Donde cada taza cuenta una historia.</span>
          <span>
            <Link href="/recomendaciones">Dejar recomendación</Link>{' '}
            ·{' '}
            <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer">
              Reseñas de Google ↗
            </a>{' '}
            ·{' '}
            <a href="https://www.instagram.com/yarumocafearmenia/" target="_blank" rel="noreferrer">
              Instagram ↗
            </a>
          </span>
        </footer>
      </main>
    </>
  )
}

