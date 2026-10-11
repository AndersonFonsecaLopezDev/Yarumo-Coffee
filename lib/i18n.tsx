'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Language = 'es' | 'en'

export const translations = {
  es: {
    // Header
    nav_home: 'Inicio',
    nav_menu: 'Carta Digital',
    nav_opinions: 'Opiniones',
    table_badge: 'Mesa',
    takeaway: 'Para llevar / Barra',
    lang_switch: 'English',

    // Hero
    hero_eyebrow: 'Armenia · Quindío · Colombia',
    hero_title_1: 'Donde cada taza',
    hero_title_2: 'cuenta una historia.',
    hero_desc:
      'Café especial cultivado en las montañas del Quindío, tostado con precisión y servido con calidez en tu mesa.',
    hero_cta: 'Ver carta digital ↓',
    hero_badge: '☕ Atención en mesa y domicilios',
    hero_origin_title: 'Café de Origen',
    hero_origin_sub: 'Armenia, Quindío',

    // Catalog
    tab_all: 'Todos',
    tab_favorites: 'Favoritos',
    search_placeholder: 'Buscar café, postre o ingrediente...',
    showing_items: 'Mostrando',
    of_items: 'de',
    products: 'productos',
    in_order: 'en pedido',
    btn_add: '+ Agregar',
    btn_added: 'Agregado ✓',
    no_results: 'No encontramos productos que coincidan con tu búsqueda.',
    clear_search: 'Limpiar búsqueda',

    // Variants & Details Modal
    modal_details: 'Detalles del producto',
    modal_price: 'Precio',
    modal_allergens: 'Información dietética y alérgenos',
    modal_variants: 'Personaliza tu preparación',
    modal_notes_label: 'Instrucciones especiales para el barista',
    modal_notes_ph: 'Ej: con hielo suave, servido bien caliente...',
    modal_add_to_cart: 'Agregar al pedido',
    modal_share: 'Compartir en WhatsApp',

    // Order Cart
    cart_title: 'Tu Pedido',
    cart_empty_title: 'Tu pedido está vacío',
    cart_empty_desc: 'Explora nuestra carta y agrega tus cafés y postres favoritos.',
    cart_explore: 'Ver la carta',
    cart_table_label: 'Pedido para Mesa',
    cart_delivery_label: 'Pedido a Domicilio',
    cart_notes_label: 'Notas generales del pedido',
    cart_send_kitchen: 'Enviar comanda a barra',
    cart_send_whatsapp: 'Enviar pedido por WhatsApp',
    cart_sending: 'Enviando…',
    cart_total: 'Total',
    cart_clear: 'Vaciar carrito',
    cart_delete_confirm: '¿Eliminar este producto del pedido?',

    // Tracker
    tracker_active: 'Comanda en curso',
    tracker_status_pending: 'Recibido en barra',
    tracker_status_preparing: 'En preparación',
    tracker_status_delivered: 'Entregado en mesa',
    call_waiter: 'Llamar mesero',
    request_bill: 'Pedir la cuenta',
    request_sent: 'Solicitud enviada a barra',
  },
  en: {
    // Header
    nav_home: 'Home',
    nav_menu: 'Digital Menu',
    nav_opinions: 'Reviews',
    table_badge: 'Table',
    takeaway: 'Takeaway / Counter',
    lang_switch: 'Español',

    // Hero
    hero_eyebrow: 'Armenia · Quindío · Colombia',
    hero_title_1: 'Where every cup',
    hero_title_2: 'tells a story.',
    hero_desc:
      'Specialty coffee harvested in the mountains of Quindío, roasted with craft and served with warmth at your table.',
    hero_cta: 'Explore digital menu ↓',
    hero_badge: '☕ Table service & deliveries',
    hero_origin_title: 'Single Origin Coffee',
    hero_origin_sub: 'Armenia, Quindío',

    // Catalog
    tab_all: 'All',
    tab_favorites: 'Favorites',
    search_placeholder: 'Search coffee, pastry or ingredient...',
    showing_items: 'Showing',
    of_items: 'of',
    products: 'items',
    in_order: 'in order',
    btn_add: '+ Add',
    btn_added: 'Added ✓',
    no_results: 'No products found matching your search.',
    clear_search: 'Clear search',

    // Variants & Details Modal
    modal_details: 'Product details',
    modal_price: 'Price',
    modal_allergens: 'Dietary & allergen information',
    modal_variants: 'Customize your drink',
    modal_notes_label: 'Special barista notes',
    modal_notes_ph: 'E.g., extra hot, light ice...',
    modal_add_to_cart: 'Add to order',
    modal_share: 'Share on WhatsApp',

    // Order Cart
    cart_title: 'Your Order',
    cart_empty_title: 'Your cart is empty',
    cart_empty_desc: 'Browse our menu and pick your favorite coffees and treats.',
    cart_explore: 'Browse menu',
    cart_table_label: 'Order for Table',
    cart_delivery_label: 'Delivery Order',
    cart_notes_label: 'General order notes',
    cart_send_kitchen: 'Send order to bar',
    cart_send_whatsapp: 'Order via WhatsApp',
    cart_sending: 'Sending…',
    cart_total: 'Total',
    cart_clear: 'Clear cart',
    cart_delete_confirm: 'Remove this item from your order?',

    // Tracker
    tracker_active: 'Active order',
    tracker_status_pending: 'Received at counter',
    tracker_status_preparing: 'Preparing',
    tracker_status_delivered: 'Delivered to table',
    call_waiter: 'Call server',
    request_bill: 'Request bill',
    request_sent: 'Request sent to counter',
  },
} as const

export type TranslationKey = keyof typeof translations.es

type I18nContextType = {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextType>({
  language: 'es',
  setLanguage: () => {},
  t: (key) => translations.es[key] || key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'es'
    try {
      const stored = localStorage.getItem('yarumo-lang')
      if (stored === 'es' || stored === 'en') return stored
      if (navigator.language?.startsWith('en')) return 'en'
    } catch {}
    return 'es'
  })

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('yarumo-lang', lang)
        document.documentElement.lang = lang
      } catch {}
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = language
    }
  }, [language])

  const t = useMemo(() => {
    return (key: TranslationKey): string => {
      return translations[language][key] || translations.es[key] || key
    }
  }, [language])

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
