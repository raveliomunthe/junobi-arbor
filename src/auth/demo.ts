// Demo mode only exists in `vite` dev server builds. import.meta.env.DEV is statically
// false in production builds, so this can never bypass authentication there.
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'
