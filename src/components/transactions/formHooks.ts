import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

// Whole-number money and quantity inputs: stop exponent, sign and decimal characters.
export function blockNonIntegerKeys(event: KeyboardEvent<HTMLInputElement>): void {
  if (['e', 'E', '+', '-', '.', ','].includes(event.key)) event.preventDefault()
}

// Prevents accidental double submissions: the lock stays on briefly after every save attempt.
export function useSaveGuard(releaseDelayMs = 500) {
  const locked = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [saving, setSaving] = useState(false)

  useEffect(() => () => clearTimeout(timer.current), [])

  const begin = (): boolean => {
    if (locked.current) return false
    locked.current = true
    setSaving(true)
    return true
  }

  const release = (): void => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      locked.current = false
      setSaving(false)
    }, releaseDelayMs)
  }

  return { saving, begin, release }
}

export function useFlash(durationMs = 4500) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const show = (text: string): void => {
    clearTimeout(timer.current)
    setMessage(text)
    timer.current = setTimeout(() => setMessage(null), durationMs)
  }

  const clear = (): void => {
    clearTimeout(timer.current)
    setMessage(null)
  }

  return { message, show, clear }
}
