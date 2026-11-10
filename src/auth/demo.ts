// Demo mode is a sandboxed preview: fake in-browser data, no Supabase calls, no real accounts.
// It is safe to expose publicly, so visitors can opt in at runtime with "Try demo" on the
// login page (remembered for the browser tab via sessionStorage).

// Build-time switch sets the default mode; visitors can switch modes in the current tab.
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

const DEMO_SESSION_KEY = 'junobi-demo-session'

export function readDemoSession(): boolean | null {
  try {
    const value = window.sessionStorage.getItem(DEMO_SESSION_KEY)
    if (value === '1') return true
    if (value === '0') return false
    return null
  } catch {
    return null
  }
}

export function writeDemoSession(on: boolean): void {
  try {
    window.sessionStorage.setItem(DEMO_SESSION_KEY, on ? '1' : '0')
  } catch {
    // Storage can be blocked (private mode); demo still works until the page reloads.
  }
}