import Header from '@/components/Header'
import Footer from '@/components/Footer'
import RecommendationForm from '@/components/RecommendationForm'
import { createPublicClient } from '@/lib/supabase/public'
import { GOOGLE_REVIEWS_URL } from '@/lib/site-url'
import type { Metadata } from 'next'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Opiniones y Recomendaciones · Yarumo Coffee',
  description: 'Lee las experiencias de nuestros clientes y déjanos tu opinión sobre el café y la atención en Yarumo Coffee Armenia.',
  alternates: {
    canonical: '/recomendaciones',
  },
}

type Recommendation = {
  id: string
  name: string
  rating: number
  comment: string
  table_number: string | null
  created_at: string
}

async function getPublishedRecommendations(): Promise<Recommendation[]> {
  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('recommendations')
      .select('id, name, rating, comment, table_number, created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(50)

    return (data || []) as Recommendation[]
  } catch {
    return []
  }
}

export default async function RecomendacionesPage() {
  const recommendations = await getPublishedRecommendations()

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 20px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <span className="eyebrow">Comunidad Yarumo</span>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', margin: '8px 0 12px' }}>
            Voces de nuestra mesa
          </h1>
          <p style={{ maxWidth: 560, margin: '0 auto', color: 'var(--text-muted)' }}>
            Cada visita escribe un capítulo. Cuéntanos qué sentiste al probar nuestro café o explora las impresiones de otros amantes del café especial.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 36, alignItems: 'start' }}>
          {/* Formulario interactivo en cliente */}
          <RecommendationForm />

          {/* Lista de recomendaciones renderizada en servidor */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: '1.4rem', margin: 0 }}>
                Opiniones recientes ({recommendations.length})
              </h2>
              <a
                href={GOOGLE_REVIEWS_URL}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '0.85rem', color: 'var(--orange)', fontWeight: 700 }}
              >
                Google Reviews ↗
              </a>
            </div>

            {recommendations.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', background: 'var(--surface-card)', borderRadius: 16, border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                Sé el primero en dejarnos tu opinión en esta mesa.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {recommendations.map((rec) => (
                  <article
                    key={rec.id}
                    style={{
                      background: 'var(--surface-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 16,
                      padding: 18,
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <strong style={{ fontSize: '1rem', display: 'block' }}>{rec.name}</strong>
                        {rec.table_number && (
                          <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            Mesa {rec.table_number}
                          </small>
                        )}
                      </div>
                      <div style={{ color: 'var(--orange)', fontSize: '0.9rem' }} aria-label={`${rec.rating} de 5 estrellas`}>
                        {'★'.repeat(rec.rating)}{'☆'.repeat(5 - rec.rating)}
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {rec.comment}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
