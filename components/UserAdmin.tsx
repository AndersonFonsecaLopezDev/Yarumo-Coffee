'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { normalizeText } from '@/lib/filters'
import { useConfirm } from '@/components/ConfirmModal'

type User = { id: string; email?: string; lastSignInAt?: string | null; profile: { display_name: string; role: string } | null }
const empty = { email: '', password: '', displayName: '', role: 'staff' }

export default function UserAdmin() {
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState<User | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'owner' | 'manager' | 'staff'>('all')

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) {
        setMessage(data.error || 'No se pudieron cargar los usuarios')
        return
      }
      setUsers(data)
    } catch {
      setMessage('Error de conexión al cargar usuarios')
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function init() {
      try {
        const response = await fetch('/api/admin/users', { cache: 'no-store' })
        const data = await response.json()
        if (!mounted) return
        if (!response.ok) {
          setMessage(data.error || 'No se pudieron cargar los usuarios')
          return
        }
        setUsers(data)
      } catch {
        if (mounted) setMessage('Error de conexión al cargar usuarios')
      }
    }
    void init()
    return () => {
      mounted = false
    }
  }, [])

  function startEdit(user: User) {
    setEditing(user)
    setForm({
      email: user.email || '',
      password: '',
      displayName: user.profile?.display_name || '',
      role: (user.profile?.role || 'staff').toLowerCase(),
    })
  }

  function reset() {
    setEditing(null)
    setForm(empty)
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    const response = await fetch('/api/admin/users', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        editing
          ? { id: editing.id, displayName: form.displayName, role: form.role, password: form.password || undefined }
          : form,
      ),
    })
    const data = await response.json()
    setSaving(false)
    if (!response.ok) {
      setMessage(data.error || 'No se pudo guardar')
      return
    }
    reset()
    await load()
  }

  const { confirm, ConfirmDialog } = useConfirm()

  async function remove(user: User) {
    const ok = await confirm({
      title: '¿Eliminar usuario?',
      message: `¿Estás seguro de que deseas eliminar permanentemente la cuenta de ${user.email || 'este usuario'}?`,
      confirmText: 'Eliminar usuario',
      danger: true,
    })
    if (!ok) return
    const response = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok) setMessage(data.error || 'No se pudo eliminar')
    else await load()
  }

  const filteredUsers = useMemo(() => {
    const q = normalizeText(searchQuery)
    return users.filter((u) => {
      if (roleFilter !== 'all' && (u.profile?.role || '').toLowerCase() !== roleFilter) return false
      if (q) {
        const name = normalizeText(u.profile?.display_name)
        const email = normalizeText(u.email)
        if (!name.includes(q) && !email.includes(q)) return false
      }
      return true
    })
  }, [users, searchQuery, roleFilter])

  return (
    <section className="user-admin">
      <div className="menu-admin-head">
        <div>
          <span className="eyebrow">Accesos</span>
          <h2>Usuarios del equipo.</h2>
        </div>
        <button className="button" onClick={reset}>
          + Nuevo usuario
        </button>
      </div>

      {/* Barra de Filtros de Usuarios */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input
          type="search"
          placeholder="Buscar por nombre o correo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input"
          style={{ flex: 1, minWidth: 200 }}
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as 'all' | 'owner' | 'manager' | 'staff')}
          className="input"
          style={{ minWidth: 140 }}
        >
          <option value="all">Todos los roles</option>
          <option value="owner">Owner</option>
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
        </select>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Mostrando {filteredUsers.length} de {users.length} usuarios
        </span>
      </div>

      {message && <p className="admin-error">{message}</p>}
      <div className="user-grid">
        <div className="admin-list">
          {filteredUsers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: 12 }}>No se encontraron usuarios coincidentes.</p>
          ) : (
            filteredUsers.map((user) => (
              <article className="admin-item" key={user.id}>
                <div>
                  <strong>{user.profile?.display_name || user.email}</strong>
                  <small>
                    {user.email} · {user.profile?.role || 'sin perfil'}
                  </small>
                </div>
                <div>
                  <button onClick={() => startEdit(user)}>Editar</button>
                  <button onClick={() => remove(user)}>Eliminar</button>
                </div>
              </article>
            ))
          )}
        </div>
        <form className="menu-form" onSubmit={save}>
          <h3>{editing ? 'Editar usuario' : 'Nuevo usuario'}</h3>
          {!editing && (
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Correo"
              required
            />
          )}
          {editing && <input value={form.email} readOnly aria-label="Correo del usuario" />}
          <input
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            placeholder="Nombre"
            required
          />
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={editing ? 'Nueva contraseña (opcional)' : 'Contraseña, mínimo 10 caracteres'}
            minLength={editing ? 0 : 10}
            required={!editing}
          />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
            <option value="owner">Owner</option>
          </select>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar usuario'}
            </button>
            {editing && (
              <button type="button" className="btn btn-secondary" onClick={reset}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
      <ConfirmDialog />
    </section>
  )
}
