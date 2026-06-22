# AGENTS.md

## Quick commands

- `npm run dev` — start dev server (Next.js + Turbopack, port 3000)
- `npm run build` — production build (**ignores TypeScript errors**, see below)
- `npm run lint` — ESLint (**no config in repo; may fail**)
- `npx tsc --noEmit` — type-check (build skips this; do it yourself)
- `npx shadcn add <component>` — add a shadcn/ui component at `@/components/ui`

## Architecture

- **Next.js App Router** (v16), React 19, TypeScript 5.7, Tailwind CSS v4, npm
- `game/` — pure, framework-agnostic engine. No React, no DOM. Returns new state objects. Designed for future porting to WebSocket multiplayer.
- `components/` — React UI. `OnlineGame.tsx` = networked multiplayer; `Lobby.tsx` = room creation/joining; `WaitingScreen.tsx`, `ConnectionStatus.tsx`, `GameOverBanner.tsx` = sub-components extracted from OnlineGame.
- `app/` — Next.js pages/routes. `page.tsx` renders `<Lobby />` directly (online-only).
- `lib/` — utilities: `cn()`, `supabase.ts` (Supabase JS client singleton), `supabaseActions.ts` (room CRUD operations).
- `hooks/` — `useSupabaseRealtime.ts` manages Broadcast channel + Presence for a room; `useCellSize.ts` = responsive cell sizing.
- Barrel exports: `game/index.ts`, `hooks/index.ts`, `lib/index.ts` re-export public APIs for cleaner imports.

### Path alias

`@/*` maps to repo root `./*` (not `src/`). Imports like `@/game/types`, `@/lib/utils`, `@/components/Lobby`.

## Gotchas

- **`next.config.mjs` has `typescript.ignoreBuildErrors: true`** — the build passes even with TS errors. Always run `npx tsc --noEmit` after changes.
- **No ESLint config exists and `eslint` is not in devDependencies** — `npm run lint` probably fails. Use `tsc` for validation.
- **SSR hazard**: `createInitialState()` calls `Math.random()`. The game state must only be created in `useEffect` (client-side) to avoid hydration mismatches.
- **Tailwind v4**: no `tailwind.config.js`. Config lives in `app/globals.css` via `@theme inline {…}` and `:root`/`.dark` CSS variables. Custom colors (e.g., `bg-game-p1`, `bg-game-bomb`) are defined there.
- **shadcn/ui uses `@base-ui/react`**, not Radix UI. The button import path is `@base-ui/react/button`. Do not import from `@radix-ui/*`.
- **npm only** — the lockfile is `package-lock.json`.
- **npm `overrides.hono`** pins `hono@4.12.25` for a transitive dep. Do not remove this override.

## Game engine notes

- `game/gameEngine.ts` functions are pure: they take state + inputs, return new state.
- `movePlayer` only commits to a new grid cell when the player is aligned (`isAligned`). Held keys are converted to movement intents each frame in `OnlineGame.tsx`.
- `tickMovement` advances smooth render positions; `updateGame` advances bombs/explosions/deaths.
- Timing: `BOMB_FUSE_MS = 3000`, `EXPLOSION_MS = 550`. The render loop uses `Date.now()` for bomb/explosion logic and `performance.now()` for delta time (clamped to 50ms to prevent teleport on tab-switch).

## Multiplayer (Supabase Realtime)

- `Lobby.tsx` manages room lifecycle: create → show code → wait → start; or join via 4-letter code.
- Host-authority model: the room creator runs `gameEngine.ts` locally. The guest sends inputs over Broadcast; the host applies them and broadcasts the full `GameState` every frame.
- `hooks/useSupabaseRealtime.ts` wraps `supabase.channel()`, Presence tracking, and Broadcast send/receive into a React hook.
- `bomberman_rooms` table persists room codes (4-char alphanumeric) and status (`waiting` / `playing` / `finished`). RLS is open — anyone can read/write.
- Guest controls: arrow keys + Enter. Host controls: WASD + Space (unchanged from local mode).
- Broadcast event name is always `"game"`. Messages follow `BroadcastMessage` union type in `game/networkTypes.ts`.

## Project origin

Bootstrapped via [v0.app](https://v0.app). Merges to `main` auto-deploy to Vercel. v0 internal files (`__v0_*`, `.snowflake/`, `.v0-trash/`) are gitignored.
