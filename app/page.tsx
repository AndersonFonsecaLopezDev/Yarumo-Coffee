import Header from '@/components/Header'
import HeroSection from '@/components/HeroSection'
import HomeClientSection from '@/components/HomeClientSection'
import VisitStrip from '@/components/VisitStrip'
import Footer from '@/components/Footer'
import { getInitialData, cafeJsonLd } from '@/lib/home-data'

// Revalidación estática ISR cada 120 segundos
export const revalidate = 120

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
