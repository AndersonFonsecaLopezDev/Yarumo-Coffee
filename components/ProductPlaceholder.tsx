import { memo } from 'react'

export const ProductPlaceholder = memo(function ProductPlaceholder({
  category,
}: {
  category?: string
}) {
  return (
    <div className="product-brand-placeholder" aria-hidden="true">
      <div className="placeholder-pattern-bg">
        <svg
          viewBox="0 0 200 200"
          className="placeholder-illustration"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Anillos concéntricos sutiles evocando extracción de espresso */}
          <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(217, 232, 106, 0.08)" strokeWidth="1.5" strokeDasharray="4 6" />
          <circle cx="100" cy="100" r="65" fill="none" stroke="rgba(217, 232, 106, 0.12)" strokeWidth="2" />
          <circle cx="100" cy="100" r="45" fill="rgba(24, 54, 47, 0.5)" />

          {/* Silueta estilizada de hoja de Yarumo y taza de origen */}
          <g transform="translate(100 100) scale(1.1) translate(-24 -24)">
            {/* Taza */}
            <path
              d="M10 16h22v11a7 7 0 0 1-7 7H17a7 7 0 0 1-7-7V16z"
              fill="rgba(217, 232, 106, 0.25)"
              stroke="#d9e86a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Asa */}
            <path
              d="M32 19h3a3 3 0 0 1 0 6h-3"
              fill="none"
              stroke="#d9e86a"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Plato base */}
            <path
              d="M7 36h28"
              stroke="rgba(217, 232, 106, 0.6)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Vapor aromático */}
            <path
              d="M16 10c0-3 3-3 3-6"
              fill="none"
              stroke="#ef805b"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M22 11c0-3 3-3 3-6"
              fill="none"
              stroke="#d9e86a"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </g>

          {/* Puntos y granos decorativos */}
          <circle cx="45" cy="60" r="2.5" fill="#d9e86a" opacity="0.4" />
          <circle cx="155" cy="140" r="2" fill="#ef805b" opacity="0.5" />
          <circle cx="160" cy="65" r="3" fill="#d9e86a" opacity="0.3" />
          <circle cx="40" cy="145" r="2.5" fill="#d9e86a" opacity="0.35" />
        </svg>
      </div>

      <div className="placeholder-brand-label">
        <span className="placeholder-brand-tag">Café de Especialidad</span>
        <span className="placeholder-brand-title">YARUMO COFFEE</span>
        {category && <span className="placeholder-cat-hint">{category}</span>}
      </div>
    </div>
  )
})
