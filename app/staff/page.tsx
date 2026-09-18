'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import UserAdmin from '@/components/UserAdmin'
import StaffAlerts, { type StaffAlert } from '@/components/StaffAlerts'
import ThemeToggle from '@/components/ThemeToggle'
import { SITE_URL as PUBLIC_MENU_URL } from '@/lib/site-url'

function subscribeClock(callback: () => void) {
  const timer = setInterval(callback, 30000)
  return () => clearInterval(timer)
}
const getClockSnapshot = () => Date.now()
const getClockServerSnapshot = () => 0


type Request = {
  id: string
  table_id: string
  type: 'waiter' | 'bill'
  status: string
  created_at: string
  table: { label: string } | null
}

type OrderRequestItem = {
  id: string
  name_snapshot: string
  price_cop_snapshot: number
  quantity: number
  item_notes: string
}

type OrderRequest = {
  id: string
  table_id: string
  status: 'pending' | 'acknowledged' | 'preparing' | 'delivered' | 'cancelled'
  notes: string
  source?: 'customer' | 'staff'
  created_at: string
  acknowledged_at: string | null
  delivered_at: string | null
  table: { label: string } | null
  items: OrderRequestItem[]
}

type MenuCategory = {
  id: string
  name: string
  slug?: string
  icon: string
  sort_order: number
  active: boolean
  created_at?: string
}

type Promotion = {
  id: string
  title: string
  description: string
  badge_text: string | null
  image_url: string | null
  linked_menu_item_id: string | null
  starts_at: string
  ends_at: string | null
  active: boolean
  sort_order: number
}

type CafeTable = {
  id: string
  label: string
  public_token: string
  active: boolean
}

type RecommendationItem = {
  id: string
  name: string
  rating: number
  comment: string
  table_number: string | null
  status: 'published' | 'pending' | 'hidden'
  created_at: string
}

type MenuItem = {
  id: string
  name: string
  slug: string
  description: string
  price_cop: number
  category: string
  category_id?: string | null
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
  category_id?: string
  available: boolean
  sort_order: number
  image_url: string
  gallery_urls: string
}

const blankMenuForm: MenuForm = {
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

type CategoryForm = {
  name: string
  slug: string
  icon: string
  sort_order: number
  active: boolean
}

const blankCategoryForm: CategoryForm = {
  name: '',
  slug: '',
  icon: '☕',
  sort_order: 0,
  active: true,
}

function toLocalDatetimeInput(isoStr?: string | null): string {
  if (!isoStr) return ''
  const date = new Date(isoStr)
  if (isNaN(date.getTime())) return ''
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

type PromotionForm = {
  title: string
  description: string
  badge_text: string
  linked_menu_item_id: string
  starts_at: string
  ends_at: string
  active: boolean
  sort_order: number
}

const blankPromotionForm: PromotionForm = {
  title: '',
  description: '',
  badge_text: 'PROMO DEL DÍA',
  linked_menu_item_id: '',
  starts_at: toLocalDatetimeInput(new Date().toISOString()),
  ends_at: '',
  active: true,
  sort_order: 0,
}

function formatCop(value?: number | null) {
  const safe = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(safe)
}

function playNotificationChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15) // A5
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    // Silent fallback
  }
}

