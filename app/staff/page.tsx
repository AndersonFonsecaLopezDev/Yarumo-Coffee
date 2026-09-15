'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import UserAdmin from '@/components/UserAdmin'

type Request = { id: string; type: 'waiter' | 'bill'; status: string; created_at: string; table: { label: string } | null }
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
}

export default function Staff() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<string | null>(null)
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [requests, setRequests] = useState<Request[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [tab, setTab] = useState<'requests' | 'menu' | 'users'>('requests')
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [form, setForm] = useState<MenuForm>(blank)
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
      .select('id,name,slug,description,price_cop,category,available,sort_order,image_url')
      .order('sort_order')
      .order('name')
    setItems((menu.data || []) as MenuItem[])
  }, [supabase])

  useEffect(() => {
    let active = true
    async function init() {
      if (!active) return
      await load()
    }
    void init()

    const channel = supabase
      .channel('staff-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => {
        if (active) void load()
      })
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [load, supabase])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) setError('Correo o contraseña incorrectos.')
    else await load()
  }

  async function complete(id: string) {
    await supabase.from('service_requests').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', id)
    await load()
  }

  function edit(item: MenuItem) {
    setEditing(item)
    setForm({ ...item, image_url: item.image_url || '' })
  }

  function newItem() {
    setEditing(null)
    setForm(blank)
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || form.price_cop < 0) {
      setError('Completa un nombre y un precio válido.')
      return
    }
    setSaving(true)
    setError('')
    const imageUrl = form.image_url.trim() || null
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

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="login-brand">
            <div className="login-logo-wrap">
              <img src="/yarumo-logo.png" alt="Yarumo Coffee" width="96" height="96" />
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
              <input
                id="staff-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
                required
              />
              <button className="button" type="submit">
                Entrar al panel <span aria-hidden="true">→</span>
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
        <button className="button" onClick={() => supabase.auth.signOut()}>
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
            <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
              Usuarios
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
          <div className="menu-admin-grid">
            <div className="admin-list">
              {items.map((item) => (
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
            </div>
            <form className="menu-form" onSubmit={saveItem}>
              <h3>{editing ? 'Editar producto' : 'Nuevo producto'}</h3>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nombre"
                required
              />
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="slug-opcional"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descripción"
                maxLength={500}
              />
              <input
                type="number"
                min="0"
                value={form.price_cop}
                onChange={(e) => setForm({ ...form, price_cop: Number(e.target.value) })}
                placeholder="Precio en pesos colombianos"
                required
              />
              <input
                type="url"
                value={form.image_url || ''}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="URL pública de la foto (Supabase Storage)"
              />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option>Bebidas Calientes</option>
                <option>Bebidas Frías</option>
                <option>Gaseosas</option>
                <option>Cervezas</option>
                <option>Antojitos Panaderos</option>
                <option>Sánduches</option>
                <option>Tortas y Brownies</option>
                <option>Hojaldrados</option>
                <option>Pizzetas</option>
                <option>Otros</option>
              </select>
              <input
                type="number"
                min="0"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                placeholder="Orden"
              />
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
      ) : (
        <UserAdmin />
      )}
    </main>
  )
}
