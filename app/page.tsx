import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import MenuExperience, { type MenuItem } from '@/components/MenuExperience'

// Server Component: the menu is fetched and rendered on the server so the HTML
// that reaches the phone already has the carta in it, instead of shipping an
// empty shell and waiting for a client-side useEffect to fetch it.
async function getInitialMenu(): Promise<MenuItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('menu_items')
    .select('id,name,description,price_cop,category,sort_order,image_url,gallery_urls')
    .eq('available', true)
    .order('sort_order')
    .order('name')
  return (data || []) as MenuItem[]
}

export default async function Home() {
  const initialMenu = await getInitialMenu()

  return (
    <>
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
          <a href="#visitanos">Visítanos</a>
        </nav>
        <a className="instagram-link" href="https://www.instagram.com/yarumocafearmenia/" target="_blank" rel="noreferrer">
          Instagram ↗
        </a>
      </header>

      <main id="inicio">
        <MenuExperience initialMenu={initialMenu} />

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
          <span>Yarumo Coffee · Hecho para quedarse un rato.</span>
          <span>
            <a href="https://www.google.com/search?q=Yarumo+Coffee+Armenia" target="_blank" rel="noreferrer">
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
