'use client'

import { useEffect } from 'react'

let lockCount = 0
let originalOverflow: string | null = null

export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked || typeof window === 'undefined') return

    if (lockCount === 0) {
      originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    lockCount++

    return () => {
      lockCount--
      if (lockCount <= 0) {
        lockCount = 0
        document.body.style.overflow = originalOverflow ?? ''
        originalOverflow = null
      }
    }
  }, [locked])
}
