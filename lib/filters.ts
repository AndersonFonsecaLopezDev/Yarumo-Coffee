'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Normaliza cadenas de texto para búsquedas insensibles a mayúsculas, minúsculas,
 * tildes y caracteres diacríticos (ej: "café" == "cafe").
 */
export function normalizeText(text?: string | null): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Hook reutilizable para gestionar filtros sincronizados bidireccionalmente con los
 * parámetros de búsqueda (query params) de la URL sin recargar la página.
 */
export function useUrlFilters<T extends Record<string, string>>(
  prefix: string,
  defaults: T,
) {
  // Leer valores iniciales de la URL en el cliente
  const [filters, setFiltersState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaults
    const params = new URLSearchParams(window.location.search)
    const initial = { ...defaults }
    for (const key of Object.keys(defaults) as Array<keyof T>) {
      const paramKey = prefix ? `${prefix}_${String(key)}` : String(key)
      const val = params.get(paramKey)
      if (val !== null && val !== undefined) {
        initial[key] = val as T[keyof T]
      }
    }
    return initial
  })

  // Sincronizar cambios en la URL con replaceState
  const syncToUrl = useCallback(
    (newFilters: T) => {
      if (typeof window === 'undefined') return
      const url = new URL(window.location.href)
      for (const [k, v] of Object.entries(newFilters)) {
        const paramKey = prefix ? `${prefix}_${k}` : k
        if (v && v !== defaults[k]) {
          url.searchParams.set(paramKey, v)
        } else {
          url.searchParams.delete(paramKey)
        }
      }
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    },
    [defaults, prefix],
  )

  const setFilter = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setFiltersState((prev) => {
        const next = { ...prev, [key]: value }
        syncToUrl(next)
        return next
      })
    },
    [syncToUrl],
  )

  const setMultipleFilters = useCallback(
    (partial: Partial<T>) => {
      setFiltersState((prev) => {
        const next = { ...prev, ...partial }
        syncToUrl(next)
        return next
      })
    },
    [syncToUrl],
  )

  const resetFilters = useCallback(() => {
    setFiltersState(defaults)
    syncToUrl(defaults)
  }, [defaults, syncToUrl])

  // Contar cuántos filtros activos difieren de sus valores por defecto
  const activeCount = useMemo(() => {
    let count = 0
    for (const key of Object.keys(defaults) as Array<keyof T>) {
      if (filters[key] !== defaults[key] && Boolean(filters[key])) {
        count++
      }
    }
    return count
  }, [defaults, filters])

  const hasActiveFilters = activeCount > 0

  return {
    filters,
    setFilter,
    setMultipleFilters,
    resetFilters,
    hasActiveFilters,
    activeCount,
  }
}

/**
 * Hook para añadir debounce a valores que cambian frecuentemente (ej: inputs de búsqueda).
 */
export function useDebouncedValue<T>(value: T, delayMs: number = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delayMs])

  return debouncedValue
}
