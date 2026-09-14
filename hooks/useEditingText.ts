'use client'

import { useEffect, useState } from 'react'
import { isEditingText } from '@/lib/ui/isEditingText'

/** Whether a text field currently has focus, for disabling canvas delete keys. */
export function useEditingText(): boolean {
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const sync = () => setEditing(isEditingText())
    sync()
    document.addEventListener('focusin', sync)
    document.addEventListener('focusout', sync)
    return () => {
      document.removeEventListener('focusin', sync)
      document.removeEventListener('focusout', sync)
    }
  }, [])

  return editing
}
