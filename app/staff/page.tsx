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

type AuthErrorNotice = {
  title: string
  message: string
}

function parseAuthError(): AuthErrorNotice | null {
  if (typeof window === 'undefined') return null

  const searchParams = new URLSearchParams(window.location.search)
  let errorParam = searchParams.get('error')
  let errorCode = searchParams.get('error_code')
  let errorDesc = searchParams.get('error_description')

  // Si no está en searchParams, buscar en el fragmento hash (#error=...)
  if (!errorParam && !errorCode && window.location.hash) {
    const hash = window.location.hash.replace(/^#/, '')
    const hashParams = new URLSearchParams(hash)
    errorParam = hashParams.get('error')
    errorCode = hashParams.get('error_code')
    errorDesc = hashParams.get('error_description')
  }

  if (!errorParam && !errorCode) return null

  if (
    errorCode === 'signup_disabled' ||
    errorDesc?.toLowerCase().includes('signup') ||
    errorDesc?.toLowerCase().includes('not allowed')
  ) {
    return {
      title: 'Usuario no identificado',
      message: 'Tu cuenta de Google no está registrada en el sistema de Yarumo Coffee. El administrador debe dar de alta tu correo antes de poder ingresar.',
    }
  }
  if (errorParam === 'not_authorized') {
    return {
      title: 'Usuario no autorizado',
      message: 'Tu correo de Google no tiene permisos de staff asignados en este panel.',
    }
  }
  if (errorParam === 'access_denied') {
    return {
      title: 'Usuario no identificado',
      message: 'Acceso denegado o no autorizado para esta cuenta. Consulta con el administrador.',
    }
  }
  if (errorParam === 'oauth_error') {
    return {
      title: 'Error de autenticación',
      message: 'No se pudo completar la conexión con Google. Intenta nuevamente.',
    }
  }

  const clean = errorDesc ? decodeURIComponent(errorDesc.replace(/\+/g, ' ')) : 'Usuario no identificado o sin permisos de acceso.'
  return {
    title: 'Usuario no identificado',
    message: clean,
  }
}

export default function StaffPage() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<string | null>(null)
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false)
  const [authErrorNotice, setAuthErrorNotice] = useState<AuthErrorNotice | null>(parseAuthError)
  const [error, setError] = useState<string>(() => {
    const initial = parseAuthError()
    return initial ? initial.message : ''
  })

  // Limpiar parámetros de error de la barra de direcciones
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasError =
        window.location.search.includes('error') ||
        window.location.hash.includes('error')
      if (hasError) {
        window.history.replaceState({}, '', '/staff')
      }
    }
  }, [])

  // Auto-descartar alerta flotante tras 14 segundos
  useEffect(() => {
    if (!authErrorNotice) return
    const timer = setTimeout(() => {
      setAuthErrorNotice(null)
    }, 14000)
    return () => clearTimeout(timer)
  }, [authErrorNotice])

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
    setAuthErrorNotice(null)
    setIsLoggingIn(true)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setIsLoggingIn(false)
    if (authError) {
      const msg = 'Correo o contraseña incorrectos.'
      setError(msg)
      setAuthErrorNotice({ title: 'Usuario no identificado', message: msg })
    } else {
      if (authData?.user) {
        setUser(authData.user.email || 'Staff')
      }
      await load()
    }
  }

  async function loginWithGoogle() {
    setError('')
    setAuthErrorNotice(null)
    setIsGoogleLoggingIn(true)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/staff`,
      },
    })
    if (oauthError) {
      setIsGoogleLoggingIn(false)
      const notice = {
        title: 'Error de conexión',
        message: 'No se pudo iniciar sesión con Google. Asegúrate de que el proveedor Google esté activo en Supabase.',
      }
      setError(notice.message)
      setAuthErrorNotice(notice)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
    setRole('')
  }

  if (!user) {
    return (
      <main className="login-page">
        {authErrorNotice && (
          <aside className="staff-alerts-container" style={{ zIndex: 999 }} aria-label="Notificaciones del sistema">
            <div
              className="staff-toast-item toast-type-error"
              role="alert"
              aria-live="assertive"
            >
              <div className="toast-icon">⚠️</div>
              <div className="toast-content">
                <strong className="toast-title">{authErrorNotice.title}</strong>
                <span className="toast-subtitle">{authErrorNotice.message}</span>
              </div>
              <button
                type="button"
                className="toast-close-btn"
                onClick={() => setAuthErrorNotice(null)}
                aria-label="Cerrar notificación"
              >
                ✕
              </button>
            </div>
          </aside>
        )}

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

            <button
              type="button"
              className="google-auth-button"
              onClick={loginWithGoogle}
              disabled={isGoogleLoggingIn || isLoggingIn}
            >
              <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isGoogleLoggingIn ? 'Conectando con Google…' : 'Continuar con Google'}</span>
            </button>

            <div className="login-divider">
              <span>o ingresa con tu correo</span>
            </div>

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
    <div className="staff">
      <StaffAlerts alerts={alerts} onAlertClick={() => setTab('activity')} onDismiss={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))} />

      <header className="staff-head">
        <div className="staff-brand-identity">
          <Image
            src="/yarumo-logo.webp"
            alt="Yarumo Coffee"
            width={48}
            height={48}
            className="staff-logo-img"
          />
          <div>
            <span className="staff-role-badge">
              <span className="role-dot" />
              Rol: {role || 'Staff'}
            </span>
            <h1>Yarumo Coffee</h1>
          </div>
        </div>

        <div className="staff-header-actions">
          {user && (
            <div className="staff-user-chip">
              <small>Sesión activa</small>
              <strong>{user}</strong>
            </div>
          )}
          <ThemeToggle />
          <button type="button" className="button-logout" onClick={logout}>
            Salir ↗
          </button>
        </div>
      </header>

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

      <main className="staff-main">
        {tab === 'activity' && (
          <ActivityTab
            orders={orders}
            requests={requests}
            tables={tables}
            items={items}
            categories={categories}
            onRefresh={load}
          />
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
