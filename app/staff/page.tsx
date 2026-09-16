'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import UserAdmin from '@/components/UserAdmin'
import { SITE_URL as PUBLIC_MENU_URL } from '@/lib/site-url'

type Request = { id: string; type: 'waiter' | 'bill'; status: string; created_at: string; table: { label: string } | null }
type CafeTable = { id: string; label: string; public_token: string; active: boolean }
type RecommendationItem = { id: string; name: string; rating: number; comment: string; table_number: string | null; created_at: string }
type MenuItem = {
  id: string
  name: string
  slug: string
  description: string
  price_cop: number
  category: string
  available: boolean
  sort_order: number
  image_url: string | null
  gallery_urls: string[]
}
type MenuForm = {
  name: string
  slug: string
  description: string
  price_cop: number
  category: string
  available: boolean
  sort_order: number
  image_url: string
  gallery_urls: string
}
const blank: MenuForm = {
  name: '',
  slug: '',
  description: '',
  price_cop: 0,
  category: 'Bebidas Calientes',
  available: true,
  sort_order: 0,
  image_url: '',
  gallery_urls: '',
}

export default function Staff() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<string | null>(null)
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false)
  const [error, setError] = useState(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('error') === 'oauth_error') {
      return 'Error en la autenticación con Google. Intenta nuevamente.'
    }
    return ''
  })
  const [requests, setRequests] = useState<Request[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([])
  const [tab, setTab] = useState<'requests' | 'menu' | 'qr' | 'users' | 'recommendations'>('requests')
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [form, setForm] = useState<MenuForm>(blank)
  const [menuQuery, setMenuQuery] = useState('')
  const [menuCategory, setMenuCategory] = useState('Todas')
  const [menuStatus, setMenuStatus] = useState('Todos')
  const [tables, setTables] = useState<CafeTable[]>([])
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({})
  const [qrLoading, setQrLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [galleryFiles, setGalleryFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()
    setUser(currentUser?.email || null)
    if (!currentUser) return

    const profile = await supabase.from('staff_profiles').select('role').eq('user_id', currentUser.id).maybeSingle()
    setRole(profile.data?.role || 'staff')

    const rq = await supabase
      .from('service_requests')
      .select('id,type,status,created_at,table:cafe_tables(label)')
      .in('status', ['pending', 'acknowledged'])
      .order('created_at', { ascending: false })
    setRequests((rq.data || []) as unknown as Request[])

    const menu = await supabase
      .from('menu_items')
      .select('id,name,slug,description,price_cop,category,available,sort_order,image_url,gallery_urls')
      .order('sort_order')
      .order('name')
    setItems((menu.data || []) as MenuItem[])

    const cafeTables = await supabase.from('cafe_tables').select('id,label,public_token,active').order('label')
    const loadedTables = (cafeTables.data || []) as CafeTable[]
    setTables(loadedTables)
    setQrLoading(true)
    const generated = await Promise.all(
      loadedTables.map(async (cafeTable) => {
        const url = `${PUBLIC_MENU_URL.replace(/\/$/, '')}/?mesa=${encodeURIComponent(cafeTable.public_token)}`
        const dataUrl = await QRCode.toDataURL(url, {
          width: 720,
          margin: 3,
          errorCorrectionLevel: 'M',
          color: { dark: '#18362f', light: '#fffaf2' },
        })
        return [cafeTable.id, dataUrl] as const
      }),
    )
    setQrCodes(Object.fromEntries(generated))
    setQrLoading(false)

    const recs = await supabase.from('recommendations').select('id,name,rating,comment,table_number,created_at').order('created_at', { ascending: false })
    setRecommendations((recs.data || []) as RecommendationItem[])
  }, [supabase])

  useEffect(() => {
    let active = true
    async function init() {
      if (!active) return
      await load()
    }
    void init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (active && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        void load()
      }
    })

    const channel = supabase
      .channel('staff-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => {
        if (active) void load()
      })
      .subscribe()

    return () => {
      active = false
      subscription.unsubscribe()
      void supabase.removeChannel(channel)
    }
  }, [load, supabase])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoggingIn(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setIsLoggingIn(false)
    if (authError) setError('Correo o contraseña incorrectos.')
    else await load()
  }

  async function loginWithGoogle() {
    setError('')
    setIsGoogleLoggingIn(true)
    const origin = typeof window !== 'undefined' ? window.location.origin : PUBLIC_MENU_URL.replace(/\/$/, '')
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback?next=/staff`,
      },
    })
    if (oauthError) {
      setIsGoogleLoggingIn(false)
      setError('No se pudo iniciar sesión con Google. Asegúrate de que el proveedor Google esté activo en Supabase.')
    }
  }

  async function logout() {
    setError('')
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      setError('No se pudo cerrar la sesión. Intenta nuevamente.')
      return
    }
    setUser(null)
    setRole('')
    setTab('requests')
    setRequests([])
    setItems([])
    setTables([])
    setQrCodes({})
  }

  async function complete(id: string) {
    await supabase.from('service_requests').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', id)
    await load()
  }

  async function removeRecommendation(id: string) {
    if (!confirm('¿Eliminar esta recomendación?')) return
    await supabase.from('recommendations').delete().eq('id', id)
    await load()
  }

  const menuFormRef = useRef<HTMLFormElement>(null)

  function scrollToMenuForm() {
    setTimeout(() => {
      menuFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  function edit(item: MenuItem) {
    setEditing(item)
    setForm({ ...item, image_url: item.image_url || '', gallery_urls: (item.gallery_urls || []).join('\n') })
    setImageFile(null)
    setGalleryFiles([])
    scrollToMenuForm()
  }

  function newItem() {
    setEditing(null)
    setForm(blank)
    setImageFile(null)
    setGalleryFiles([])
    scrollToMenuForm()
  }

  const menuCategories = Array.from(new Set(items.map((item) => item.category))).sort((a, b) => a.localeCompare(b, 'es'))
  const filteredAdminItems = items.filter((item) => {
    const normalizedQuery = menuQuery.trim().toLowerCase()
    const matchesQuery = !normalizedQuery || `${item.name} ${item.description}`.toLowerCase().includes(normalizedQuery)
    const matchesCategory = menuCategory === 'Todas' || item.category === menuCategory
    const matchesStatus = menuStatus === 'Todos' || (menuStatus === 'Visibles' ? item.available : !item.available)
    return matchesQuery && matchesCategory && matchesStatus
  })

  async function saveItem(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || form.price_cop < 0) {
      setError('Completa un nombre y un precio válido.')
      return
    }
    setSaving(true)
    setError('')
    let imageUrl = form.image_url.trim() || null
    let galleryUrls = form.gallery_urls.split(/[\n,]/).map((url) => url.trim()).filter(Boolean)
    if (imageFile || galleryFiles.length) {
      const filesToUpload = imageFile ? [imageFile, ...galleryFiles] : galleryFiles
      const uploadedUrls: string[] = []
      for (const file of filesToUpload) {
        if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
          setSaving(false)
          setError('Las imágenes deben ser JPG, PNG o WebP y pesar máximo 5 MB.')
          return
        }
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${crypto.randomUUID()}.${extension}`
        const upload = await supabase.storage.from('menu-images').upload(path, file, { cacheControl: '31536000', contentType: file.type, upsert: false })
        if (upload.error) {
          setSaving(false)
          setError('No se pudo cargar la imagen. Verifica el bucket menu-images en Supabase.')
          return
        }
        uploadedUrls.push(supabase.storage.from('menu-images').getPublicUrl(path).data.publicUrl)
      }
      if (imageFile) {
        imageUrl = uploadedUrls.shift() || imageUrl
      }
      galleryUrls = [...galleryUrls, ...uploadedUrls]
    }
    const payload = {
      name: form.name.trim(),
      slug:
        form.slug.trim() ||
        form.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, ''),
      description: form.description.trim(),
      price_cop: Number(form.price_cop),
      category: form.category,
      available: form.available,
      sort_order: Number(form.sort_order) || 0,
      image_url: imageUrl,
      gallery_urls: galleryUrls,
    }
    const result = editing
      ? await supabase.from('menu_items').update(payload).eq('id', editing.id)
      : await supabase.from('menu_items').insert(payload)
    setSaving(false)
    if (result.error) {
      setError(result.error.message.includes('duplicate') ? 'El slug ya existe. Usa otro.' : 'No se pudo guardar el producto.')
      return
    }
    newItem()
    await load()
  }

  async function removeItem(item: MenuItem) {
    if (!confirm(`¿Eliminar ${item.name}?`)) return
    const { error: delError } = await supabase.from('menu_items').delete().eq('id', item.id)
    if (delError) setError('No se pudo eliminar. Puede haber referencias activas.')
    else await load()
  }

  function downloadQr(cafeTable: CafeTable) {
    const dataUrl = qrCodes[cafeTable.id]
    if (!dataUrl) return
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `yarumo-coffee-mesa-${cafeTable.label}.png`
    link.click()
  }

  function downloadAllQrs() {
    tables.filter((cafeTable) => cafeTable.active && qrCodes[cafeTable.id]).forEach((cafeTable, index) => {
      window.setTimeout(() => downloadQr(cafeTable), index * 180)
    })
  }

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="login-brand">
            <div className="login-logo-wrap">
              <Image src="/yarumo-logo.webp" alt="Yarumo Coffee" width={96} height={96} />
            </div>
            <span className="eyebrow">Yarumo Coffee · Armenia</span>
            <h1>
              El café también se <em>coordina.</em>
            </h1>
            <p>Gestiona las solicitudes de tus mesas y mantén la carta siempre lista para tus clientes.</p>
            <div className="login-points">
              <span>
                <b>01</b> Atención en tiempo real
              </span>
              <span>
                <b>02</b> Carta actualizada
              </span>
            </div>
          </div>
          <div className="login-form-panel">
            <div className="login-form-heading">
              <span className="eyebrow">Acceso del equipo</span>
              <h2>Bienvenido de nuevo</h2>
              <p>Ingresa con tus credenciales para continuar.</p>
            </div>

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

            <form onSubmit={login}>
              <label htmlFor="staff-email">Correo del equipo</label>
              <input
                id="staff-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@yarumocoffee.com"
                autoComplete="email"
                required
              />

              <label htmlFor="staff-password">Contraseña</label>
              <div className="password-input-wrap">
                <input
                  id="staff-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    /* Ojo cerrado / ocultar */
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    /* Ojo abierto / ver */
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              <button className="login-submit-button" type="submit" disabled={isLoggingIn || isGoogleLoggingIn}>
                <span>{isLoggingIn ? 'Verificando acceso…' : 'Entrar al panel'}</span>
                {!isLoggingIn && <span className="submit-arrow" aria-hidden="true">→</span>}
              </button>
            </form>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <small className="login-note">Acceso exclusivo para el equipo Yarumo.</small>
          </div>
        </section>
      </main>
    )
  }

  const canManage = role === 'owner' || role === 'manager'
  return (
    <main className="staff">
      <div className="staff-head">
        <div>
          <span className="eyebrow">Operación en mesa</span>
          <h1>
            Panel <em>Yarumo.</em>
          </h1>
        </div>
        <button className="button" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
      <nav className="staff-tabs">
        <button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>
          Solicitudes ({requests.length})
        </button>
        {canManage && (
          <>
            <button className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}>
              Menú ({items.length})
            </button>
            <button className={tab === 'qr' ? 'active' : ''} onClick={() => setTab('qr')}>
              QR por mesa
            </button>
            <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
              Usuarios
            </button>
            <button className={tab === 'recommendations' ? 'active' : ''} onClick={() => setTab('recommendations')}>
              Recomendaciones ({recommendations.length})
            </button>
          </>
        )}
      </nav>
      {error && <p className="admin-error">{error}</p>}
      {tab === 'requests' ? (
        <>
          <div className="stats">
            <div className="stat">
              <span>Pendientes</span>
              <strong>{requests.length}</strong>
            </div>
            <div className="stat">
              <span>Mesas activas</span>
              <strong>{new Set(requests.map((r) => r.table?.label)).size}</strong>
            </div>
            <div className="stat">
              <span>Sesión</span>
              <strong>OK</strong>
            </div>
          </div>
          <div className="request-list">
            {requests.length ? (
              requests.map((r) => (
                <article className="request" key={r.id}>
                  <div>
                    <strong>
                      Mesa {r.table?.label || '—'} · {r.type === 'waiter' ? 'Llamar al mesero' : 'Pedir la cuenta'}
                    </strong>
                    <small>
                      {new Date(r.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </small>
                  </div>
                  <button className="button" onClick={() => complete(r.id)}>
                    Atendida
                  </button>
                </article>
              ))
            ) : (
              <div className="request">No hay solicitudes pendientes.</div>
            )}
          </div>
        </>
      ) : tab === 'menu' ? (
        <section className="menu-admin">
          <div className="menu-admin-head">
            <div>
              <span className="eyebrow">Catálogo</span>
              <h2>Gestiona la carta.</h2>
            </div>
            <button className="button" onClick={newItem}>
              + Nuevo producto
            </button>
          </div>
          <div className="menu-admin-filters">
            <label className="menu-search-field">
              <span>Buscar producto</span>
              <input value={menuQuery} onChange={(e) => setMenuQuery(e.target.value)} placeholder="Nombre o descripción" />
            </label>
            <label>
              <span>Categoría</span>
              <select value={menuCategory} onChange={(e) => setMenuCategory(e.target.value)}>
                <option>Todas</option>
                {menuCategories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label>
              <span>Estado</span>
              <select value={menuStatus} onChange={(e) => setMenuStatus(e.target.value)}>
                <option>Todos</option>
                <option>Visibles</option>
                <option>Ocultos</option>
              </select>
            </label>
            {(menuQuery || menuCategory !== 'Todas' || menuStatus !== 'Todos') && <button className="clear-menu-filters" type="button" onClick={() => { setMenuQuery(''); setMenuCategory('Todas'); setMenuStatus('Todos') }}>Limpiar filtros</button>}
          </div>
          <div className="menu-admin-grid">
            <div className="admin-list">
              {filteredAdminItems.map((item) => (
                <article className={`admin-item ${!item.available ? 'unavailable' : ''}`} key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {item.category} · ${item.price_cop.toLocaleString('es-CO')} · {item.available ? 'Visible' : 'Oculto'}
                    </small>
                  </div>
                  <div>
                    {item.image_url && <span className="has-photo">Foto ✓</span>}
                    <button onClick={() => edit(item)}>Editar</button>
                    <button onClick={() => removeItem(item)}>Eliminar</button>
                  </div>
                  </article>
              ))}
              {!filteredAdminItems.length && <div className="request menu-empty">No hay productos que coincidan con los filtros.</div>}
            </div>
            <form ref={menuFormRef} className={`menu-form ${editing ? 'is-editing' : ''}`} onSubmit={saveItem}>
              <h3>{editing ? 'Editar producto' : 'Nuevo producto'}</h3>
              <label htmlFor="menu-name">Nombre del producto</label>
              <input id="menu-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Cappuccino" required />
              <label htmlFor="menu-slug">Slug web <span>(opcional)</span></label>
              <input id="menu-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="cappuccino" />
              <label htmlFor="menu-description">Descripción</label>
              <textarea id="menu-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe brevemente el producto" maxLength={500} />
              <label htmlFor="menu-price">Precio en pesos colombianos</label>
              <input id="menu-price" type="number" min="0" value={form.price_cop} onChange={(e) => setForm({ ...form, price_cop: Number(e.target.value) })} placeholder="8000" required />
              <label htmlFor="menu-main-image">Foto principal</label>
              <input id="menu-main-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              <small className="field-help">JPG, PNG o WebP. Máximo 5 MB.{form.image_url && !imageFile ? ' La foto actual se conservará.' : ''}</small>
              <label htmlFor="menu-gallery-images">Fotos adicionales</label>
              <input id="menu-gallery-images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setGalleryFiles(Array.from(e.target.files || []))} />
              <small className="field-help">Puedes seleccionar varias fotos a la vez.{form.gallery_urls && !galleryFiles.length ? ' Las fotos actuales se conservarán.' : ''}</small>
              <label htmlFor="menu-category">Categoría</label>
              <select id="menu-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option>Bebidas Calientes</option>
                <option>Bebidas Frías</option>
                <option>Gaseosas</option>
                <option>Cervezas</option>
                <option>Antojitos Panaderos</option>
                <option>Sándwiches</option>
                <option>Tortas y Brownies</option>
                <option>Hojaldrados</option>
                <option>Pizzetas</option>
                <option>Otros</option>
              </select>
              <label htmlFor="menu-order">Orden de aparición</label>
              <input id="menu-order" type="number" min="0" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} placeholder="0" />
              <label>
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={(e) => setForm({ ...form, available: e.target.checked })}
                />{' '}
                Visible en la carta
              </label>
              <div>
                <button type="submit" className="button" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar producto'}
                </button>
                {editing && (
                  <button type="button" onClick={newItem}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>
      ) : tab === 'qr' ? (
        <section className="qr-admin">
          <div className="qr-admin-head">
            <div>
              <span className="eyebrow">Experiencia en mesa</span>
              <h2>Descarga tus QR.</h2>
              <p>Cada código abre la carta y conecta las solicitudes con su mesa.</p>
            </div>
            <button className="button" onClick={downloadAllQrs} disabled={qrLoading || !tables.some((cafeTable) => cafeTable.active)}>
              {qrLoading ? 'Generando…' : 'Descargar todos'}
            </button>
          </div>
          <div className="qr-grid">
            {tables.filter((cafeTable) => cafeTable.active).map((cafeTable) => (
              <article className="qr-card" key={cafeTable.id}>
                <div className="qr-image-wrap">
                  {qrCodes[cafeTable.id] ? (
                    // Generated `data:` URL QR code, not a remote/static asset — next/image
                    // offers no optimization benefit here, so plain <img> is intentional.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrCodes[cafeTable.id]} alt={`Código QR de la mesa ${cafeTable.label}`} />
                  ) : (
                    <span>Generando QR…</span>
                  )}
                </div>
                <div className="qr-card-info">
                  <span className="eyebrow">Código activo</span>
                  <h3>Mesa {cafeTable.label}</h3>
                  <p>Escanea para abrir la carta y pedir atención.</p>
                  <button className="button" onClick={() => downloadQr(cafeTable)} disabled={!qrCodes[cafeTable.id]}>
                    Descargar PNG ↓
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!tables.some((cafeTable) => cafeTable.active) && <div className="request">No hay mesas activas configuradas.</div>}
        </section>
      ) : tab === 'recommendations' ? (
        <section className="menu-admin">
          <div className="menu-admin-head">
            <div>
              <span className="eyebrow">Opiniones</span>
              <h2>Recomendaciones de clientes.</h2>
            </div>
          </div>
          <div className="admin-list">
            {recommendations.map((rec) => (
              <article className="admin-item" key={rec.id}>
                <div>
                  <strong>{rec.name} {rec.table_number ? `(Mesa ${rec.table_number})` : ''} · {'★'.repeat(rec.rating)}</strong>
                  <p style={{ margin: '6px 0', fontSize: '13px', fontStyle: 'italic' }}>“{rec.comment}”</p>
                  <small>{new Date(rec.created_at).toLocaleString('es-CO')}</small>
                </div>
                <div>
                  <button onClick={() => removeRecommendation(rec.id)}>Eliminar</button>
                </div>
              </article>
            ))}
            {!recommendations.length && <div className="request menu-empty">No hay recomendaciones registradas.</div>}
          </div>
        </section>
      ) : (
        <UserAdmin />
      )}
    </main>
  )
}
