'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import UserAdmin from '@/components/UserAdmin'
import StaffAlerts, { type StaffAlert } from '@/components/StaffAlerts'
import { SITE_URL as PUBLIC_MENU_URL } from '@/lib/site-url'

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
  icon: string
  sort_order: number
  active: boolean
}

const blankCategoryForm: CategoryForm = {
  name: '',
  icon: '☕',
  sort_order: 0,
  active: true,
}

type PromotionForm = {
  title: string
  description: string
  badge_text: string
  linked_menu_item_id: string
  active: boolean
  sort_order: number
}

const blankPromotionForm: PromotionForm = {
  title: '',
  description: '',
  badge_text: 'PROMO DEL DÍA',
  linked_menu_item_id: '',
  active: true,
  sort_order: 0,
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
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
    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('error') === 'oauth_error'
    ) {
      return 'Error en la autenticación con Google. Intenta nuevamente.'
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
    'activity' | 'menu' | 'categories' | 'promotions' | 'qr' | 'users' | 'recommendations'
  >('activity')

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
      .select('id,name,icon,sort_order,active,created_at')
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
  function openManualOrder(tableItem: CafeTable) {
    setManualOrderTable(tableItem)
    setManualCart([])
    setManualNotes('')
    setManualQuery('')
    setManualCategory('Todas')
  }

  function addManualProduct(item: MenuItem) {
    setManualCart((prev) => {
      const exists = prev.find((ci) => ci.item.id === item.id)
      if (exists) {
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, quantity: Math.min(ci.quantity + 1, 20) } : ci,
        )
      }
      return [...prev, { item, quantity: 1, notes: '' }]
    })
  }

  function updateManualQty(itemId: string, delta: number) {
    setManualCart((prev) =>
      prev
        .map((ci) => {
          if (ci.item.id === itemId) {
            const next = ci.quantity + delta
            return next > 0 ? { ...ci, quantity: Math.min(next, 20) } : null
          }
          return ci
        })
        .filter(Boolean) as Array<{ item: MenuItem; quantity: number; notes: string }>,
    )
  }

  function updateManualItemNotes(itemId: string, notes: string) {
    setManualCart((prev) => prev.map((ci) => (ci.item.id === itemId ? { ...ci, notes } : ci)))
  }

  async function submitManualOrder() {
    if (!manualOrderTable || !manualCart.length) return
    setManualSubmitting(true)
    setError('')

    const payloadItems = manualCart.map((ci) => ({
      menu_item_id: ci.item.id,
      quantity: ci.quantity,
      item_notes: ci.notes.trim(),
    }))

    const { error: rpcErr } = await supabase.rpc('staff_submit_order_request', {
      p_table_id: manualOrderTable.id,
      p_notes: manualNotes.trim(),
      p_items: payloadItems,
    })

    setManualSubmitting(false)
    if (rpcErr) {
      setError(rpcErr.message || 'No se pudo registrar la comanda manual.')
      return
    }

    setManualOrderTable(null)
    setManualCart([])
    setManualNotes('')
    await load()
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
    setForm({
      ...item,
      category: item.category,
      category_id: item.category_id || '',
      image_url: item.image_url || '',
      gallery_urls: (item.gallery_urls || []).join('\n'),
    })
    setImageFile(null)
    setGalleryFiles([])
    scrollToMenuForm()
  }

  function newItem() {
    setEditing(null)
    const defaultCat = categories.find((c) => c.active)?.name || 'Bebidas Calientes'
    setForm({ ...blankMenuForm, category: defaultCat })
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

    const matchedCategory = categories.find((c) => c.name === form.category)

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

    const payload = {
      name: categoryForm.name.trim(),
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
          ? 'Ya existe una categoría con ese nombre.'
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
      active: promo.active,
      sort_order: promo.sort_order,
    })
  }

  function newPromo() {
    setEditingPromotion(null)
    setPromotionForm(blankPromotionForm)
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
        <button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>
          Mesas ({groupedTableActivity.length})
        </button>
        {canManage && (
          <>
            <button className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}>
              Menú ({items.length})
            </button>
            <button className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}>
              Categorías ({categories.length})
            </button>
            <button className={tab === 'promotions' ? 'active' : ''} onClick={() => setTab('promotions')}>
              Promociones ({promotions.length})
            </button>
            <button className={tab === 'qr' ? 'active' : ''} onClick={() => setTab('qr')}>
              QR por mesa
            </button>
            <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
              Usuarios
            </button>
            <button className={tab === 'recommendations' ? 'active' : ''} onClick={() => setTab('recommendations')}>
              Reseñas ({recommendations.length}) {pendingReviewsCount > 0 && `(🔔 ${pendingReviewsCount})`}
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
              <span>Mesas con actividad</span>
              <strong>{groupedTableActivity.length}</strong>
            </div>
            <div className="stat">
              <span>Comandas activas</span>
              <strong>{orders.length}</strong>
            </div>
            <div className="stat">
              <span>Solicitudes de atención</span>
              <strong>{requests.length}</strong>
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
                className="button"
                onClick={() => {
                  const firstActive = tables.find((t) => t.active) || tables[0]
                  if (firstActive) openManualOrder(firstActive)
                }}
              >
                + Tomar pedido manual
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
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                              <button
                                type="button"
                                className="button"
                                style={{ padding: '6px 12px', fontSize: '11px' }}
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

                              <div className="order-card-footer" style={{ padding: '6px 0 0' }}>
                                <div className="order-total">{formatCop(orderSum)}</div>
                                <div className="order-actions">
                                  {ord.status === 'pending' && (
                                    <button
                                      type="button"
                                      className="action-primary"
                                      onClick={() => updateOrderStatus(ord.id, 'acknowledged')}
                                    >
                                      Recibir
                                    </button>
                                  )}
                                  {ord.status === 'acknowledged' && (
                                    <button
                                      type="button"
                                      className="action-primary"
                                      onClick={() => updateOrderStatus(ord.id, 'preparing')}
                                    >
                                      En preparación
                                    </button>
                                  )}
                                  {ord.status === 'preparing' && (
                                    <button
                                      type="button"
                                      className="action-primary"
                                      onClick={() => updateOrderStatus(ord.id, 'delivered')}
                                    >
                                      Entregado ✓
                                    </button>
                                  )}
                                  <button type="button" onClick={() => updateOrderStatus(ord.id, 'cancelled')}>
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
              <label htmlFor="menu-main-image">Foto principal</label>
              <input id="menu-main-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              <small className="field-help">JPG, PNG o WebP. Máximo 5 MB.{form.image_url && !imageFile ? ' La foto actual se conservará.' : ''}</small>
              <label htmlFor="menu-gallery-images">Fotos adicionales</label>
              <input id="menu-gallery-images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setGalleryFiles(Array.from(e.target.files || []))} />
              <small className="field-help">Puedes seleccionar varias fotos a la vez.{form.gallery_urls && !galleryFiles.length ? ' Las fotos actuales se conservarán.' : ''}</small>
              <label htmlFor="menu-category">Categoría</label>
              <select id="menu-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.icon} {cat.name} {!cat.active ? '(Inactiva)' : ''}
                    </option>
                  ))
                ) : (
                  <>
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
              {promotions.map((promo) => (
                <article className={`admin-item ${!promo.active ? 'unavailable' : ''}`} key={promo.id}>
                  <div>
                    <strong>
                      {promo.badge_text ? `[${promo.badge_text}] ` : ''}
                      {promo.title}
                    </strong>
                    {promo.description && (
                      <p style={{ margin: '4px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        {promo.description}
                      </p>
                    )}
                    <small>
                      {promo.linked_menu_item_id
                        ? `Vinculada a: ${items.find((i) => i.id === promo.linked_menu_item_id)?.name || 'Producto'}`
                        : 'Sin producto vinculado'}{' '}
                      · {promo.active ? 'Activa' : 'Inactiva'}
                    </small>
                  </div>
                  <div>
                    <button onClick={() => editPromo(promo)}>Editar</button>
                    <button onClick={() => removePromotion(promo)}>Eliminar</button>
                  </div>
                </article>
              ))}
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
              <label htmlFor="promo-product">Producto vinculado (opcional)</label>
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
      ) : (
        /* TAB: USUARIOS */
        <UserAdmin />
      )}

      {/* MODAL TOMA MANUAL DE PEDIDOS (Requisito 11) */}
      {manualOrderTable && (
        <div className="manual-order-overlay" onClick={() => setManualOrderTable(null)}>
          <div className="manual-order-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="manual-order-head">
              <div>
                <span className="eyebrow">Comanda manual</span>
                <h2>Tomar pedido · Mesa {manualOrderTable.label}</h2>
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
              {/* Buscador y filtro de categoría */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                  }}
                />
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                  }}
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
                  .filter((it) => it.available)
                  .filter(
                    (it) =>
                      (manualCategory === 'Todas' || it.category === manualCategory) &&
                      `${it.name} ${it.description}`.toLowerCase().includes(manualQuery.toLowerCase()),
                  )
                  .map((it) => (
                    <div className="manual-product-row" key={it.id}>
                      <div>
                        <strong>{it.name}</strong>
                        <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                          {formatCop(it.price_cop)} · {it.category}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="button"
                        style={{ padding: '6px 12px', fontSize: '11px' }}
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
                  <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>
                    Productos en la comanda ({manualCart.reduce((sum, ci) => sum + ci.quantity, 0)}):
                  </span>
                  {manualCart.map(({ item, quantity, notes }) => (
                    <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <strong>{item.name}</strong>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                            {formatCop(item.price_cop * quantity)}
                          </span>
                        </div>
                        <div className="cart-qty-picker">
                          <button type="button" onClick={() => updateManualQty(item.id, -1)}>
                            −
                          </button>
                          <span>{quantity}</span>
                          <button type="button" onClick={() => updateManualQty(item.id, 1)}>
                            +
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Nota (ej. sin azúcar)"
                        value={notes}
                        onChange={(e) => updateManualItemNotes(item.id, e.target.value)}
                        style={{
                          fontSize: '11px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--text)',
                        }}
                      />
                    </div>
                  ))}
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700 }}>Nota general:</label>
                    <input
                      type="text"
                      placeholder="Instrucciones para barra o cocina..."
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      style={{
                        width: '100%',
                        fontSize: '12px',
                        padding: '6px 8px',
                        marginTop: '4px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="manual-order-footer">
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total comanda:</span>
                <strong style={{ display: 'block', fontSize: '18px', color: 'var(--orange)' }}>
                  {formatCop(
                    manualCart.reduce((sum, ci) => sum + ci.item.price_cop * ci.quantity, 0),
                  )}
                </strong>
              </div>
              <button
                type="button"
                className="button"
                style={{ background: 'var(--orange)', color: '#fff' }}
                disabled={manualSubmitting || !manualCart.length}
                onClick={submitManualOrder}
              >
                {manualSubmitting ? 'Registrando…' : 'Crear comanda'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
