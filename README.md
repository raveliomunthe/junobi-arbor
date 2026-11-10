# React + TypeScript + Vite

## Demo and real account modes

Use **Try demo** on the login screen, or the switch in the Profile menu, to
open the local-data demo. Use **Switch to real account** in Profile to return
to Supabase authentication. Switching does not sign out an existing real
account. Demo data remains in the browser and is not synced to Supabase.

The selected mode is remembered in the current browser tab when session storage
is available. `VITE_DEMO_MODE=true` sets demo as the default for a fresh tab
and displays the demo login; otherwise the real login is the default. Vite
reads this variable at build time, so changing it on Vercel requires a new
deployment. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` on
Vercel for real authentication. Demo credentials and data are public preview
material, not a security boundary.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
