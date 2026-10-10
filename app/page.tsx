import Header from '@/components/Header'
import HeroSection from '@/components/HeroSection'
import HomeClientSection from '@/components/HomeClientSection'
import VisitStrip from '@/components/VisitStrip'
import Footer from '@/components/Footer'
import { createPublicClient } from '@/lib/supabase/public'
import { SITE_URL } from '@/lib/site-url'
import type { MenuItem, MenuCategory } from '@/components/MenuCatalog'
import type { Promotion } from '@/components/PromotionsSection'

// Revalidación estática ISR cada 120 segundos
export const revalidate = 120

const cafeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CafeOrCoffeeShop',
  name: 'Yarumo Coffee',
  image: `${SITE_URL}/yarumo-cover-cafe-og.webp`,
  url: SITE_URL,
  telephone: '+573192208938',
  priceRange: '$$',
  servesCuisine: ['Café de especialidad', 'Repostería artesanal', 'Bebidas calientes y frías'],
  menu: `${SITE_URL}/#menu`,
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 4.5429,
    longitude: -75.6668,
  },
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Carrera 19 # 21 Norte-01 Local 1',
    addressLocality: 'Armenia',
    addressRegion: 'Quindío',
    addressCountry: 'CO',
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '08:00',
      closes: '20:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Sunday'],
      opens: '09:00',
      closes: '19:00',
    },
  ],
  sameAs: [
    'https://www.instagram.com/yarumocafearmenia/',
    'https://maps.app.goo.gl/yr8DTNsgNKm6NQb6A?g_st=iw',
  ],
}

async function getInitialData(): Promise<{
  menu: MenuItem[]
  categories: MenuCategory[]
  promotions: Promotion[]
  heroImageUrl: string
  whatsappDeliveryNumber: string
}> {
  const supabase = createPublicClient()

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
      <Header />
      <main id="main-content">
        <HeroSection heroImageUrl={heroImageUrl} />
        <HomeClientSection
          initialMenu={menu}
          initialCategories={categories}
          initialPromotions={promotions}
          whatsappDeliveryNumber={whatsappDeliveryNumber}
        />
        <VisitStrip />
      </main>
      <Footer />
    </>
  )
}
