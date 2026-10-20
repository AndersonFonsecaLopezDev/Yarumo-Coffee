'use client'

import { useState, useMemo } from 'react'

type HelpTopic = {
  id: string
  category: 'orders' | 'menu' | 'qr' | 'promotions' | 'reviews' | 'settings' | 'faq'
  title: string
  badge: string
  summary: string
  steps: string[]
  tips?: string[]
}

const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'orders-flow',
    category: 'orders',
    title: 'Flujo de Comandas y Pedidos en Mesa',
    badge: 'Operación Diaria',
    summary: 'Cómo recibir, confirmar, preparar y entregar los pedidos realizados por los clientes desde el código QR.',
    steps: [
      'Entrada del pedido: Cuando un cliente pide desde su celular, el pedido entra inmediatamente a la pestaña "Actividad" en estado "Pendiente" y suena una alerta sonora.',
      'Confirmar pedido: El barista o mesero toca "Confirmar". El estado pasa a "Confirmado" y el cliente ve en su celular en tiempo real que su orden fue aceptada.',
      'En preparación: Al iniciar la preparación del café o plato, se cambia a "En preparación". El cliente ve una animación de preparación con el tiempo estimado.',
      'Entregar: Una vez llevado a la mesa, se marca como "Entregado". Esto finaliza el ciclo activo del pedido.',
      'Cancelar / Rechazar: Si un producto se agotó en ese instante o el cliente cancela, se marca "Cancelar" ingresando el motivo.',
    ],
    tips: [
      'Las órdenes se actualizan en vivo vía WebSockets de Supabase sin necesidad de recargar la página.',
      'Puedes filtrar la lista de actividad por estado para enfocarte en lo que está pendiente.',
    ],
  },
  {
    id: 'service-requests',
    category: 'orders',
    title: 'Llamados de Mesero y Solicitudes de Cuenta',
    badge: 'Atención al Cliente',
    summary: 'Cómo gestionar cuando un comensal solicita asistencia o la factura desde su mesa.',
    steps: [
      'Alerta de servicio: En la columna "Solicitudes de Mesa", verás tarjetas destacadas con el número de mesa y el tipo (Llamar Mesero 🔔 o Pedir Cuenta 💵).',
      'Atender solicitud: Un miembro del personal se acerca a la mesa física y presiona "Atender" en el panel.',
      'Historial: Una vez atendida, la solicitud se archiva para mantener la pantalla despejada.',
    ],
    tips: [
      'Las solicitudes de cuenta tienen prioridad alta: acércate con el datáfono o factura impresa de inmediato.',
    ],
  },
  {
    id: 'menu-crud',
    category: 'menu',
    title: 'Agregar y Modificar Productos del Menú',
    badge: 'Catálogo',
    summary: 'Paso a paso para crear nuevos cafés, platos, actualizar precios y pausar productos agotados.',
    steps: [
      'Crear producto: En la pestaña "Menú", haz clic en "+ Nuevo Producto". Llena el nombre, descripción sugerente, precio en pesos colombianos (COP) y categoría.',
      'Subir foto principal: Selecciona una imagen clara del producto en formato WebP, JPG o PNG (máximo 5 MB).',
      'Galería fotográfica: Puedes subir múltiples fotos adicionales para que el cliente pueda abrir la galería deslizable al tocar el plato.',
      'Etiquetas (Tags): Agrega badges destacados como "Recomendado del barista", "Nuevo", "Vegano" o "Sin azúcar".',
      'Pausar / Agotar: Si un insumo se terminó temporalmente, usa el botón "Agotar / Desactivar". El producto desaparecerá del menú público al instante sin tener que borrarlo.',
    ],
    tips: [
      'El campo "Orden" (sort_order) determina en qué posición numérica aparece el producto dentro de su categoría.',
      'Las fotos cuadradas o con relación 4:3 se ven mejor en celulares.',
    ],
  },
  {
    id: 'categories-management',
    category: 'menu',
    title: 'Organización de Categorías y Pestañas',
    badge: 'Navegación',
    summary: 'Cómo crear nuevas secciones (ej: Temporada Navideña, Repostería, Filtrados) y ordenar las pestañas.',
    steps: [
      'Ir a "Categorías": Encontrarás el listado de categorías activas (Bebidas Calientes, Frías, Panadería, etc.).',
      'Crear o editar: Asigna un nombre claro, un emoji o icono representativo (☕, 🥐, 🧊) y su orden numérico.',
      'Activar/Desactivar: Si una categoría es estacional, puedes desactivarla y todos sus productos se pausarán temporalmente.',
    ],
    tips: [
      'Las categorías con menor número de orden aparecen primero a la izquierda en la carta del cliente.',
    ],
  },
  {
    id: 'qr-codes',
    category: 'qr',
    title: 'Generación e Impresión de Códigos QR para Mesas',
    badge: 'Mesas',
    summary: 'Cómo configurar las mesas del local y descargar los códigos QR para acrílicos o madera.',
    steps: [
      'Ver mesas: En la pestaña "Mesas y QR" verás todas las mesas registradas con su código QR generado automáticamente.',
      'Descargar para impresión: Haz clic en "Descargar QR" en la mesa deseada para obtener el archivo PNG en alta resolución.',
      'Probar el QR: Escanéalo con tu propio celular para verificar que abra la carta con el parámetro ?mesa=TOKEN correspondiente a esa mesa.',
      'Agregar nuevas mesas: Haz clic en "+ Nueva Mesa" e ingresa el número o etiqueta de la mesa.',
    ],
    tips: [
      'Cada mesa tiene un token criptográfico único. Si alguien intenta hacer pedidos sin un token de mesa válido, el sistema lo bloqueará automáticamente.',
      'Recomendamos imprimir los QR en tamaño mínimo de 6x6 cm para facilitar la lectura con cámaras de celular.',
    ],
  },
  {
    id: 'promotions-tab',
    category: 'promotions',
    title: 'Creación de Promociones y Combos',
    badge: 'Marketing',
    summary: 'Cómo publicar ofertas destacadas que aparecen en la parte superior del menú digital.',
    steps: [
      'Nueva promoción: En la pestaña "Promociones", presiona "+ Nueva Promoción".',
      'Configurar texto: Ingresa un título llamativo (ej: "Tarde de Café & Croissant"), descripción de la oferta y un badge (ej: "2x1", "Especial de la Semana").',
      'Vincular producto: Puedes asociar la promoción directamente a un ítem del menú para que al tocarlo el cliente lo agregue al carrito con un clic.',
      'Programar fechas: Establece fecha y hora de inicio y de expiración opcional.',
    ],
  },
  {
    id: 'recommendations-moderation',
    category: 'reviews',
    title: 'Moderación de Opiniones y Reseñas de Clientes',
    badge: 'Reputación',
    summary: 'Cómo supervisar las calificaciones dejadas por comensales antes de que aparezcan en /recomendaciones.',
    steps: [
      'Revisar pendientes: En la pestaña "Opiniones", verás los comentarios y estrellas (1 a 5) dejados por los clientes en mesa.',
      'Aprobar / Publicar: Si el comentario es respetuoso y constructivo, haz clic en "Publicar" para que sume a la reputación pública.',
      'Ocultar: Si contiene lenguaje inapropiado o datos erróneos, haz clic en "Ocultar".',
    ],
  },
  {
    id: 'settings-store',
    category: 'settings',
    title: 'Foto de Portada, Tiempo Estimado y WhatsApp',
    badge: 'Ajustes',
    summary: 'Ajustes generales del local visibles para todos los visitantes.',
    steps: [
      'Foto de portada (Hero): En la pestaña "Ajustes", puedes cambiar la foto principal de Yarumo Coffee subiendo un archivo nuevo.',
      'Tiempo estimado de espera: Configura los minutos aproximados de preparación (ej: 12-18 min). Esto informa las expectativas del cliente y reduce la ansiedad de espera.',
      'WhatsApp de pedidos: Configura el número celular para donde se redirigirán los pedidos de domicilio.',
    ],
  },
  {
    id: 'faq-offline',
    category: 'faq',
    title: '¿Qué hacer si se cae el Internet o falla el WiFi?',
    badge: 'Contingencia',
    summary: 'Procedimiento operativo ante problemas de conectividad en el establecimiento.',
    steps: [
      'Carta offline: La carta digital de Yarumo cuenta con tecnología PWA (Progressive Web App). Los clientes que ya abrieron la carta pueden seguir viendo los platos y precios sin internet.',
      'Pedido por WhatsApp: Si la red de la cafetería no procesa la comanda en vivo, el cliente puede tocar el botón flotante "Pedir por WhatsApp", que genera un mensaje de texto preformateado con todo su pedido.',
      'Verificar conexión del router: Si la pantalla de Staff no recibe pedidos, verifica la conexión WiFi del dispositivo y recarga la pestaña "Actividad".',
    ],
  },
  {
    id: 'faq-roles',
    category: 'faq',
    title: 'Diferencias entre Roles (Owner, Manager, Staff)',
    badge: 'Seguridad',
    summary: 'Niveles de acceso y permisos dentro del aplicativo administrativo.',
    steps: [
      'Staff / Barista: Acceso enfocado en "Actividad" (comandas, llamados de mesero), disponibilidad rápida del menú y opiniones.',
      'Manager: Puede crear y editar productos, categorías, promociones y gestionar códigos QR de mesas.',
      'Owner (Propietario): Acceso total, incluyendo creación y revocación de cuentas de usuarios del personal y ajustes críticos de la cafetería.',
    ],
  },
]

