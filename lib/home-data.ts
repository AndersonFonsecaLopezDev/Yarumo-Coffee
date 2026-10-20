import { createPublicClient } from '@/lib/supabase/public'
import { SITE_URL } from '@/lib/site-url'
import { SITE_CONFIG } from '@/lib/site-config'
import type { MenuItem, MenuCategory, MenuItemOptionGroup, MenuItemOptionChoice } from '@/lib/types'
import type { Promotion } from '@/components/PromotionsSection'

export const cafeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CafeOrCoffeeShop',
  name: SITE_CONFIG.name,
  image: `${SITE_URL}/yarumo-cover-cafe-og.webp`,
  url: SITE_URL,
  telephone: SITE_CONFIG.phone.e164,
  priceRange: SITE_CONFIG.priceRange,
  servesCuisine: [...SITE_CONFIG.cuisine],
  menu: `${SITE_URL}/#menu`,
  geo: {
    '@type': 'GeoCoordinates',
    latitude: SITE_CONFIG.coordinates.latitude,
    longitude: SITE_CONFIG.coordinates.longitude,
  },
  address: {
    '@type': 'PostalAddress',
    streetAddress: SITE_CONFIG.address.street,
    addressLocality: SITE_CONFIG.address.city,
    addressRegion: SITE_CONFIG.address.region,
    addressCountry: SITE_CONFIG.address.country,
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: SITE_CONFIG.schedule.weekdays.days,
      opens: SITE_CONFIG.schedule.weekdays.opens,
      closes: SITE_CONFIG.schedule.weekdays.closes,
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: SITE_CONFIG.schedule.sunday.days,
      opens: SITE_CONFIG.schedule.sunday.opens,
      closes: SITE_CONFIG.schedule.sunday.closes,
    },
  ],
  sameAs: [
    SITE_CONFIG.social.instagram,
    SITE_CONFIG.social.googleMaps,
  ],
}

export function getCafeJsonLd(siteName?: string) {
  return {
    ...cafeJsonLd,
    name: siteName || SITE_CONFIG.name,
  }
}

export type SiteIcons = {
  '512': string
  '192': string
  '180': string
  '32': string
}

export const DEFAULT_SITE_ICONS: SiteIcons = {
  '512': '/icon-512.png',
  '192': '/icon-192.png',
  '180': '/apple-touch-icon.png',
  '32': '/icon-32.png',
}

export function parseSiteIcon(raw?: string | null): SiteIcons {
  if (!raw) return DEFAULT_SITE_ICONS
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return {
        '512': parsed['512'] || DEFAULT_SITE_ICONS['512'],
        '192': parsed['192'] || DEFAULT_SITE_ICONS['192'],
        '180': parsed['180'] || DEFAULT_SITE_ICONS['180'],
        '32': parsed['32'] || DEFAULT_SITE_ICONS['32'],
      }
    }
  } catch {}
  return DEFAULT_SITE_ICONS
}

export async function getSiteBranding() {
  const supabase = createPublicClient()
  const { data } = await supabase.from('site_settings').select('key, value')
  const map = (data || []).reduce(
    (acc, row) => ({ ...acc, [row.key]: row.value }),
    {} as Record<string, string>,
  )

  const siteName = (map['site_name'] || SITE_CONFIG.name || 'Yarumo Coffee').trim()
  const siteIcon = parseSiteIcon(map['site_icon'])
  const estimatedWaitTime = map['estimated_wait_time'] || '15–20 min'
  const heroImageUrl = map['hero_image_url'] || '/yarumo-cover-cafe.webp'
  const whatsappDeliveryNumber = map['whatsapp_delivery_number'] || '573192208938'

  return { siteName, siteIcon, estimatedWaitTime, heroImageUrl, whatsappDeliveryNumber }
}

export type HomeInitialData = {
  menu: MenuItem[]
  categories: MenuCategory[]
  promotions: Promotion[]
  heroImageUrl: string
  whatsappDeliveryNumber: string
  siteName: string
  siteIcon: SiteIcons
  estimatedWaitTime: string
}

export async function getInitialData(): Promise<HomeInitialData> {
  const supabase = createPublicClient()

  const [menuRes, catRes, promoRes, settingsRes, optionsRes] = await Promise.all([
    supabase
      .from('menu_items')
      .select('id,name,name_en,slug,description,description_en,price_cop,category,category_id,sort_order,image_url,gallery_urls,tags')
      .eq('available', true)
      .order('sort_order')
      .order('name'),
    supabase
      .from('menu_categories')
      .select('id,name,name_en,slug,icon,sort_order')
      .eq('active', true)
      .order('sort_order'),
    supabase
      .from('promotions')
      .select('id,title,title_en,description,description_en,badge_text,image_url,linked_menu_item_id,sort_order,starts_at,ends_at')
      .eq('active', true)
      .order('sort_order'),
    supabase
      .from('site_settings')
      .select('key,value'),
    supabase
      .from('menu_item_option_groups')
      .select('id,menu_item_id,name,kind,required,sort_order,active,choices:menu_item_option_choices(id,group_id,label,price_delta_cop,sort_order,active)')
      .eq('active', true)
      .order('sort_order'),
  ])

  const settingsMap = (settingsRes.data || []).reduce(
    (acc, row) => ({ ...acc, [row.key]: row.value }),
    {} as Record<string, string>,
  )

  const heroImageUrl = settingsMap['hero_image_url'] || '/yarumo-cover-cafe.webp'
  const whatsappDeliveryNumber = settingsMap['whatsapp_delivery_number'] || '573192208938'
  const siteName = (settingsMap['site_name'] || SITE_CONFIG.name || 'Yarumo Coffee').trim()
  const siteIcon = parseSiteIcon(settingsMap['site_icon'])
  const estimatedWaitTime = settingsMap['estimated_wait_time'] || '15–20 min'

  const optionsMap = new Map<string, MenuItemOptionGroup[]>()
  if (Array.isArray(optionsRes?.data)) {
    const rawGroups = optionsRes.data as unknown as (MenuItemOptionGroup & { choices?: MenuItemOptionChoice[] })[]
    for (const group of rawGroups) {
      const activeChoices = Array.isArray(group.choices)
        ? [...group.choices].filter((c) => c.active).sort((a, b) => a.sort_order - b.sort_order)
        : []
      const grpWithChoices: MenuItemOptionGroup = { ...group, choices: activeChoices }
      const existing = optionsMap.get(group.menu_item_id) || []
      existing.push(grpWithChoices)
      optionsMap.set(group.menu_item_id, existing)
    }
  }

  const menuWithdrawn = ((menuRes.data || []) as MenuItem[]).map((item) => ({
    ...item,
    option_groups: optionsMap.get(item.id) || [],
  }))

  return {
    menu: menuWithdrawn,
    categories: (catRes.data || []) as MenuCategory[],
    promotions: (promoRes.data || []) as Promotion[],
    heroImageUrl,
    whatsappDeliveryNumber,
    siteName,
    siteIcon,
    estimatedWaitTime,
  }
}

export async function getProductById(id: string): Promise<MenuItem | null> {
  const supabase = createPublicClient()
  const { data: item, error } = await supabase
    .from('menu_items')
    .select('id,name,name_en,slug,description,description_en,price_cop,category,category_id,sort_order,image_url,gallery_urls,tags,available')
    .eq('id', id)
    .single()

  if (error || !item || !item.available) {
    return null
  }

  return item as MenuItem
}
