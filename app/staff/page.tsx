'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import StaffAlerts, { type StaffAlert } from '@/components/StaffAlerts'
import ThemeToggle from '@/components/ThemeToggle'
import type {
  Request,
  OrderRequest,
  MenuItem,
  MenuCategory,
  Promotion,
  CafeTable,
  RecommendationItem,
} from './types'

// Carga dividida de pestañas con next/dynamic para optimizar el bundle de Staff
const ActivityTab = dynamic(() => import('./tabs/ActivityTab'), {
  loading: () => <div className="tab-loading-skeleton">Cargando actividad...</div>,
})
const MenuTab = dynamic(() => import('./tabs/MenuTab'), {
  loading: () => <div className="tab-loading-skeleton">Cargando catálogo...</div>,
})
const CategoriesTab = dynamic(() => import('./tabs/CategoriesTab'), {
  loading: () => <div className="tab-loading-skeleton">Cargando categorías...</div>,
})
const PromotionsTab = dynamic(() => import('./tabs/PromotionsTab'), {
  loading: () => <div className="tab-loading-skeleton">Cargando promociones...</div>,
})
const QrTab = dynamic(() => import('./tabs/QrTab'), {
  loading: () => <div className="tab-loading-skeleton">Cargando códigos QR...</div>,
})
const RecommendationsTab = dynamic(() => import('./tabs/RecommendationsTab'), {
  loading: () => <div className="tab-loading-skeleton">Cargando opiniones...</div>,
})
const SettingsTab = dynamic(() => import('./tabs/SettingsTab'), {
  loading: () => <div className="tab-loading-skeleton">Cargando ajustes...</div>,
})
const UserAdmin = dynamic(() => import('@/components/UserAdmin'), {
  loading: () => <div className="tab-loading-skeleton">Cargando usuarios...</div>,
})
const HelpTab = dynamic(() => import('./tabs/HelpTab'), {
  loading: () => <div className="tab-loading-skeleton">Cargando centro de ayuda...</div>,
})