export default function HelpTab() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [openTopicId, setOpenTopicId] = useState<string>('orders-flow')

  const filteredTopics = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return HELP_TOPICS.filter((t) => {
      const matchCat = selectedCategory === 'all' || t.category === selectedCategory
      if (!matchCat) return false
      if (!q) return true
      return (
        t.title.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        t.steps.some((s) => s.toLowerCase().includes(q))
      )
    })
  }, [searchQuery, selectedCategory])

  return (
    <div className="tab-pane help-tab-pane">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.6rem', marginBottom: 6 }}>Centro de Ayuda y Manuales de Operación</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Guías paso a paso, procedimientos para baristas y administradores, y solución de incidencias en Yarumo Coffee.
        </p>
      </div>

      {/* Buscador de instructivos */}
      <div
        style={{
          background: 'var(--surface-card)',
          padding: 16,
          borderRadius: 16,
          border: '1px solid var(--border)',
          marginBottom: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="input"
            placeholder="🔍 Buscar en manuales (ej: pedidos, mesas, fotos, wifi, roles)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '0.95rem',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filtros por tema */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'orders', label: '☕ Comandas & Pedidos' },
            { id: 'menu', label: '📋 Menú & Productos' },
            { id: 'qr', label: '🪑 Mesas & QR' },
            { id: 'promotions', label: '🎯 Promociones' },
            { id: 'reviews', label: '⭐ Opiniones' },
            { id: 'settings', label: '⚙️ Ajustes' },
            { id: 'faq', label: '❓ Preguntas Frecuentes' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: selectedCategory === cat.id ? '1.5px solid var(--ink)' : '1px solid var(--border)',
                background: selectedCategory === cat.id ? 'var(--ink)' : 'transparent',
                color: selectedCategory === cat.id ? 'var(--lime)' : 'var(--text)',
                transition: 'all 0.15s ease',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de temas interactiva (Accordion) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filteredTopics.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <p>No se encontraron temas que coincidan con &quot;{searchQuery}&quot;.</p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSearchQuery('')
                setSelectedCategory('all')
              }}
              style={{ marginTop: 12 }}
            >
              Ver todos los manuales
            </button>
          </div>
        ) : (
          filteredTopics.map((topic) => {
            const isOpen = openTopicId === topic.id
            return (
              <div
                key={topic.id}
                style={{
                  background: 'var(--surface-card)',
                  borderRadius: 16,
                  border: isOpen ? '1.5px solid var(--ink)' : '1px solid var(--border)',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s ease',
                }}
              >
                {/* Cabecera del tema */}
                <button
                  type="button"
                  onClick={() => setOpenTopicId(isOpen ? '' : topic.id)}
                  style={{
                    width: '100%',
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(24, 54, 47, 0.08)',
                        color: 'var(--text)',
                      }}
                    >
                      {topic.badge}
                    </span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text)' }}>{topic.title}</strong>
                  </div>
                  <span
                    style={{
                      fontSize: '1.2rem',
                      color: 'var(--text-muted)',
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    ▼
                  </span>
                </button>

                {/* Contenido desplegable */}
                {isOpen && (
                  <div
                    style={{
                      padding: '0 20px 20px',
                      borderTop: '1px solid var(--border)',
                      paddingTop: 16,
                    }}
                  >
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: 16, lineHeight: 1.5 }}>
                      {topic.summary}
                    </p>

                    <h4 style={{ fontSize: '0.9rem', marginBottom: 10, color: 'var(--text)' }}>
                      Pasos del procedimiento:
                    </h4>
                    <ol style={{ paddingLeft: 20, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {topic.steps.map((step, idx) => (
                        <li key={idx} style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text)' }}>
                          {step}
                        </li>
                      ))}
                    </ol>

                    {topic.tips && topic.tips.length > 0 && (
                      <div
                        style={{
                          background: 'rgba(217, 232, 106, 0.15)',
                          borderLeft: '4px solid var(--lime)',
                          padding: '12px 14px',
                          borderRadius: 8,
                          marginTop: 12,
                        }}
                      >
                        <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text)', marginBottom: 4 }}>
                          💡 Buenas prácticas del Barista:
                        </strong>
                        <ul style={{ paddingLeft: 18, margin: 0 }}>
                          {topic.tips.map((tip, idx) => (
                            <li key={idx} style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Soporte y ayuda directa */}
      <div
        style={{
          marginTop: 32,
          padding: 20,
          background: 'var(--ink)',
          color: 'var(--cream)',
          borderRadius: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <strong style={{ fontSize: '1.1rem', display: 'block', marginBottom: 4 }}>
            ¿Necesitas ayuda técnica adicional?
          </strong>
          <span style={{ fontSize: '0.9rem', opacity: 0.85 }}>
            Soporte técnico para el sistema de carta digital y comanderas de Yarumo Coffee.
          </span>
        </div>
        <a
          href="https://wa.me/573192208938?text=Hola,%20necesito%20soporte%20técnico%20con%20el%20sistema%20de%20Yarumo%20Coffee"
          target="_blank"
          rel="noreferrer"
          className="btn"
          style={{
            background: 'var(--lime)',
            color: 'var(--ink)',
            fontWeight: 800,
            padding: '10px 20px',
            borderRadius: 24,
            textDecoration: 'none',
          }}
        >
          💬 Contactar Soporte Técnico
        </a>
      </div>
    </div>
  )
}
