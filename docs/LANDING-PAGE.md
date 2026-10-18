# Welcome to Kriti

The root `/` and `/welcome` now serve a small React landing page. The existing merchant application remains at `/index.html`. The two entry buttons lead there. Authentication confirmation/recovery fragments and authorization codes received at `/` are forwarded unchanged to the existing app; the landing page does not inspect, log or store credentials.

Sources: `landing/main.tsx`, `components/ui/rangoli-preloader.tsx`, `styles/landing.css` and `styles/rangoli.css`. The reusable component lives in `components/ui` to keep the supplied component separate from page composition and follow the requested shadcn-style folder convention. The `@/*` TypeScript alias resolves from the repository root. This is not a migration of the existing plain-JavaScript application to shadcn/React.

The supplied React-only component needs no context providers, icon library or external images. The page uses the actual supplied Kriti logo. React, React DOM, TypeScript, esbuild and Tailwind are installed. Run:

```sh
npm ci
npm run typecheck:landing
npm run build:landing
npm start
```

Tailwind styles start in `styles/landing.css`; component styles are externalized to `styles/rangoli.css` so the current CSP does not need unsafe-inline styles. Build outputs are committed under `public/landing` so the existing production Docker image can continue to install runtime dependencies only. Rebuild and commit outputs after changing landing source.

The intro draws for approximately 4.2 seconds before revealing “Welcome to Kriti.” The message stays indefinitely until a click, tap, Enter or Space while it is visible. Earlier clicks do not skip it, and Escape does not dismiss it. Reduced-motion and unavailable-canvas modes show the static welcome immediately, still requiring activation. The underlying page remains inert until dismissal. The sequence is decorative, not network or AI progress. Authentication callback redirects remain unchanged. A static welcome/link remains if JavaScript cannot load.

No shadcn CLI setup is necessary for this component: it uses only React, canvas and scoped CSS. If adding actual shadcn components later, initialize their configuration deliberately against the existing `components/ui` directory and `styles/landing.css`; do not replace the application's existing styles or routes with a scaffold.

Checks: TypeScript, production bundle, deterministic pattern helper and HTTP entry/asset routes, and existing unit suite. Browser workflow test entry URLs were updated to `/index.html`. Rendered desktop/mobile and browser interaction checks were not run because browser automation was previously blocked by approval review in this session; those remain unverified.
