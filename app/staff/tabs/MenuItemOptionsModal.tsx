'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MenuItemOptionGroup } from '@/lib/types'

type MenuItemOptionsModalProps = {
  menuItemId: string
  menuItemName: string
  onClose: () => void
}

function formatCop(value?: number | null) {
  const safe = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(safe)
}

export default function MenuItemOptionsModal({
  menuItemId,
  menuItemName,
  onClose,
}: MenuItemOptionsModalProps) {
  const [supabase] = useState(() => createClient())
  const [groups, setGroups] = useState<MenuItemOptionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Formulario de nuevo grupo
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupKind, setNewGroupKind] = useState<'single' | 'multi'>('single')
  const [newGroupRequired, setNewGroupRequired] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)

  // Formulario de nueva opción por grupo
  const [addingChoiceGroupId, setAddingChoiceGroupId] = useState<string | null>(null)
  const [newChoiceLabel, setNewChoiceLabel] = useState('')
  const [newChoiceDelta, setNewChoiceDelta] = useState('0')
  const [creatingChoice, setCreatingChoice] = useState(false)

  async function loadGroups() {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('menu_item_option_groups')
      .select('id,menu_item_id,name,kind,required,sort_order,active,choices:menu_item_option_choices(id,group_id,label,price_delta_cop,sort_order,active)')
      .eq('menu_item_id', menuItemId)
      .order('sort_order')

    if (err) {
      setError('Error al cargar grupos: ' + err.message)
    } else if (data) {
      setGroups(data as MenuItemOptionGroup[])
    }
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    async function fetchInitial() {
      const { data, error: err } = await supabase
        .from('menu_item_option_groups')
        .select('id,menu_item_id,name,kind,required,sort_order,active,choices:menu_item_option_choices(id,group_id,label,price_delta_cop,sort_order,active)')
        .eq('menu_item_id', menuItemId)
        .order('sort_order')

      if (!active) return
      if (err) {
        setError('Error al cargar grupos: ' + err.message)
      } else if (data) {
        setGroups(data as MenuItemOptionGroup[])
      }
      setLoading(false)
    }

    void fetchInitial()
    return () => {
      active = false
    }
  }, [supabase, menuItemId])

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!newGroupName.trim()) return

    setCreatingGroup(true)
    const { error: insErr } = await supabase.from('menu_item_option_groups').insert({
      menu_item_id: menuItemId,
      name: newGroupName.trim(),
      kind: newGroupKind,
      required: newGroupRequired,
      sort_order: groups.length,
      active: true,
    })

    setCreatingGroup(false)
    if (insErr) {
      setError('Error al crear grupo: ' + insErr.message)
    } else {
      setNewGroupName('')
      setNewGroupKind('single')
      setNewGroupRequired(false)
      void loadGroups()
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!confirm('¿Seguro que deseas eliminar este grupo y todas sus opciones?')) return
    const { error: delErr } = await supabase
      .from('menu_item_option_groups')
      .delete()
      .eq('id', groupId)

    if (delErr) {
      setError('Error al eliminar grupo: ' + delErr.message)
    } else {
      void loadGroups()
    }
  }

  async function handleCreateChoice(groupId: string, e: React.FormEvent) {
    e.preventDefault()
    if (!newChoiceLabel.trim()) return

    setCreatingChoice(true)
    const delta = Math.max(0, parseInt(newChoiceDelta, 10) || 0)
    const currentGroup = groups.find((g) => g.id === groupId)
    const sortOrder = currentGroup?.choices?.length || 0

    const { error: insErr } = await supabase.from('menu_item_option_choices').insert({
      group_id: groupId,
      label: newChoiceLabel.trim(),
      price_delta_cop: delta,
      sort_order: sortOrder,
      active: true,
    })

    setCreatingChoice(false)
    if (insErr) {
      setError('Error al crear opción: ' + insErr.message)
    } else {
      setNewChoiceLabel('')
      setNewChoiceDelta('0')
      setAddingChoiceGroupId(null)
      void loadGroups()
    }
  }

  async function handleDeleteChoice(choiceId: string) {
    const { error: delErr } = await supabase
      .from('menu_item_option_choices')
      .delete()
      .eq('id', choiceId)

    if (delErr) {
      setError('Error al eliminar opción: ' + delErr.message)
    } else {
      void loadGroups()
    }
  }

  return (
    <div className="bottom-sheet-backdrop" onClick={onClose}>
      <div
        className="card"
        style={{
          maxWidth: 680,
          width: '95%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 24,
          background: 'var(--surface-card)',
          borderRadius: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--orange)', fontWeight: 700 }}>
              Personalización de Producto
            </span>
            <h3 style={{ margin: '2px 0 0', fontSize: '18px' }}>
              Grupos y Variantes: {menuItemName}
            </h3>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} aria-label="Cerrar modal">
            ✕
          </button>
        </div>

        {error && (
          <div style={{ margin: '0 0 16px', padding: '10px 14px', borderRadius: 10, background: 'rgba(234, 67, 53, 0.12)', color: '#b3391b', fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando grupos de opciones...</p>
        ) : (
          <div>
            {groups.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
                Este producto no tiene opciones configuradas. Los clientes solo podrán escribir notas generales.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                {groups.map((grp) => (
                  <div
                    key={grp.id}
                    className="card"
                    style={{
                      padding: 16,
                      background: 'var(--surface-card-warm)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <strong style={{ fontSize: 15 }}>{grp.name}</strong>
                        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                          ({grp.kind === 'single' ? 'Opción única' : 'Múltiple'} · {grp.required ? 'Obligatorio' : 'Opcional'})
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => setAddingChoiceGroupId(grp.id)}
                          id={`btn-add-choice-${grp.id}`}
                        >
                          + Añadir opción
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger-outline"
                          onClick={() => handleDeleteGroup(grp.id)}
                          aria-label={`Eliminar grupo ${grp.name}`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Lista de opciones del grupo */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      {(grp.choices || []).map((ch) => (
                        <div
                          key={ch.id}
                          className="filter-chip"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 10px',
                            fontSize: 13,
                          }}
                        >
                          <span>{ch.label}</span>
                          <span style={{ fontWeight: 600, color: 'var(--orange)' }}>
                            {ch.price_delta_cop > 0 ? `+${formatCop(ch.price_delta_cop)}` : 'Gratis'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteChoice(ch.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '0 2px',
                            }}
                            aria-label={`Eliminar ${ch.label}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {(!grp.choices || grp.choices.length === 0) && (
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          Sin opciones creadas aún. Haz clic en &ldquo;+ Añadir opción&rdquo;.
                        </span>
                      )}
                    </div>

                    {/* Subformulario para añadir opción al grupo */}
                    {addingChoiceGroupId === grp.id && (
                      <form
                        onSubmit={(e) => handleCreateChoice(grp.id, e)}
                        style={{
                          marginTop: 12,
                          padding: 12,
                          background: 'var(--surface-card)',
                          borderRadius: 8,
                          display: 'flex',
                          gap: 10,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <input
                          type="text"
                          placeholder="Etiqueta (ej. Leche de almendras)"
                          value={newChoiceLabel}
                          onChange={(e) => setNewChoiceLabel(e.target.value)}
                          className="input input-sm"
                          style={{ flex: 2, minWidth: 160 }}
                          autoFocus
                          required
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 130 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>+$</span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            placeholder="Delta COP"
                            value={newChoiceDelta}
                            onChange={(e) => setNewChoiceDelta(e.target.value)}
                            className="input input-sm"
                            style={{ width: '100%' }}
                            required
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="submit" className="btn btn-sm btn-primary" disabled={creatingChoice}>
                            {creatingChoice ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => setAddingChoiceGroupId(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Formulario para crear un nuevo grupo */}
            <form
              onSubmit={handleCreateGroup}
              style={{
                padding: 16,
                background: 'var(--surface-card-warm)',
                border: '1.5px dashed var(--border)',
                borderRadius: 12,
              }}
            >
              <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>Crear Nuevo Grupo de Opciones</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Nombre del grupo</label>
                  <input
                    type="text"
                    placeholder="Ej: Tipo de Leche, Tamaño, Extras"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="input input-sm"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Tipo de selección</label>
                  <select
                    value={newGroupKind}
                    onChange={(e) => setNewGroupKind(e.target.value as 'single' | 'multi')}
                    className="input input-sm"
                  >
                    <option value="single">Selección única (1 opción)</option>
                    <option value="multi">Selección múltiple (varias)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 18 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newGroupRequired}
                      onChange={(e) => setNewGroupRequired(e.target.checked)}
                    />
                    Obligatorio para pedir
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={creatingGroup || !newGroupName.trim()}
                id="btn-create-option-group"
              >
                {creatingGroup ? 'Creando grupo...' : '+ Crear Grupo'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
