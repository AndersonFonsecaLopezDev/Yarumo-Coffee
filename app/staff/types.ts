export type Request = {
  id: string
  table_id: string
  type: 'waiter' | 'bill'
  status: string
  created_at: string
  table: { label: string } | null
}

export type OrderRequestItem = {
  id: string
  name_snapshot: string
  price_cop_snapshot: number
  quantity: number
  item_notes: string
}

export type OrderRequest = {
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

export type MenuCategory = {
  id: string
  name: string
  name_en?: string | null
  slug?: string
  icon: string
  sort_order: number
  active: boolean
  created_at?: string
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
  starts_at: string
  ends_at: string | null
  active: boolean
  sort_order: number
}

export type CafeTable = {
  id: string
  label: string
  public_token: string
  active: boolean
}

export type RecommendationItem = {
  id: string
  name: string
  rating: number
  comment: string
  table_number: string | null
  status: 'published' | 'pending' | 'hidden'
  created_at: string
}

export type MenuItem = {
  id: string
  name: string
  name_en?: string | null
  slug: string
  description: string
  description_en?: string | null
  price_cop: number
  category: string
  category_id?: string | null
  available: boolean
  sort_order: number
  image_url: string | null
  gallery_urls: string[]
  tags?: string[]
}

export type MenuForm = {
  name: string
  name_en?: string
  slug: string
  description: string
  description_en?: string
  price_cop: number
  category: string
  category_id?: string
  available: boolean
  sort_order: number
  image_url: string
  gallery_urls: string
  tags?: string
}

export type CategoryForm = {
  name: string
  name_en?: string
  slug: string
  icon: string
  sort_order: number
  active: boolean
}

export type PromotionForm = {
  title: string
  title_en?: string
  description: string
  description_en?: string
  badge_text: string
  image_url: string
  linked_menu_item_id: string
  starts_at: string
  ends_at: string
  active: boolean
  sort_order: number
}
