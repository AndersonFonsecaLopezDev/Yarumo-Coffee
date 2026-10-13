import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number
}

// Icono 1: Taza de café humeante (Bebidas Calientes / Especialidad)
export function HotCoffeeIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  )
}

// Icono 2: Vaso frío con cubos de hielo y pitillo (Bebidas Frías)
export function ColdDrinkIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 8l1.5 13h11L19 8" />
      <path d="M4 8h16" />
      <path d="M12 2l2 6" />
      <path d="M8 13h3" />
      <path d="M13 16h3" />
    </svg>
  )
}

// Icono 3: Croissant hojaldrado artesanal (Pastelería / Panadería)
export function BakeryCroissantIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 15c1-3 4-8 9-8s8 5 9 8" />
      <path d="M6 14c1.5-2 3.5-3.5 6-3.5s4.5 1.5 6 3.5" />
      <path d="M8 18c1-1 2.5-1.8 4-1.8s3 0.8 4 1.8" />
      <path d="M3 15c-0.5 1.5 0.5 3 2 3h14c1.5 0 2.5-1.5 2-3" />
    </svg>
  )
}

// Icono 4: Métodos de Filtrado / Cafetera V60 / Chemex
export function PourOverIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 3h12l-3 7H9L6 3z" />
      <path d="M9 10l-4 10h14l-4-10" />
      <line x1="5" y1="21" x2="19" y2="21" />
    </svg>
  )
}

// Icono 5: Desayuno / Plato gourmet (Desayunos / Brunch)
export function BreakfastIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2" />
      <path d="M12 19v2" />
      <path d="M3 12h2" />
      <path d="M19 12h2" />
    </svg>
  )
}

// Icono 6: Postres / Tarta (Postres)
export function DessertCakeIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 14h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z" />
      <path d="M4 14l3-6h10l3 6" />
      <circle cx="12" cy="5" r="2" />
    </svg>
  )
}

// Icono 7: Infusión / Té de origen
export function TeaLeafIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M11 20A7 7 0 0 1 4 13C4 7 11 3 20 3c0 9-4 17-9 17z" />
      <path d="M4 13c5.5 0 11 2.5 13 7" />
    </svg>
  )
}

// Icono 8: Destellos / Todos
export function SparkleIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z" />
    </svg>
  )
}

// Icono 9: Corazón / Favoritos
export function HeartIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

/**
 * Selector inteligente de iconos SVG por nombre de categoría, slug o icono existente
 */
export function CategoryIcon({
  category,
  slug,
  icon,
  size = 18,
  className = '',
}: {
  category?: string
  slug?: string
  icon?: string
  size?: number
  className?: string
}) {
  // 1. Categoría virtual de Favoritos
  if (category === 'Favoritos' || slug === 'favorites') {
    return <HeartIcon size={size} className={className} />
  }

  // 2. Si la categoría tiene un emoji o icono personalizado guardado en BD, usarlo directamente
  const trimmedIcon = (icon || '').trim()
  if (trimmedIcon && trimmedIcon !== '✨') {
    return (
      <span
        className={`category-tab-emoji ${className}`}
        style={{ fontSize: `${size}px`, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        aria-hidden="true"
      >
        {trimmedIcon}
      </span>
    )
  }

  // 3. Categoría Todos (sin icono específico)
  if (category === 'Todos' || slug === 'all' || trimmedIcon === '✨') {
    return <SparkleIcon size={size} className={className} />
  }

  // 4. Fallback SVG si la categoría no tiene emoji asignado
  const norm = `${category || ''} ${slug || ''}`.toLowerCase()

  if (norm.includes('frí') || norm.includes('fria') || norm.includes('cold') || norm.includes('iced') || norm.includes('granizado')) {
    return <ColdDrinkIcon size={size} className={className} />
  }
  if (norm.includes('pastel') || norm.includes('panad') || norm.includes('croissant') || norm.includes('bakery')) {
    return <BakeryCroissantIcon size={size} className={className} />
  }
  if (norm.includes('filtr') || norm.includes('metodo') || norm.includes('chemex') || norm.includes('v60') || norm.includes('prensa')) {
    return <PourOverIcon size={size} className={className} />
  }
  if (norm.includes('desayun') || norm.includes('brunch') || norm.includes('huevo') || norm.includes('tostad') || norm.includes('sandw')) {
    return <BreakfastIcon size={size} className={className} />
  }
  if (norm.includes('postre') || norm.includes('torta') || norm.includes('tarta') || norm.includes('dulce') || norm.includes('cake')) {
    return <DessertCakeIcon size={size} className={className} />
  }
  if (norm.includes('té') || norm.includes('te') || norm.includes('infus') || norm.includes('aromática') || norm.includes('herbal')) {
    return <TeaLeafIcon size={size} className={className} />
  }

  return <HotCoffeeIcon size={size} className={className} />
}

export function SearchIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function WhatsAppIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

export function DeliveryScooterIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M6 18h12" />
      <path d="M6 15l3-7h6l2 4" />
      <path d="M12 8V4h3" />
      <rect x="3" y="8" width="5" height="5" rx="1" />
    </svg>
  )
}

export function CartIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  )
}