export default function StaffPage() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<string | null>(null)
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [error, setError] = useState('')

  // Listas de datos
  const [requests, setRequests] = useState<Request[]>([])
  const [orders, setOrders] = useState<OrderRequest[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([])
  const [tables, setTables] = useState<CafeTable[]>([])
  const [heroImageUrl, setHeroImageUrl] = useState('/yarumo-cover-cafe.webp')
  const [whatsappDeliveryNumber, setWhatsappDeliveryNumber] = useState('573192208938')

  // Pestaña activa
  const [tab, setTab] = useState<
    'activity' | 'menu' | 'categories' | 'promotions' | 'qr' | 'users' | 'recommendations' | 'settings' | 'help'
  >('activity')

  // Alertas / Toasts
  const [alerts, setAlerts] = useState<StaffAlert[]>([])

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session?.user) {
      setUser(null)
      setRole('')
      return
    }

    setUser(sessionData.session.user.email || 'Staff')

    // 1. Rol
    const roleRes = await supabase.rpc('get_my_role')
    if (roleRes.data) setRole(roleRes.data)

    // 2. Solicitudes de servicio
    const reqRes = await supabase
      .from('service_requests')
      .select('id, table_id, type, status, created_at, table:cafe_tables(label)')
      .order('created_at', { ascending: false })
      .limit(60)
    setRequests((reqRes.data || []) as unknown as Request[])

    // 3. Pedidos
    const ordRes = await supabase
      .from('order_requests')
      .select('id, table_id, status, notes, source, created_at, acknowledged_at, delivered_at, table:cafe_tables(label), items:order_request_items(id, name_snapshot, price_cop_snapshot, quantity, item_notes)')
      .order('created_at', { ascending: false })
      .limit(60)
    setOrders((ordRes.data || []) as unknown as OrderRequest[])

    // 4. Productos de menú
    const itemsRes = await supabase
      .from('menu_items')
      .select('id, name, slug, description, price_cop, category, category_id, available, sort_order, image_url, gallery_urls')
      .order('sort_order')
      .order('name')
    setItems((itemsRes.data || []) as MenuItem[])

    // 5. Categorías
    const catRes = await supabase
      .from('menu_categories')
      .select('id, name, slug, icon, sort_order, active, created_at')
      .order('sort_order')
    setCategories((catRes.data || []) as MenuCategory[])

    // 6. Promociones
    const promoRes = await supabase
      .from('promotions')
      .select('id, title, description, badge_text, image_url, linked_menu_item_id, starts_at, ends_at, active, sort_order')
      .order('sort_order')
    setPromotions((promoRes.data || []) as Promotion[])

    // 7. Mesas
    const tblRes = await supabase
      .from('cafe_tables')
      .select('id, label, public_token, active')
      .order('label')
    setTables((tblRes.data || []) as CafeTable[])

    // 8. Recomendaciones
    const recRes = await supabase
      .from('recommendations')
      .select('id, name, rating, comment, table_number, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    setRecommendations((recRes.data || []) as RecommendationItem[])

    // 9. Site settings
    const setRes = await supabase.from('site_settings').select('key, value')
    if (setRes.data) {
      const map = setRes.data.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {} as Record<string, string>)
      if (map['hero_image_url']) setHeroImageUrl(map['hero_image_url'])
      if (map['whatsapp_delivery_number']) setWhatsappDeliveryNumber(map['whatsapp_delivery_number'])
    }
  }, [supabase])

  useEffect(() => {
    let mounted = true
    void Promise.resolve().then(() => {
      if (mounted) void load()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (mounted && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        void load()
      }
    })

    // Realtime para solicitudes
    const serviceChannel = supabase
      .channel('staff-service-requests-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => {
        void load()
      })
      .subscribe()

    // Realtime para pedidos
    const orderChannel = supabase
      .channel('staff-orders-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_requests' }, () => {
        void load()
      })
      .subscribe()

    return () => {
      mounted = false
      subscription.unsubscribe()
      void supabase.removeChannel(serviceChannel)
      void supabase.removeChannel(orderChannel)
    }
  }, [supabase, load])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoggingIn(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setIsLoggingIn(false)
    if (authError) setError('Correo o contraseña incorrectos.')
    else await load()
  }

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
    setRole('')
  }

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="login-brand">
            <div className="login-logo-wrap">
              <Image src="/yarumo-logo.webp" alt="Yarumo Coffee" width={80} height={80} priority />
            </div>
            <span className="eyebrow">Yarumo Coffee · Armenia</span>
            <h1>El café también se <em>coordina.</em></h1>
            <p>Gestiona la actividad de tus mesas en tiempo real y atiende cada comanda con agilidad.</p>
          </div>

          <div className="login-form-panel">
            <div className="login-form-heading">
              <span className="eyebrow">Acceso del equipo</span>
              <h2>Bienvenido de nuevo</h2>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={login} className="login-form">
              <div>
                <label htmlFor="staff-email">Correo electrónico</label>
                <input
                  id="staff-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="barista@yarumocoffee.com"
                />
              </div>

              <div>
                <label htmlFor="staff-password">Contraseña</label>
                <input
                  id="staff-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                className="login-submit-button btn btn-primary btn-lg"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  'Iniciando sesión…'
                ) : (
                  <>
                    <span>Ingresar al Panel</span>
                    <span className="submit-arrow" aria-hidden="true">→</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </main>
    )
  }

  return (
    <div className="staff-container">
      <StaffAlerts alerts={alerts} onAlertClick={() => setTab('activity')} onDismiss={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))} />

      <header className="staff-header">
        <div className="staff-header-brand">
          <Image src="/yarumo-logo.webp" alt="Yarumo Coffee" width={38} height={38} />
          <div>
            <strong>Yarumo Coffee</strong>
            <span className="badge">Staff: {role || 'miembro'}</span>
          </div>
        </div>

        <nav className="staff-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'activity'} className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>
            Actividad ({orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length})
          </button>
          <button type="button" role="tab" aria-selected={tab === 'menu'} className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}>
            Menú ({items.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === 'categories'} className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}>
            Categorías ({categories.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === 'promotions'} className={tab === 'promotions' ? 'active' : ''} onClick={() => setTab('promotions')}>
            Promociones ({promotions.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === 'qr'} className={tab === 'qr' ? 'active' : ''} onClick={() => setTab('qr')}>
            Mesas y QR ({tables.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === 'recommendations'} className={tab === 'recommendations' ? 'active' : ''} onClick={() => setTab('recommendations')}>
            Opiniones ({recommendations.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === 'settings'} className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
            Ajustes
          </button>
          <button type="button" role="tab" aria-selected={tab === 'help'} className={tab === 'help' ? 'active' : ''} onClick={() => setTab('help')}>
            📖 Ayuda
          </button>
          {(role === 'owner' || role === 'manager') && (
            <button type="button" role="tab" aria-selected={tab === 'users'} className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
              Usuarios
            </button>
          )}
        </nav>

        <div className="staff-header-actions">
          <ThemeToggle />
          <button type="button" className="btn btn-outline btn-sm" onClick={logout}>
            Salir
          </button>
        </div>
      </header>

      <main className="staff-main">
        {tab === 'activity' && (
          <ActivityTab orders={orders} requests={requests} onRefresh={load} />
        )}
        {tab === 'menu' && (
          <MenuTab items={items} categories={categories} onRefresh={load} />
        )}
        {tab === 'categories' && (
          <CategoriesTab categories={categories} onRefresh={load} />
        )}
        {tab === 'promotions' && (
          <PromotionsTab promotions={promotions} items={items} onRefresh={load} />
        )}
        {tab === 'qr' && (
          <QrTab tables={tables} />
        )}
        {tab === 'recommendations' && (
          <RecommendationsTab recommendations={recommendations} onRefresh={load} />
        )}
        {tab === 'settings' && (
          <SettingsTab heroImageUrl={heroImageUrl} whatsappDeliveryNumber={whatsappDeliveryNumber} onRefresh={load} />
        )}
        {tab === 'help' && (
          <HelpTab />
        )}
        {tab === 'users' && (role === 'owner' || role === 'manager') && (
          <UserAdmin />
        )}
      </main>
    </div>
  )
}
