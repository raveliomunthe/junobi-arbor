<<<<<<< HEAD
// Demo mode is a sandboxed preview: fake in-browser data, no Supabase calls, no real accounts.
// It is safe to expose publicly, so visitors can opt in at runtime with "Try demo" on the
// login page (remembered for the browser tab via sessionStorage).

// Build-time switch (VITE_DEMO_MODE=true): the whole app becomes demo-only, with a demo login.
// Handy for local development; not needed on Vercel any more.
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

const DEMO_SESSION_KEY = 'junobi-demo-session'

export function readDemoSession(): boolean {
  try {
    return window.sessionStorage.getItem(DEMO_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function writeDemoSession(on: boolean): void {
  try {
    if (on) window.sessionStorage.setItem(DEMO_SESSION_KEY, '1')
    else window.sessionStorage.removeItem(DEMO_SESSION_KEY)
  } catch {
    // Storage can be blocked (private mode); demo still works until the page reloads.
  }
}
=======
// Demo mode only exists in `vite` dev server builds. import.meta.env.DEV is statically
// false in production builds, so this can never bypass authentication there.
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'
>>>>>>> 9c5fb0654ec9282aeab168918e547aeca97eca36
