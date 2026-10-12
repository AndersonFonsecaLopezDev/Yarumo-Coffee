export type MenuItemOptionChoice = {
  id: string
  group_id: string
  label: string
  price_delta_cop: number
  sort_order: number
  active: boolean
}

export type MenuItemOptionGroup = {
  id: string
  menu_item_id: string
  name: string
  kind: 'single' | 'multi'
  required: boolean
  sort_order: number
  active: boolean
  choices?: MenuItemOptionChoice[]
}

export type MenuItem = {
  id: string
  name: string
  name_en?: string | null
  description: string | null
  description_en?: string | null
  price_cop: number
  category: string
  category_id?: string | null
  sort_order: number
  image_url?: string | null
  gallery_urls?: string[]
  tags?: string[]
  option_groups?: MenuItemOptionGroup[]
}

export type MenuCategory = {
  id: string
  name: string
  name_en?: string | null
  slug: string
  icon: string
  sort_order: number
}

export type Promotion = {
  id: string
  title: string
  title_en?: string | null
  description: string
  description_en?: string | null
  badge_text: string | null
  image_url: string | null
  linked_menu_item_id: string | null
  starts_at?: string
  ends_at?: string | null
  sort_order: number
}

export type CartItem = {
  id?: string
  item: MenuItem
  quantity: number
  notes: string
  selectedChoiceIds?: string[]
  selectedChoices?: MenuItemOptionChoice[]
  effectivePrice?: number
}

export type TableOrderItem = {
  id: string
  name_snapshot: string
  price_cop_snapshot: number
  quantity: number
  item_notes: string
}

export type TableOrder = {
  id: string
  status: 'pending' | 'acknowledged' | 'preparing' | 'delivered' | 'cancelled'
  notes: string
  source: string
  created_at: string
  acknowledged_at: string | null
  delivered_at: string | null
  items: TableOrderItem[]
}
