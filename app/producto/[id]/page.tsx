import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Header from '@/components/Header'
import HeroSection from '@/components/HeroSection'
import HomeClientSection from '@/components/HomeClientSection'
import VisitStrip from '@/components/VisitStrip'
import Footer from '@/components/Footer'
import { getInitialData, getProductById, cafeJsonLd } from '@/lib/home-data'
import { SITE_URL } from '@/lib/site-url'

export const revalidate = 120

type ProductPageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params
  const product = await getProductById(id)

  if (!product) {
    return {
      title: 'Producto no disponible | Yarumo Coffee',
      description: 'El producto solicitado no está disponible.',
    }
  }

  const title = `${product.name} | Yarumo Coffee`
  const description =
    product.description ||
    'Disfruta de nuestros cafés especiales y delicias artesanales en Armenia, Quindío.'
  const imageUrl = product.image_url || `${SITE_URL}/yarumo-cover-cafe-og.webp`
  const pageUrl = `${SITE_URL}/producto/${product.id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: 'Yarumo Coffee',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: product.name,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    alternates: {
      canonical: pageUrl,
    },
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params
  const product = await getProductById(id)

  if (!product) {
    notFound()
  }

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
          initialItemId={product.id}
        />
        <VisitStrip />
      </main>
      <Footer />
    </>
  )
}