function triggerBrowserNotification(title: string, body: string) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/yarumo-icon-180.png',
      })
    } catch {
      // Silent fallback
    }
  }
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
    if (typeof window !== 'undefined') {
      const errParam = new URLSearchParams(window.location.search).get('error')
      if (errParam === 'oauth_error') {
        return 'Error en la autenticación con Google. Intenta nuevamente.'
      }
      if (errParam === 'not_authorized') {
        return 'Tu cuenta de correo no está autorizada para acceder al panel de staff. Contacta al administrador.'
      }
    }
    return ''
  })

  // Listas de datos
  const [requests, setRequests] = useState<Request[]>([])
  const [orders, setOrders] = useState<OrderRequest[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([])
  const [tables, setTables] = useState<CafeTable[]>([])
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({})
  const [qrLoading, setQrLoading] = useState(false)

  // Tabs
  const [tab, setTab] = useState<
    'activity' | 'menu' | 'categories' | 'promotions' | 'qr' | 'users' | 'recommendations' | 'settings'
  >('activity')

  // Portada / Hero del homepage
  const [heroImageUrl, setHeroImageUrl] = useState('/yarumo-cover-cafe.webp')
  const [heroImageInput, setHeroImageInput] = useState('/yarumo-cover-cafe.webp')
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null)
  const [heroSaving, setHeroSaving] = useState(false)
  const [heroSuccess, setHeroSuccess] = useState('')

  // Filtro de actividad
  const [activityFilter, setActivityFilter] = useState<'all' | 'orders' | 'requests'>('all')
  const [highlightedTable, setHighlightedTable] = useState<string | null>(null)

  // Alertas / Toasts
  const [alerts, setAlerts] = useState<StaffAlert[]>([])

  // Modal Toma Manual de Pedido
  const [manualOrderTable, setManualOrderTable] = useState<CafeTable | null>(null)
  const [manualCart, setManualCart] = useState<Array<{ item: MenuItem; quantity: number; notes: string }>>([])
  const [manualNotes, setManualNotes] = useState('')
  const [manualQuery, setManualQuery] = useState('')
  const [manualCategory, setManualCategory] = useState('Todas')
  const [manualSubmitting, setManualSubmitting] = useState(false)

  // Formularios
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [form, setForm] = useState<MenuForm>(blankMenuForm)
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null)
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(blankCategoryForm)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [promotionForm, setPromotionForm] = useState<PromotionForm>(blankPromotionForm)

  // Filtros de menú
  const [menuQuery, setMenuQuery] = useState('')
  const [menuCategory, setMenuCategory] = useState('Todas')
  const [menuStatus, setMenuStatus] = useState('Todos')

  // Archivos de imagen
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [galleryFiles, setGalleryFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const currentTime = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockServerSnapshot)

  // Solicitar permisos de notificación en navegador
  useEffect(() => {
    if (user && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        void Notification.requestPermission()
      }
    }
  }, [user])

  const load = useCallback(async () => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()
    setUser(currentUser?.email || null)
    if (!currentUser) return

    const profile = await supabase
      .from('staff_profiles')
      .select('role')
      .eq('user_id', currentUser.id)
      .maybeSingle()
    setRole(profile.data?.role || 'staff')

    // 1. Solicitudes de servicio (mesero / cuenta)
    const rq = await supabase
      .from('service_requests')
      .select('id,table_id,type,status,created_at,table:cafe_tables(label)')
      .in('status', ['pending', 'acknowledged'])
      .order('created_at', { ascending: false })
    setRequests((rq.data || []) as unknown as Request[])

    // 2. Pedidos a la mesa (comandas)
    const ords = await supabase
      .from('order_requests')
      .select(`
        id,
        table_id,
        status,
        notes,
        source,
        created_at,
        acknowledged_at,
        delivered_at,
        table:cafe_tables(label),
        items:order_request_items(
          id,
          name_snapshot,
          price_cop_snapshot,
          quantity,
          item_notes
        )
      `)
      .in('status', ['pending', 'acknowledged', 'preparing'])
      .order('created_at', { ascending: false })
    setOrders((ords.data || []) as unknown as OrderRequest[])

    // 3. Categorías dinámicas
    const cats = await supabase
      .from('menu_categories')
      .select('id,name,slug,icon,sort_order,active,created_at')
      .order('sort_order')
      .order('name')
    setCategories((cats.data || []) as MenuCategory[])

    // 4. Promociones
    const promos = await supabase
      .from('promotions')
      .select('id,title,description,badge_text,image_url,linked_menu_item_id,starts_at,ends_at,active,sort_order')
      .order('sort_order')
      .order('created_at', { ascending: false })
    setPromotions((promos.data || []) as Promotion[])

    // 5. Menú
    const menu = await supabase
      .from('menu_items')
      .select('id,name,slug,description,price_cop,category,category_id,available,sort_order,image_url,gallery_urls')
      .order('sort_order')
      .order('name')
    setItems((menu.data || []) as MenuItem[])

    // 6. Mesas y QR
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

    // 7. Recomendaciones (incluyendo pendientes)
    const recs = await supabase
      .from('recommendations')
      .select('id,name,rating,comment,table_number,status,created_at')
      .order('created_at', { ascending: false })
    setRecommendations((recs.data || []) as RecommendationItem[])

    // 8. Configuración del sitio / Foto de portada
    const settingsRes = await supabase
      .from('site_settings')
      .select('key,value')
      .eq('key', 'hero_image_url')
      .maybeSingle()
    if (settingsRes.data?.value) {
      setHeroImageUrl(settingsRes.data.value)
      setHeroImageInput(settingsRes.data.value)
    }
  }, [supabase])

  useEffect(() => {
    let active = true
    async function init() {
      if (!active) return
      await load()
    }
    void init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (active && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        void load()
      }
    })

    // Realtime para solicitudes de servicio
    const serviceChannel = supabase
      .channel('staff-service-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests' },
        (payload) => {
          if (!active) return

          if (payload.eventType === 'INSERT') {
            const newReq = payload.new as { id: string; type: 'waiter' | 'bill'; table_id: string }
            playNotificationChime()
            // Resolver etiqueta de mesa si está cargada
            const tbl = tables.find((t) => t.id === newReq.table_id)
            const tableLabel = tbl?.label || 'Mesa'
            const title =
              newReq.type === 'waiter'
                ? `🛎️ Mesa ${tableLabel} llama al mesero`
                : `🧾 Mesa ${tableLabel} pide la cuenta`
            const subtitle = 'Toca para atender la solicitud'

            setAlerts((prev) => [
              {
                id: crypto.randomUUID(),
                sourceId: newReq.id,
                type: newReq.type,
                tableLabel,
                title,
                subtitle,
                createdAt: Date.now(),
              },
              ...prev,
            ])

            triggerBrowserNotification('Yarumo Coffee · Atención en mesa', title)
          } else if (payload.eventType === 'UPDATE') {
            // Auto-cerrar toast si la solicitud fue resuelta
            const updated = payload.new as { id: string; status: string }
            if (updated.status === 'done' || updated.status === 'cancelled') {
              setAlerts((prev) => prev.filter((a) => a.sourceId !== updated.id))
            }
          }

          void load()
        },
      )
      .subscribe()

    // Realtime para pedidos
    const orderChannel = supabase
      .channel('staff-order-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_requests' },
        (payload) => {
          if (!active) return

          if (payload.eventType === 'INSERT') {
            const newOrd = payload.new as { id: string; table_id: string; source: string }
            playNotificationChime()
            const tbl = tables.find((t) => t.id === newOrd.table_id)
            const tableLabel = tbl?.label || 'Mesa'
            const title = `🛍️ Nueva comanda · Mesa ${tableLabel}`
            const subtitle = newOrd.source === 'staff' ? 'Tomada por el mesero' : 'Pedida por el cliente'

            setAlerts((prev) => [
              {
                id: crypto.randomUUID(),
                sourceId: newOrd.id,
                type: 'order',
                tableLabel,
                title,
                subtitle,
                createdAt: Date.now(),
              },
              ...prev,
            ])

            triggerBrowserNotification('Yarumo Coffee · Nuevo pedido', `${title} (${subtitle})`)
          } else if (payload.eventType === 'UPDATE') {
            // Auto-cerrar toast si la comanda fue entregada o cancelada
            const updated = payload.new as { id: string; status: string }
            if (updated.status === 'delivered' || updated.status === 'cancelled') {
              setAlerts((prev) => prev.filter((a) => a.sourceId !== updated.id))
            }
          }

          void load()
        },
      )
      .subscribe()

    return () => {
      active = false
      subscription.unsubscribe()
      void supabase.removeChannel(serviceChannel)
      void supabase.removeChannel(orderChannel)
    }
  }, [load, supabase, tables])

  // Click en toast de alerta
  function handleAlertClick(alert: StaffAlert) {
    setTab('activity')
    setHighlightedTable(alert.tableLabel)
    setAlerts((prev) => prev.filter((a) => a.id !== alert.id))

    setTimeout(() => {
      const el = document.getElementById(`table-card-${alert.tableLabel}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 80)

    setTimeout(() => {
      setHighlightedTable(null)
    }, 2800)
  }

  function dismissAlert(alertId: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId))
  }

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
    const canonicalOrigin = PUBLIC_MENU_URL.replace(/\/$/, '')
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${canonicalOrigin}/auth/callback?next=/staff`,
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
    setTab('activity')
    setRequests([])
    setOrders([])
    setItems([])
    setCategories([])
    setPromotions([])
    setTables([])
    setQrCodes({})
    setAlerts([])
  }

  // Acciones de Solicitudes de servicio
  async function completeRequest(id: string) {
    await supabase
      .from('service_requests')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', id)
    setAlerts((prev) => prev.filter((a) => a.sourceId !== id))
    await load()
  }

  // Acciones de Pedidos
  async function updateOrderStatus(
    id: string,
    newStatus: 'acknowledged' | 'preparing' | 'delivered' | 'cancelled',
  ) {
    const updates: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'acknowledged') updates.acknowledged_at = new Date().toISOString()
    if (newStatus === 'delivered') updates.delivered_at = new Date().toISOString()

    await supabase.from('order_requests').update(updates).eq('id', id)
    if (newStatus === 'delivered' || newStatus === 'cancelled') {
      setAlerts((prev) => prev.filter((a) => a.sourceId !== id))
    }
    await load()
  }

  // Moderación de Recomendaciones
  async function updateRecommendationStatus(id: string, status: 'published' | 'hidden') {
    await supabase.from('recommendations').update({ status }).eq('id', id)
    await load()
  }

  async function removeRecommendation(id: string) {
    if (!confirm('¿Eliminar esta recomendación?')) return
    await supabase.from('recommendations').delete().eq('id', id)
    await load()
  }

  // Toma manual de pedidos
  function openManualOrder(tableItem?: CafeTable | null) {
    let targetTable = tableItem
    if (!targetTable) {
      targetTable = tables.find((t) => t.active) || tables[0] || null
    }
    if (!targetTable) {
      setError('No hay mesas disponibles para registrar un pedido.')
      return
    }
    setManualOrderTable(targetTable)
    setManualCart([])
    setManualNotes('')
    setManualQuery('')
    setManualCategory('Todas')
  }

  function addManualProduct(item: MenuItem) {
    if (!item || !item.id) return
    setManualCart((prev) => {
      const exists = prev.find((ci) => ci.item?.id === item.id)
      if (exists) {
        return prev.map((ci) =>
          ci.item?.id === item.id ? { ...ci, quantity: Math.min((ci.quantity || 1) + 1, 20) } : ci,
        )
      }
      return [...prev, { item, quantity: 1, notes: '' }]
    })
  }

  function updateManualQty(itemId: string, delta: number) {
    setManualCart((prev) =>
      prev
        .map((ci) => {
          if (ci.item?.id === itemId) {
            const next = (ci.quantity || 1) + delta
            return next > 0 ? { ...ci, quantity: Math.min(next, 20) } : null
          }
          return ci
        })
        .filter(Boolean) as Array<{ item: MenuItem; quantity: number; notes: string }>,
    )
  }

  function updateManualItemNotes(itemId: string, notes: string) {
    setManualCart((prev) => prev.map((ci) => (ci.item?.id === itemId ? { ...ci, notes: notes || '' } : ci)))
  }

  async function submitManualOrder() {
    if (!manualOrderTable || !manualCart.length) return
    setManualSubmitting(true)
    setError('')

    try {
      const validCartItems = manualCart.filter((ci) => ci && ci.item && ci.item.id)
      if (!validCartItems.length) {
        throw new Error('Debes seleccionar al menos un producto válido.')
      }

      const payloadItems = validCartItems.map((ci) => ({
        menu_item_id: ci.item.id,
        quantity: Math.max(1, Math.min(ci.quantity || 1, 20)),
        item_notes: (ci.notes || '').trim(),
      }))

      // Intentar primero a través de la función RPC segura
      const { error: rpcErr } = await supabase.rpc('staff_submit_order_request', {
        p_table_id: manualOrderTable.id,
        p_notes: (manualNotes || '').trim(),
        p_items: payloadItems,
      })

      if (rpcErr) {
        console.warn('RPC staff_submit_order_request falló o no está disponible, ejecutando inserción directa:', rpcErr)

        // Fallback: Inserción directa en order_requests y order_request_items
        const { data: insertedOrder, error: orderErr } = await supabase
          .from('order_requests')
          .insert({
            table_id: manualOrderTable.id,
            table_token: manualOrderTable.public_token || '',
            notes: (manualNotes || '').trim(),
            status: 'pending',
            source: 'staff',
          })
          .select('id')
          .single()

        if (orderErr || !insertedOrder) {
          throw new Error(orderErr?.message || rpcErr.message || 'No se pudo crear el pedido.')
        }

        const itemsToInsert = validCartItems.map((ci) => ({
          order_request_id: insertedOrder.id,
          menu_item_id: ci.item.id,
          name_snapshot: ci.item.name || 'Producto',
          price_cop_snapshot: typeof ci.item.price_cop === 'number' ? ci.item.price_cop : 0,
          quantity: Math.max(1, Math.min(ci.quantity || 1, 20)),
          item_notes: (ci.notes || '').trim(),
        }))

        const { error: itemsErr } = await supabase
          .from('order_request_items')
          .insert(itemsToInsert)

        if (itemsErr) {
          throw new Error(itemsErr.message || 'No se pudieron registrar los productos del pedido.')
        }
      }

      setManualOrderTable(null)
      setManualCart([])
      setManualNotes('')
      await load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar la comanda manual.'
      setError(msg)
      console.error('Error en submitManualOrder:', err)
    } finally {
      setManualSubmitting(false)
    }
  }

  // Menú Form Scroll & Handlers
  const menuFormRef = useRef<HTMLFormElement>(null)
  function scrollToMenuForm() {
    setTimeout(() => {
      menuFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  function editItem(item: MenuItem) {
    setEditing(item)
    const matchedCat = categories.find((c) => c.id === item.category_id || c.name === item.category)
    setForm({
      ...item,
      category: matchedCat?.name || item.category,
      category_id: matchedCat?.id || item.category_id || '',
      image_url: item.image_url || '',
      gallery_urls: (item.gallery_urls || []).join('\n'),
    })
    setImageFile(null)
    setGalleryFiles([])
    scrollToMenuForm()
  }

  function newItem() {
    setEditing(null)
    const defaultCat = categories.find((c) => c.active) || categories[0]
    setForm({
      ...blankMenuForm,
      category: defaultCat?.name || 'Bebidas Calientes',
      category_id: defaultCat?.id || '',
    })
    setImageFile(null)
    setGalleryFiles([])
    scrollToMenuForm()
  }

  const menuCategoryNames = useMemo(() => {
    if (categories.length) {
      return categories.map((c) => c.name)
    }
    return Array.from(new Set(items.map((item) => item.category))).sort((a, b) =>
      a.localeCompare(b, 'es'),
    )
  }, [categories, items])

  const filteredAdminItems = items.filter((item) => {
    const normalizedQuery = menuQuery.trim().toLowerCase()
    const matchesQuery =
      !normalizedQuery || `${item.name} ${item.description}`.toLowerCase().includes(normalizedQuery)
    const matchesCategory = menuCategory === 'Todas' || item.category === menuCategory
    const matchesStatus =
      menuStatus === 'Todos' || (menuStatus === 'Visibles' ? item.available : !item.available)
    return matchesQuery && matchesCategory && matchesStatus
  })

  // Agrupación unificada de actividad por mesa (Requisito 10)
  const groupedTableActivity = useMemo(() => {
    const map = new Map<
      string,
      {
        table: CafeTable
        orders: OrderRequest[]
        requests: Request[]
      }
    >()

    // Incluir mesas con pedidos o solicitudes activas
    tables.forEach((tbl) => {
      const tableOrders = orders.filter((o) => o.table_id === tbl.id)
      const tableRequests = requests.filter((r) => r.table_id === tbl.id)

      if (tableOrders.length > 0 || tableRequests.length > 0) {
        map.set(tbl.id, {
          table: tbl,
          orders: tableOrders,
          requests: tableRequests,
        })
      }
    })

    return Array.from(map.values())
  }, [tables, orders, requests])

  async function saveItem(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || form.price_cop < 0) {
      setError('Completa un nombre y un precio válido.')
      return
    }
    setSaving(true)
    setError('')
    let imageUrl = form.image_url.trim() || null
    let galleryUrls = form.gallery_urls
      .split(/[\n,]/)
      .map((url) => url.trim())
      .filter(Boolean)

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
        const upload = await supabase.storage
          .from('menu-images')
          .upload(path, file, { cacheControl: '31536000', contentType: file.type, upsert: false })
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

    const matchedCategory = categories.find(
      (c) => c.id === form.category_id || c.name === form.category,
    ) || categories[0]

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
      category: matchedCategory?.name || form.category,
      category_id: matchedCategory?.id || null,
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
      setError(
        result.error.message.includes('duplicate')
          ? 'El slug ya existe. Usa otro.'
          : 'No se pudo guardar el producto.',
      )
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

  // Categorías CRUD Handlers
  function editCat(cat: MenuCategory) {
    setEditingCategory(cat)
    setCategoryForm({
      name: cat.name,
      slug: cat.slug || '',
      icon: cat.icon,
      sort_order: cat.sort_order,
      active: cat.active,
    })
  }

  function newCat() {
    setEditingCategory(null)
    setCategoryForm({ ...blankCategoryForm, sort_order: categories.length + 1 })
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryForm.name.trim()) {
      setError('El nombre de la categoría es requerido.')
      return
    }
    setError('')
    setSaving(true)

    const generatedSlug = (
      categoryForm.slug.trim() ||
      categoryForm.name
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
    )

    const payload = {
      name: categoryForm.name.trim(),
      slug: generatedSlug,
      icon: categoryForm.icon.trim() || '☕',
      sort_order: Number(categoryForm.sort_order) || 0,
      active: categoryForm.active,
    }

    const res = editingCategory
      ? await supabase.from('menu_categories').update(payload).eq('id', editingCategory.id)
      : await supabase.from('menu_categories').insert(payload)

    setSaving(false)
    if (res.error) {
      setError(
        res.error.message.includes('unique')
          ? 'Ya existe una categoría con ese nombre o slug.'
          : 'No se pudo guardar la categoría.',
      )
      return
    }
    newCat()
    await load()
  }

  async function removeCategory(cat: MenuCategory) {
    const associatedItems = items.filter(
      (it) => it.category_id === cat.id || it.category === cat.name,
    )
    if (associatedItems.length > 0) {
      alert(
        `No se puede eliminar "${cat.name}" porque tiene ${associatedItems.length} producto(s) asignado(s). Reasigna los productos primero o desactiva la categoría.`,
      )
      return
    }

    if (!confirm(`¿Eliminar la categoría "${cat.name}"?`)) return
    const { error: delError } = await supabase.from('menu_categories').delete().eq('id', cat.id)
    if (delError) {
      setError('No se pudo eliminar la categoría. Asegúrate de que no tenga productos asociados.')
    } else {
      await load()
    }
  }

  async function toggleCategoryActive(cat: MenuCategory) {
    await supabase.from('menu_categories').update({ active: !cat.active }).eq('id', cat.id)
    await load()
  }

  // Promociones CRUD Handlers
  function editPromo(promo: Promotion) {
    setEditingPromotion(promo)
    setPromotionForm({
      title: promo.title,
      description: promo.description || '',
      badge_text: promo.badge_text || 'PROMO DEL DÍA',
      linked_menu_item_id: promo.linked_menu_item_id || '',
      starts_at: toLocalDatetimeInput(promo.starts_at),
      ends_at: toLocalDatetimeInput(promo.ends_at),
      active: promo.active,
      sort_order: promo.sort_order,
    })
  }

  function newPromo() {
    setEditingPromotion(null)
    setPromotionForm({
      ...blankPromotionForm,
      starts_at: toLocalDatetimeInput(new Date().toISOString()),
    })
  }

  async function savePromotion(e: React.FormEvent) {
    e.preventDefault()
    if (!promotionForm.title.trim()) {
      setError('El título de la promoción es obligatorio.')
      return
    }
    setError('')
    setSaving(true)

    const payload = {
      title: promotionForm.title.trim(),
      description: promotionForm.description.trim(),
      badge_text: promotionForm.badge_text.trim() || null,
      linked_menu_item_id: promotionForm.linked_menu_item_id || null,
      starts_at: promotionForm.starts_at ? new Date(promotionForm.starts_at).toISOString() : new Date().toISOString(),
      ends_at: promotionForm.ends_at ? new Date(promotionForm.ends_at).toISOString() : null,
      active: promotionForm.active,
      sort_order: Number(promotionForm.sort_order) || 0,
    }

    const res = editingPromotion
      ? await supabase.from('promotions').update(payload).eq('id', editingPromotion.id)
      : await supabase.from('promotions').insert(payload)

    setSaving(false)
    if (res.error) {
      setError('No se pudo guardar la promoción.')
      return
    }
    newPromo()
    await load()
  }

  async function removePromotion(promo: Promotion) {
    if (!confirm(`¿Eliminar la promoción "${promo.title}"?`)) return
    await supabase.from('promotions').delete().eq('id', promo.id)
    await load()
  }

  // QR Handlers
  function downloadQr(cafeTable: CafeTable) {
    const dataUrl = qrCodes[cafeTable.id]
    if (!dataUrl) return
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `yarumo-coffee-mesa-${cafeTable.label}.png`
    link.click()
  }

  function downloadAllQrs() {
    tables
      .filter((cafeTable) => cafeTable.active && qrCodes[cafeTable.id])
      .forEach((cafeTable, index) => {
        window.setTimeout(() => downloadQr(cafeTable), index * 180)
      })
  }

  // Guardar foto de portada
  async function saveHeroImage(e: React.FormEvent) {
    e.preventDefault()
    setHeroSaving(true)
    setError('')
    setHeroSuccess('')

    let finalUrl = heroImageInput.trim()

    if (heroImageFile) {
      if (!heroImageFile.type.startsWith('image/') || heroImageFile.size > 5 * 1024 * 1024) {
        setHeroSaving(false)
        setError('La imagen de portada debe ser JPG, PNG o WebP y pesar máximo 5 MB.')
        return
      }
      const extension = heroImageFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `homepage-hero-${crypto.randomUUID()}.${extension}`
      const upload = await supabase.storage
        .from('menu-images')
        .upload(path, heroImageFile, { cacheControl: '31536000', contentType: heroImageFile.type, upsert: false })

      if (upload.error) {
        setHeroSaving(false)
        setError('No se pudo subir la foto de portada. Verifica la conexión con Supabase Storage.')
        return
      }
      finalUrl = supabase.storage.from('menu-images').getPublicUrl(path).data.publicUrl
    }

    if (!finalUrl) {
      setHeroSaving(false)
      setError('Ingresa una URL de imagen o sube un archivo.')
      return
    }

    const { error: upsertErr } = await supabase
      .from('site_settings')
      .upsert({ key: 'hero_image_url', value: finalUrl, updated_at: new Date().toISOString() })

    setHeroSaving(false)
    if (upsertErr) {
      setError('No se pudo guardar la foto de portada.')
    } else {
      setHeroImageUrl(finalUrl)
      setHeroImageInput(finalUrl)
      setHeroImageFile(null)
      setHeroSuccess('¡Foto de portada actualizada con éxito! Ya se refleja en el inicio.')
    }
  }

  async function resetHeroImage() {
    if (!confirm('¿Restaurar la foto de portada original de Yarumo?')) return
    setHeroSaving(true)
    setError('')
    setHeroSuccess('')
    const defaultUrl = '/yarumo-cover-cafe.webp'
    const { error: upsertErr } = await supabase
      .from('site_settings')
      .upsert({ key: 'hero_image_url', value: defaultUrl, updated_at: new Date().toISOString() })

    setHeroSaving(false)
    if (upsertErr) {
      setError('No se pudo restaurar la foto de portada.')
    } else {
      setHeroImageUrl(defaultUrl)
      setHeroImageInput(defaultUrl)
      setHeroImageFile(null)
      setHeroSuccess('Se restauró la foto de portada original de Yarumo Coffee.')
    }
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
            <p>Gestiona la actividad de tus mesas en tiempo real y atiende cada comanda con agilidad.</p>
            <div className="login-points">
              <span>
                <b>01</b> Comandas y llamadas en vivo
              </span>
              <span>
                <b>02</b> Pedidos manuales y catálogo
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
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
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
  const pendingReviewsCount = recommendations.filter((r) => r.status === 'pending').length

  return (
    <main className="staff">
      {/* Alertas Toasts Flotantes */}
      <StaffAlerts alerts={alerts} onDismiss={dismissAlert} onAlertClick={handleAlertClick} />

      {/* Header moderno del staff */}
      <div className="staff-head">
        <div className="staff-brand-col">
          <div className="staff-brand-identity">
            <Image
              src="/yarumo-logo.webp"
              alt="Logo Yarumo Coffee"
              width={48}
              height={48}
              className="staff-logo-img"
            />
            <div>
              <div className="staff-role-badge">
                <span className="role-dot" />
                <span>
                  {role === 'owner' ? 'Propietario' : role === 'manager' ? 'Administrador' : 'Mesero / Barra'}
                </span>
              </div>
              <h1>
                Panel <em>Yarumo.</em>
              </h1>
            </div>
          </div>
        </div>

        <div className="staff-header-actions">
          <ThemeToggle />
          <div className="staff-user-chip">
            <small>Conectado:</small>
            <strong>{user}</strong>
          </div>
          <button className="button-logout" onClick={logout} title="Cerrar sesión">
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>

      <nav className="staff-tabs">
        <button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>
          <span className="tab-icon">🪑</span>
          <span>Mesas ({groupedTableActivity.length})</span>
        </button>
        {canManage && (
          <>
            <button className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}>
              <span className="tab-icon">📋</span>
              <span>Menú ({items.length})</span>
            </button>
            <button className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}>
              <span className="tab-icon">🏷️</span>
              <span>Categorías ({categories.length})</span>
            </button>
            <button className={tab === 'promotions' ? 'active' : ''} onClick={() => setTab('promotions')}>
              <span className="tab-icon">🔥</span>
              <span>Promociones ({promotions.length})</span>
            </button>
            <button className={tab === 'qr' ? 'active' : ''} onClick={() => setTab('qr')}>
              <span className="tab-icon">📱</span>
              <span>QR por mesa</span>
            </button>
            <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
              <span className="tab-icon">👥</span>
              <span>Usuarios</span>
            </button>
            <button className={tab === 'recommendations' ? 'active' : ''} onClick={() => setTab('recommendations')}>
              <span className="tab-icon">⭐</span>
              <span>Reseñas ({recommendations.length}) {pendingReviewsCount > 0 && `(🔔 ${pendingReviewsCount})`}</span>
            </button>
            <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
              <span className="tab-icon">🖼️</span>
              <span>Portada</span>
            </button>
          </>
        )}
      </nav>

      {error && <p className="admin-error">{error}</p>}

      {/* TAB: ACTIVIDAD UNIFICADA POR MESA (Requisito 10) */}
      {tab === 'activity' ? (
        <>
          <div className="stats">
            <div className="stat">
              <div className="stat-header">
                <span className="stat-icon-wrap">🪑</span>
                <span>Mesas con actividad</span>
              </div>
              <strong>{groupedTableActivity.length}</strong>
              <small className="stat-subtext">
                {tables.filter((t) => t.active).length} mesas habilitadas en total
              </small>
            </div>
            <div className="stat">
              <div className="stat-header">
                <span className="stat-icon-wrap">☕</span>
                <span>Comandas activas</span>
              </div>
              <strong>{orders.length}</strong>
              <small className="stat-subtext">
                {orders.filter((o) => o.status === 'preparing').length} en preparación
              </small>
            </div>
            <div className="stat">
              <div className="stat-header">
                <span className="stat-icon-wrap">🛎️</span>
                <span>Solicitudes de atención</span>
              </div>
              <strong>{requests.length}</strong>
              <small className="stat-subtext">
                {requests.filter((r) => r.type === 'waiter').length} mesero · {requests.filter((r) => r.type === 'bill').length} cuenta
              </small>
            </div>
          </div>

          <div className="menu-admin-filters" style={{ margin: '14px 0 20px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Filtro rápido:
              </span>
              <button
                type="button"
                className={`category-pill ${activityFilter === 'all' ? 'active' : ''}`}
                onClick={() => setActivityFilter('all')}
              >
                <span>Todo</span>
              </button>
              <button
                type="button"
                className={`category-pill ${activityFilter === 'orders' ? 'active' : ''}`}
                onClick={() => setActivityFilter('orders')}
              >
                <span>Solo pedidos ({orders.length})</span>
              </button>
              <button
                type="button"
                className={`category-pill ${activityFilter === 'requests' ? 'active' : ''}`}
                onClick={() => setActivityFilter('requests')}
              >
                <span>Solo solicitudes ({requests.length})</span>
              </button>
            </div>

            <div style={{ marginLeft: 'auto' }}>
              <button
                type="button"
                className="btn-manual-order-primary"
                onClick={() => {
                  const firstActive = tables.find((t) => t.active) || tables[0]
                  if (firstActive) openManualOrder(firstActive)
                }}
              >
                <span>+</span>
                <span>Tomar pedido manual</span>
              </button>
            </div>
          </div>

          <div className="table-activity-grid">
            {groupedTableActivity.length ? (
              groupedTableActivity.map(({ table: tbl, orders: tblOrders, requests: tblRequests }) => {
                const showOrders = activityFilter === 'all' || activityFilter === 'orders'
                const showRequests = activityFilter === 'all' || activityFilter === 'requests'
                const isHighlighted = highlightedTable === tbl.label

                return (
                  <article
                    className={`table-activity-card ${isHighlighted ? 'highlight-pulse' : ''}`}
                    key={tbl.id}
                    id={`table-card-${tbl.label}`}
                  >
                    <div className="table-activity-header">
                      <div className="table-activity-title">
                        <h3>Mesa {tbl.label}</h3>
                        <span className="table-activity-badge">
                          {tblOrders.length} pedido(s) · {tblRequests.length} llamada(s)
                        </span>
                      </div>
                      <div className="table-activity-actions">
                        <button
                          type="button"
                          className="btn-manual-order"
                          onClick={() => openManualOrder(tbl)}
                          title="Anotar pedido para esta mesa"
                        >
                          + Pedido
                        </button>
                      </div>
                    </div>

                    <div className="table-entries-list">
                      {/* Solicitudes de servicio */}
                      {showRequests &&
                        tblRequests.map((r) => (
                          <div className="entry-box entry-service" key={r.id}>
                            <div className="entry-header">
                              <span>
                                {r.type === 'waiter' ? '🛎️ Mesero solicitado' : '🧾 Cuenta solicitada'}
                              </span>
                              <small style={{ color: 'var(--text-muted)' }}>
                                {new Date(r.created_at).toLocaleTimeString('es-CO', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </small>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                              <button
                                type="button"
                                className="btn-service-resolve"
                                onClick={() => completeRequest(r.id)}
                              >
                                Marcar atendida ✓
                              </button>
                            </div>
                          </div>
                        ))}

                      {/* Comandas de pedidos */}
                      {showOrders &&
                        tblOrders.map((ord) => {
                          const orderSum = (ord.items || []).reduce(
                            (acc, it) => acc + (it.price_cop_snapshot || 0) * (it.quantity || 1),
                            0,
                          )
                          return (
                            <div className={`entry-box entry-order status-${ord.status}`} key={ord.id}>
                              <div className="entry-header">
                                <span>
                                  🛍️ Comanda #{ord.id.slice(0, 5).toUpperCase()}{' '}
                                  {ord.source === 'staff' && <small style={{ color: 'var(--orange)' }}>[Mesero]</small>}
                                </span>
                                <small style={{ color: 'var(--text-muted)' }}>
                                  {new Date(ord.created_at).toLocaleTimeString('es-CO', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </small>
                              </div>

                              <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {(ord.items || []).map((it) => (
                                  <div key={it.id}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span>
                                        <strong style={{ color: 'var(--orange)', marginRight: '6px' }}>
                                          {it.quantity}x
                                        </strong>
                                        {it.name_snapshot}
                                      </span>
                                      <span style={{ color: 'var(--text-muted)' }}>
                                        {formatCop(it.price_cop_snapshot * it.quantity)}
                                      </span>
                                    </div>
                                    {it.item_notes && (
                                      <span className="order-item-note">↳ {it.item_notes}</span>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {ord.notes && (
                                <p className="order-general-note">
                                  <strong>Nota:</strong> {ord.notes}
                                </p>
                              )}

                              <div className="order-card-footer">
                                <div className="order-total">{formatCop(orderSum)}</div>
                                <div className="order-actions">
                                  {ord.status === 'pending' && (
                                    <button
                                      type="button"
                                      className="btn-order-action btn-order-receive"
                                      onClick={() => updateOrderStatus(ord.id, 'acknowledged')}
                                    >
                                      📥 Recibir
                                    </button>
                                  )}
                                  {ord.status === 'acknowledged' && (
                                    <button
                                      type="button"
                                      className="btn-order-action btn-order-prepare"
                                      onClick={() => updateOrderStatus(ord.id, 'preparing')}
                                    >
                                      ☕ En preparación
                                    </button>
                                  )}
                                  {ord.status === 'preparing' && (
                                    <button
                                      type="button"
                                      className="btn-order-action btn-order-deliver"
                                      onClick={() => updateOrderStatus(ord.id, 'delivered')}
                                    >
                                      ✓ Entregado
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn-order-action btn-order-cancel"
                                    onClick={() => updateOrderStatus(ord.id, 'cancelled')}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </article>
                )
              })
            ) : (
              <div className="request" style={{ gridColumn: '1 / -1' }}>
                No hay actividad pendiente en las mesas en este momento.
              </div>
            )}
          </div>
        </>
      ) : tab === 'menu' ? (
        /* TAB: MENÚ CRUD */
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
                {menuCategoryNames.map((category) => <option key={category}>{category}</option>)}
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
            {(menuQuery || menuCategory !== 'Todas' || menuStatus !== 'Todos') && (
              <button
                className="clear-menu-filters"
                type="button"
                onClick={() => {
                  setMenuQuery('')
                  setMenuCategory('Todas')
                  setMenuStatus('Todos')
                }}
              >
                Limpiar filtros
              </button>
            )}
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
                    <button onClick={() => editItem(item)}>Editar</button>
                    <button onClick={() => removeItem(item)}>Eliminar</button>
                  </div>
                </article>
              ))}
              {!filteredAdminItems.length && (
                <div className="request menu-empty">No hay productos que coincidan con los filtros.</div>
              )}
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
              {/* Foto Principal con Preview y Upload Zone (Requisito 4) */}
              <label htmlFor="menu-main-image">Foto principal del producto</label>
              {(form.image_url || imageFile) && (
                <div className="staff-image-preview-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageFile ? URL.createObjectURL(imageFile) : form.image_url}
                    alt="Previsualización de foto principal"
                    className="staff-preview-thumbnail"
                  />
                  <div className="staff-preview-info">
                    <span className="staff-preview-tag">
                      {imageFile ? 'Nueva foto seleccionada' : 'Foto actual guardada'}
                    </span>
                    <button
                      type="button"
                      className="btn-remove-preview"
                      onClick={() => {
                        setImageFile(null)
                        setForm({ ...form, image_url: '' })
                      }}
                    >
                      ✕ Quitar foto
                    </button>
                  </div>
                </div>
              )}
              <div className="staff-file-drop-zone">
                <input
                  id="menu-main-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
                <div className="drop-zone-placeholder">
                  <span>📷 {imageFile ? 'Cambiar foto seleccionada' : form.image_url ? 'Reemplazar foto actual' : 'Seleccionar foto principal'}</span>
                  <small>JPG, PNG o WebP · Máximo 5 MB</small>
                </div>
              </div>

              {/* Fotos Adicionales / Galería con Preview y Upload Zone (Requisito 4) */}
              <label htmlFor="menu-gallery-images">Fotos adicionales para la galería</label>
              {(galleryFiles.length > 0 || form.gallery_urls) && (
                <div className="staff-gallery-previews">
                  {form.gallery_urls
                    .split(/[\n,]/)
                    .map((url) => url.trim())
                    .filter(Boolean)
                    .map((url, idx) => (
                      <div key={`existing-${idx}`} className="gallery-thumb-item">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Galería guardada ${idx + 1}`} />
                        <span className="gallery-thumb-badge">Guardada</span>
                      </div>
                    ))}
                  {galleryFiles.map((f, idx) => (
                    <div key={`new-${idx}`} className="gallery-thumb-item new-item">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={URL.createObjectURL(f)} alt={`Nueva ${idx + 1}`} />
                      <span className="gallery-thumb-badge new-badge">Nueva</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="staff-file-drop-zone">
                <input
                  id="menu-gallery-images"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(e) => setGalleryFiles(Array.from(e.target.files || []))}
                />
                <div className="drop-zone-placeholder">
                  <span>🖼️ {galleryFiles.length > 0 ? `${galleryFiles.length} foto(s) seleccionadas` : 'Agregar más fotos a la galería'}</span>
                  <small>Puedes seleccionar múltiples imágenes</small>
                </div>
              </div>
              <label htmlFor="menu-category">Categoría</label>
              <select
                id="menu-category"
                value={form.category_id || categories.find((c) => c.name === form.category)?.id || form.category}
                onChange={(e) => {
                  const selected = categories.find((c) => c.id === e.target.value || c.name === e.target.value)
                  if (selected) {
                    setForm({ ...form, category: selected.name, category_id: selected.id })
                  } else {
                    setForm({ ...form, category: e.target.value })
                  }
                }}
              >
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name} {!cat.active ? '(Inactiva)' : ''}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Bebidas Calientes">♨️ Bebidas Calientes</option>
                    <option value="Bebidas Frías">🧊 Bebidas Frías</option>
                    <option value="Gaseosas">🥤 Gaseosas</option>
                    <option value="Cervezas">🍺 Cervezas</option>
                    <option value="Antojitos Panaderos">🥐 Antojitos Panaderos</option>
                    <option value="Sándwiches">🥪 Sándwiches</option>
                    <option value="Tortas y Brownies">🍰 Tortas y Brownies</option>
                    <option value="Hojaldrados">🥟 Hojaldrados</option>
                    <option value="Pizzetas">🍕 Pizzetas</option>
                    <option value="Otros">✨ Otros</option>
                  </>
                )}
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
      ) : tab === 'categories' ? (
        /* TAB: CATEGORÍAS DINÁMICAS */
        <section className="menu-admin">
          <div className="menu-admin-head">
            <div>
              <span className="eyebrow">Organización</span>
              <h2>Categorías del menú.</h2>
            </div>
            <button className="button" onClick={newCat}>
              + Nueva categoría
            </button>
          </div>
          <div className="menu-admin-grid">
            <div className="admin-list">
              {categories.map((cat) => (
                <article className={`admin-item ${!cat.active ? 'unavailable' : ''}`} key={cat.id}>
                  <div>
                    <strong>
                      <span className="category-icon-preview">{cat.icon}</span>
                      {cat.name}
                      <span className="sort-order-badge">Orden: {cat.sort_order}</span>
                    </strong>
                    <small>
                      {items.filter((it) => it.category === cat.name || it.category_id === cat.id).length} producto(s) asignados · {cat.active ? 'Activa' : 'Oculta'}
                      {cat.slug ? ` · /${cat.slug}` : ''}
                    </small>
                  </div>
                  <div>
                    <button onClick={() => toggleCategoryActive(cat)}>
                      {cat.active ? 'Ocultar' : 'Activar'}
                    </button>
                    <button onClick={() => editCat(cat)}>Editar</button>
                    <button onClick={() => removeCategory(cat)}>Eliminar</button>
                  </div>
                </article>
              ))}
              {!categories.length && (
                <div className="request menu-empty">No hay categorías configuradas.</div>
              )}
            </div>

            <form className={`menu-form ${editingCategory ? 'is-editing' : ''}`} onSubmit={saveCategory}>
              <h3>{editingCategory ? 'Editar categoría' : 'Nueva categoría'}</h3>
              <label htmlFor="cat-name">Nombre de la categoría</label>
              <input
                id="cat-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Ej. Postres y Dulces"
                required
              />
              <label htmlFor="cat-slug">Slug <span>(opcional)</span></label>
              <input
                id="cat-slug"
                value={categoryForm.slug}
                onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                placeholder="ej. postres-y-dulces"
              />
              <label htmlFor="cat-icon">Ícono o Emoji</label>
              <input
                id="cat-icon"
                value={categoryForm.icon}
                onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                placeholder="Ej. 🍮 o ☕"
                maxLength={10}
              />
              <label htmlFor="cat-order">Orden de aparición</label>
              <input
                id="cat-order"
                type="number"
                min="0"
                value={categoryForm.sort_order}
                onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: Number(e.target.value) })}
                placeholder="1"
              />
              <label>
                <input
                  type="checkbox"
                  checked={categoryForm.active}
                  onChange={(e) => setCategoryForm({ ...categoryForm, active: e.target.checked })}
                />{' '}
                Visible en los tabs de la carta
              </label>
              <div>
                <button type="submit" className="button" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar categoría'}
                </button>
                {editingCategory && (
                  <button type="button" onClick={newCat}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>
      ) : tab === 'promotions' ? (
        /* TAB: PROMOCIONES DEL DÍA */
        <section className="menu-admin">
          <div className="menu-admin-head">
            <div>
              <span className="eyebrow">Destacados</span>
              <h2>Promociones del día.</h2>
            </div>
            <button className="button" onClick={newPromo}>
              + Nueva promoción
            </button>
          </div>
          <div className="menu-admin-grid">
            <div className="admin-list">
              {promotions.map((promo) => {
                const now = currentTime
                const startTime = new Date(promo.starts_at).getTime()
                const endTime = promo.ends_at ? new Date(promo.ends_at).getTime() : null
                const isScheduled = startTime > now
                const isExpired = endTime !== null && endTime < now
                const statusText = !promo.active
                  ? 'Inactiva'
                  : isExpired
                    ? 'Expirada'
                    : isScheduled
                      ? 'Programada'
                      : 'Activa'

                return (
                  <article className={`admin-item ${!promo.active || isExpired ? 'unavailable' : ''}`} key={promo.id}>
                    <div>
                      <strong>
                        {promo.badge_text ? `[${promo.badge_text}] ` : ''}
                        {promo.title}
                        <span
                          className="sort-order-badge"
                          style={{
                            background:
                              statusText === 'Activa'
                                ? 'var(--lime)'
                                : statusText === 'Programada'
                                  ? '#90caf9'
                                  : '#e0e0e0',
                            color: 'var(--ink)',
                            fontWeight: 800,
                          }}
                        >
                          {statusText}
                        </span>
                      </strong>
                      {promo.description && (
                        <p style={{ margin: '4px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                          {promo.description}
                        </p>
                      )}
                      <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                        {promo.linked_menu_item_id
                          ? `Vinculada a: ${items.find((i) => i.id === promo.linked_menu_item_id)?.name || 'Producto'}`
                          : 'Sin producto vinculado'}
                      </small>
                      <small style={{ display: 'block', marginTop: '2px', color: 'var(--orange)', fontWeight: 600 }}>
                        📅 Vigencia:{' '}
                        {new Date(promo.starts_at).toLocaleDateString('es-CO', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {promo.ends_at
                          ? ` hasta ${new Date(promo.ends_at).toLocaleDateString('es-CO', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : ' (Sin expiración)'}
                      </small>
                    </div>
                    <div>
                      <button onClick={() => editPromo(promo)}>Editar</button>
                      <button onClick={() => removePromotion(promo)}>Eliminar</button>
                    </div>
                  </article>
                )
              })}
              {!promotions.length && (
                <div className="request menu-empty">No hay promociones configuradas.</div>
              )}
            </div>

            <form className={`menu-form ${editingPromotion ? 'is-editing' : ''}`} onSubmit={savePromotion}>
              <h3>{editingPromotion ? 'Editar promoción' : 'Nueva promoción'}</h3>
              <label htmlFor="promo-title">Título de la promo</label>
              <input
                id="promo-title"
                value={promotionForm.title}
                onChange={(e) => setPromotionForm({ ...promotionForm, title: e.target.value })}
                placeholder="Ej. 2x1 en Cappuccino"
                required
              />
              <label htmlFor="promo-badge">Texto del badge</label>
              <input
                id="promo-badge"
                value={promotionForm.badge_text}
                onChange={(e) => setPromotionForm({ ...promotionForm, badge_text: e.target.value })}
                placeholder="PROMO DEL DÍA o 2X1"
              />
              <label htmlFor="promo-desc">Descripción o términos</label>
              <textarea
                id="promo-desc"
                value={promotionForm.description}
                onChange={(e) => setPromotionForm({ ...promotionForm, description: e.target.value })}
                placeholder="Válido de 3pm a 6pm de lunes a viernes."
                maxLength={500}
              />

              {/* Rango de Fechas (Inicio y Fin) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div>
                  <label htmlFor="promo-starts">Fecha y hora de inicio</label>
                  <input
                    id="promo-starts"
                    type="datetime-local"
                    value={promotionForm.starts_at}
                    onChange={(e) => setPromotionForm({ ...promotionForm, starts_at: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="promo-ends">Fecha y hora de fin <span>(opcional)</span></label>
                  <input
                    id="promo-ends"
                    type="datetime-local"
                    value={promotionForm.ends_at}
                    onChange={(e) => setPromotionForm({ ...promotionForm, ends_at: e.target.value })}
                  />
                </div>
              </div>
              <small className="field-help" style={{ marginTop: '-4px' }}>
                La promoción solo será visible en la carta dentro del rango de vigencia.
              </small>

              <label htmlFor="promo-product">Producto vinculado <span>(opcional)</span></label>
              <select
                id="promo-product"
                value={promotionForm.linked_menu_item_id}
                onChange={(e) => setPromotionForm({ ...promotionForm, linked_menu_item_id: e.target.value })}
              >
                <option value="">-- Ninguno (solo informativo) --</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} (${it.price_cop.toLocaleString('es-CO')})
                  </option>
                ))}
              </select>
              <label htmlFor="promo-order">Orden de aparición</label>
              <input
                id="promo-order"
                type="number"
                min="0"
                value={promotionForm.sort_order}
                onChange={(e) => setPromotionForm({ ...promotionForm, sort_order: Number(e.target.value) })}
                placeholder="0"
              />
              <label>
                <input
                  type="checkbox"
                  checked={promotionForm.active}
                  onChange={(e) => setPromotionForm({ ...promotionForm, active: e.target.checked })}
                />{' '}
                Promoción activa en la carta
              </label>
              <div>
                <button type="submit" className="button" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar promoción'}
                </button>
                {editingPromotion && (
                  <button type="button" onClick={newPromo}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>
      ) : tab === 'qr' ? (
        /* TAB: QR DE MESAS */
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
        /* TAB: RESEÑAS Y MODERACIÓN (Requisito 5) */
        <section className="menu-admin">
          <div className="menu-admin-head">
            <div>
              <span className="eyebrow">Opiniones y Moderación</span>
              <h2>Recomendaciones de clientes.</h2>
            </div>
          </div>
          <div className="admin-list">
            {recommendations.map((rec) => (
              <article className={`admin-item ${rec.status === 'hidden' ? 'unavailable' : ''}`} key={rec.id}>
                <div>
                  <strong>
                    {rec.name} {rec.table_number ? `(Mesa ${rec.table_number})` : ''} · {'★'.repeat(rec.rating)}
                    <span
                      className="sort-order-badge"
                      style={{
                        background:
                          rec.status === 'published' ? '#d9e86a' : rec.status === 'pending' ? '#ffcc00' : '#888',
                        color: '#18362f',
                        marginLeft: '8px',
                      }}
                    >
                      {rec.status === 'published' ? 'Publicada' : rec.status === 'pending' ? 'Pendiente' : 'Oculta'}
                    </span>
                  </strong>
                  <p style={{ margin: '6px 0', fontSize: '13px', fontStyle: 'italic' }}>“{rec.comment}”</p>
                  <small>{new Date(rec.created_at).toLocaleString('es-CO')}</small>
                </div>
                <div>
                  {rec.status !== 'published' && (
                    <button onClick={() => updateRecommendationStatus(rec.id, 'published')}>
                      Aprobar ✓
                    </button>
                  )}
                  {rec.status === 'published' && (
                    <button onClick={() => updateRecommendationStatus(rec.id, 'hidden')}>
                      Ocultar
                    </button>
                  )}
                  <button onClick={() => removeRecommendation(rec.id)}>Eliminar</button>
                </div>
              </article>
            ))}
            {!recommendations.length && <div className="request menu-empty">No hay recomendaciones registradas.</div>}
          </div>
        </section>
      ) : tab === 'settings' ? (
        /* TAB: PORTADA DEL HOMEPAGE */
        <section className="menu-admin">
          <div className="menu-admin-head">
            <div>
              <span className="eyebrow">Personalización</span>
              <h2>Foto de portada del homepage.</h2>
              <p>Cambia la imagen principal que ven los clientes al escanear el QR o abrir la carta digital.</p>
            </div>
          </div>

          <div className="menu-admin-grid">
            {/* Vista previa en tiempo real */}
            <div className="admin-list">
              <div className="hero-preview-container">
                <span className="eyebrow" style={{ marginBottom: '8px', display: 'block' }}>Vista previa en vivo</span>
                <div className="hero-preview-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroImageFile ? URL.createObjectURL(heroImageFile) : (heroImageInput.trim() || heroImageUrl || '/yarumo-cover-cafe.webp')}
                    alt="Vista previa de portada Yarumo Coffee"
                    className="hero-preview-image"
                  />
                  <div className="hero-preview-overlay">
                    <div className="hero-caption-logo-wrap">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/yarumo-logo.webp"
                        alt="Yarumo Coffee"
                        className="hero-caption-logo"
                      />
                    </div>
                    <span>Mesa 1 · Yarumo Coffee</span>
                  </div>
                </div>
                <div className="hero-preview-info">
                  <small style={{ color: 'var(--text-muted)' }}>
                    <strong>Foto activa:</strong> {heroImageUrl}
                  </small>
                </div>
              </div>
            </div>

            {/* Formulario de actualización de portada */}
            <form className="menu-form" onSubmit={saveHeroImage}>
              <h3>Actualizar foto de portada</h3>

              {heroSuccess && (
                <div className="hero-success-banner" role="status">
                  ✓ {heroSuccess}
                </div>
              )}

              <label htmlFor="hero-image-file">Subir nueva foto desde el dispositivo</label>
              <div className="staff-file-drop-zone">
                <input
                  id="hero-image-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setHeroImageFile(file)
                    setHeroSuccess('')
                  }}
                />
                <div className="drop-zone-placeholder">
                  <span>📷 {heroImageFile ? heroImageFile.name : 'Seleccionar archivo JPG, PNG o WebP'}</span>
                  <small>Máximo 5 MB · Formato vertical de alta calidad recomendado</small>
                </div>
              </div>

              <div style={{ textAlign: 'center', margin: '8px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                — o introduce una URL pública directa —
              </div>

              <label htmlFor="hero-image-url">URL pública de la imagen</label>
              <input
                id="hero-image-url"
                type="text"
                placeholder="https://... o /yarumo-cover-cafe.webp"
                value={heroImageInput}
                onChange={(e) => {
                  setHeroImageInput(e.target.value)
                  setHeroSuccess('')
                }}
              />

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button type="submit" className="button" disabled={heroSaving}>
                  {heroSaving ? 'Guardando…' : 'Guardar foto de portada'}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={resetHeroImage}
                  disabled={heroSaving}
                >
                  Restaurar original
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : (
        /* TAB: USUARIOS */
        <UserAdmin />
      )}

      {/* MODAL TOMA MANUAL DE PEDIDOS (Requisitos 7 y 8) */}
      {manualOrderTable && (
        <div className="manual-order-overlay" onClick={() => setManualOrderTable(null)}>
          <div className="manual-order-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="manual-order-head">
              <div className="manual-order-title-group">
                <span className="eyebrow">Comanda manual</span>
                <h2>Tomar pedido · Mesa {manualOrderTable.label || 'Seleccionada'}</h2>
              </div>
              <button
                type="button"
                className="cart-modal-close"
                onClick={() => setManualOrderTable(null)}
                aria-label="Cerrar modal"
              >
                ×
              </button>
            </div>

            <div className="manual-order-body">
              {/* Selector de Mesa para elegir o cambiar mesa (Requisito 7) */}
              <div className="manual-table-selector-card">
                <label htmlFor="manual-table-select">
                  <span>Mesa receptora:</span>
                </label>
                <select
                  id="manual-table-select"
                  value={manualOrderTable.id}
                  onChange={(e) => {
                    const chosen = tables.find((t) => t.id === e.target.value)
                    if (chosen) setManualOrderTable(chosen)
                  }}
                  className="manual-table-select"
                >
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Mesa {t.label || t.id} {!t.active ? '(Inactiva)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buscador y filtro de categoría */}
              <div className="manual-search-filter-row">
                <input
                  type="text"
                  placeholder="Buscar producto en la carta..."
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  className="manual-search-input"
                />
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                  className="manual-category-select"
                >
                  <option>Todas</option>
                  {menuCategoryNames.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Lista de productos para agregar */}
              <div className="manual-products-list">
                {items
                  .filter((it) => it && it.available)
                  .filter(
                    (it) =>
                      (manualCategory === 'Todas' || it.category === manualCategory) &&
                      `${it.name || ''} ${it.description || ''}`
                        .toLowerCase()
                        .includes((manualQuery || '').toLowerCase().trim()),
                  )
                  .map((it) => (
                    <div className="manual-product-row" key={it.id}>
                      <div className="manual-product-info">
                        <strong>{it.name || 'Sin nombre'}</strong>
                        <small>
                          {formatCop(it.price_cop)} {it.category ? `· ${it.category}` : ''}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="btn-manual-add"
                        onClick={() => addManualProduct(it)}
                      >
                        + Agregar
                      </button>
                    </div>
                  ))}
              </div>

              {/* Ítems agregados a la comanda */}
              {manualCart.length > 0 && (
                <div className="manual-order-cart-items">
                  <div className="manual-cart-header">
                    <span>
                      Productos en la comanda (
                      {manualCart.reduce((sum, ci) => sum + (ci?.quantity || 1), 0)}):
                    </span>
                  </div>
                  {manualCart.map(({ item, quantity, notes }) => {
                    if (!item) return null
                    const itemPrice = typeof item.price_cop === 'number' ? item.price_cop : 0
                    const qty = typeof quantity === 'number' ? quantity : 1
                    return (
                      <div key={item.id} className="manual-cart-item-box">
                        <div className="manual-cart-item-row">
                          <div>
                            <strong>{item.name || 'Producto'}</strong>
                            <span className="manual-item-subtotal">
                              {formatCop(itemPrice * qty)}
                            </span>
                          </div>
                          <div className="cart-qty-picker">
                            <button type="button" onClick={() => updateManualQty(item.id, -1)}>
                              −
                            </button>
                            <span>{qty}</span>
                            <button type="button" onClick={() => updateManualQty(item.id, 1)}>
                              +
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          placeholder="Nota o especificación (ej. sin azúcar, leche deslactosada)"
                          value={notes || ''}
                          onChange={(e) => updateManualItemNotes(item.id, e.target.value)}
                          className="manual-item-note-input"
                        />
                      </div>
                    )
                  })}
                  <div className="manual-notes-group">
                    <label htmlFor="manual-general-notes">Nota general para barra/cocina:</label>
                    <input
                      id="manual-general-notes"
                      type="text"
                      placeholder="Instrucciones para el servicio..."
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      className="manual-general-notes-input"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="manual-order-footer">
              <div className="manual-order-total-info">
                <span>Total comanda (Mesa {manualOrderTable.label || 'Seleccionada'}):</span>
                <strong>
                  {formatCop(
                    manualCart.reduce((sum, ci) => {
                      const p = typeof ci?.item?.price_cop === 'number' ? ci.item.price_cop : 0
                      const q = typeof ci?.quantity === 'number' ? ci.quantity : 1
                      return sum + p * q
                    }, 0),
                  )}
                </strong>
              </div>
              <button
                type="button"
                className="btn-manual-submit"
                disabled={manualSubmitting || !manualCart.length}
                onClick={submitManualOrder}
              >
                {manualSubmitting
                  ? 'Registrando…'
                  : `Crear comanda · Mesa ${manualOrderTable.label || 'Seleccionada'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
