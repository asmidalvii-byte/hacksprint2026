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

The component is copied from the supplied attachment with integration fixes: a shorter intro, reduced-motion skip, canvas-unavailable fallback, external CSS, and animation-frame termination after opening. It is not the infinite-loop sample. The welcome sequence is decorative, not a claim of AI or network progress. A persistent Skip welcome button and Escape dismiss it; the rest of the page is inert while it runs, and focus moves to the welcome heading. A static usable welcome/link remains if JavaScript cannot load.

No shadcn CLI setup is necessary for this component: it uses only React, canvas and scoped CSS. If adding actual shadcn components later, initialize their configuration deliberately against the existing `components/ui` directory and `styles/landing.css`; do not replace the application's existing styles or routes with a scaffold.

Checks: TypeScript, production bundle, deterministic pattern helper and HTTP entry/asset routes, and existing unit suite. Browser workflow test entry URLs were updated to `/index.html`. Rendered desktop/mobile and browser interaction checks were not run because browser automation was previously blocked by approval review in this session; those remain unverified.
