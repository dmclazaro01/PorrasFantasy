# Diseño — Versión de ordenador para PorrasFantasy

**Fecha:** 2026-09-01
**Enfoque elegido:** 2 — Adaptativo con sidebar (mixto C + sidebar A + AA+IPO B)
**Stack existente:** Vite+React+TS+Tailwind v4, Hallmark `Stadium Night` (Space Grotesk/Inter, `--color-bg:#090c1c`, `--color-primary:#c2ff3d`), Supabase

---

## 1. Arquitectura & Shell responsive

**Principio IPO:** consistencia + bypass block (Nielsen #1, WCAG 2.4.1). Móvil intacto, desktop añade una columna sin tocar lógica.

- `.app-shell` (`src/index.css:109`): base `max-width:440px` centrado + `grad-pitch` + `app-bottombar` fijo (`src/index.css:131`). En `lg` (`1024px`) cambia a `max-width:1280px; display:grid; grid-template-columns:260px 1fr` — el fondo se extiende al viewport, los bordes `440px` solo en `<1024px`.
- Nuevo `src/components/DesktopSidebar.tsx`: `hidden lg:flex`, `sticky top-0 h-dvh`, `nav aria-label="Principal"`. Contenido: logo `LP` (`src/screens/Auth.tsx:65`), links `Porras / Perfil` (`NavLink aria-current`), secundarios `Crear porra / Unirse` (`variant=ghost`). No sustituye `TabBar` (`src/App.tsx:71`) — este queda `lg:hidden`.
- `App.tsx:60 TabLayout`: en `lg` envuelve `<Outlet/>` en `<main id="main-content">` + `skip-link` (`<a href="#main-content">Saltar al contenido</a>`) para WCAG 2.4.1.
- `app-bottombar` + `PoolNav`/`JornadaBar` (`src/screens/Pool.tsx:157`) se ocultan en `lg` vía `lg:hidden`; su función migra a sidebar/tabs desktop.
- Hallmark intacto: no se improvisan tokens (`var(--color-*)`), se añade sello `/* Hallmark · desktop shell · nav: N3 side-rail */`.

---

## 2. Componentes & layout por pantalla

**Home (`src/screens/Home.tsx:42`):**
- Header mantiene `Avatar` + `La Porra`. Acciones `grid-cols-2` → `lg:grid-cols-2` idéntico. Lista salas `space-y-3` → `lg:grid lg:grid-cols-2 xl:grid-cols-3 gap-4`. `EmptyState ticket` centrado `max-w-lg`. Hover `border-primary/40` + `focus-within:ring`.

**Pool (`src/screens/Pool.tsx:36`):**
- **Predicciones** (`PrediccionesSection:262`): autosave + `ScoreBox` (`502`) intactos. En `xl` el contenedor de `MatchRow` pasa a `xl:grid xl:grid-cols-2 gap-3`. `MatchRow` (`553`) conserva `TeamCol 44px` + `min-h-12` (WCAG 2.5.8), añade `lg:rounded-2xl border`.
- **JornadaBar (`167`)**: móvil `flex justify-between Ant/Sig`. Desktop: `role=tablist` segmentado, navegación con flechas, `aria-selected`, `partLabel` visible.
- **Ranking/Bote (`RankingSection:740`, `BoteList:809`)**: móvil tabs apilados. En `lg` el pool usa `lg:grid-cols-[1fr_360px]` con `aside` derecho `sticky` para ranking general siempre visible. Tabs cambian contenido del aside vía props (no ruta). En `lg` las listas pasan de `ul > li` a `table` semántica (`<table><caption class="sr-only">`), `ul` queda oculto con `lg:hidden` inverso para lectores.
- **Cartas (`Cards.tsx:284`)**: `grid-cols-2` → `lg:grid-cols-3`. `Sheet` (`84`) en desktop: `dialog` centrado `max-w-[560px] rounded-2xl`, foco atrapado, `Esc` cierra, backdrop `bg-black/40`, no `85dvh`.

**Perfil/Auth/CreatePool (`src/App.tsx:147`, `Auth.tsx:57`, `CreatePool:49`):**
- `Auth`/`CreatePool`: `lg:grid lg:grid-cols-2 max-w-5xl mx-auto` (izq `grad-hero`, der `form` `card`).
- `Perfil`: `lg:grid-cols-[280px_1fr]` (col izq avatar + `InstallButton` + `Cerrar sesión`, der forms nombre/contraseña).

---

## 3. Accesibilidad (WCAG 2.2 AA) + Heurísticas IPO

**WCAG AA:**
- **1.4.3 Contraste**: `ink-faint #646c99` → `#7a82b5` en `12px` sobre `surface #151a38` (4.5:1). `primary #c2ff3d / on-primary #0a0d1e` ~15:1 ya OK.
- **1.4.10 Reflow / 1.4.12 Spacing**: `html {overflow-x:clip}` (`src/index.css:62`) ya; `MatchRow` usa `minmax(0,1fr)`; `zoom 200%` sin pérdida.
- **2.1.1 Teclado**: todo `onClick` en `div` → `button`; `JornadaBar` flechas; `Sheet` trampa foco (`inert` resto) + `Esc`.
- **2.4.1 Bypass / 2.4.3 Orden / 2.4.7 Focus**: `skip-link` + landmarks `<header><nav><main><aside>` + orden sidebar→main→aside + `focus-visible` (`src/index.css:246`, `outline:2px primary`).
- **2.5.8 Target**: `Button` `min-h-12` (`src/ui.tsx:31`) preservado en desktop.
- **4.1.2 Name/Role/Value**: `aria-current="page"` sidebar, `aria-selected` tabs, `aria-label` iconos.

**Nielsen/Norman/Gestalt:**
- Visibilidad estado (`Guardando…/✓` `src/screens/Pool.tsx:423` sticky), prevención errores (Field hint + autosave debounce + `inputsRef` no pisado por polling 30s), consistencia léxica (`Porras/Ranking/Cartas/Bote`), Fitts (sidebar cerca vs bottom lejano), Hick (3 secciones), proximidad/semejanza/cierre (tickets agrupados, medallas `MEDAL:738`, sidebar delimitado).

---

## 4. Flujo de datos, errores, testing y Hallmark

**Flujo/estado:** sin cambios. `useSession` (`src/App.tsx:24`), `getPool/listRounds/buildSegments` (`Pool:49`), `getMatches/getMyPredictions` + polling 30s (`329`) con `inputsRef` para no pisar escritura. Sidebar deriva solo de `react-router`.

**Errores/vacíos:** reutiliza `EmptyState` (`src/ui.tsx:110`) + `Spinner` (`41`) en todos los breakpoints; `status=error` (`423`) no bloquea inputs.

**Testing/verificación:**
- Breakpoints `320/375/414/768/1024/1280` sin scroll-x; `prefers-reduced-motion` respeta `rise/pop` (`src/index.css:209`); `zoom 200%`.
- Teclado: `Tab` sidebar→main→aside→Sheet, `Esc` cierra, `Enter` en `ScoreBox`.
- `npm run typecheck && npm run build` OK; Lighthouse A11y ≥95.
- No se tocan `supabase/migrations/*` ni `lib/api`.

**Hallmark/frontend-design:** se preserva `/* Hallmark · macrostructure: Boleto-on-dark */` (`src/index.css:1`), no hex inline; se añade `desktop shell · nav: N3 side-rail`. Spacing 4pt de `frontend-design`.

---

## 5. Ficheros a tocar / no tocar

**Tocar:** `src/index.css`, `src/App.tsx`, `src/components/DesktopSidebar.tsx` (nuevo), `src/screens/Home.tsx`, `src/screens/Pool.tsx`, `src/screens/Auth.tsx`, `src/screens/CreatePool.tsx`, `src/components/Cards.tsx`, `src/ui.tsx` (ajuste contraste/focus).
**No tocar:** `supabase/*`, `lib/api.ts` lógica, `manifest`/PWA, lógica de puntuación.

## 6. Riesgos y mitigación

- **Sidebar rompe focus order en móvil** → `hidden lg:flex` + `lg:hidden` en bottomBar garantiza exclusión mutua; test `Tab` en ambos anchos.
- **Sheet focus-trap** → usar `inert` + restaurar foco al cerrar; test con lector (NVDA/VoiceOver).
- **Tabla semántica duplicada** → `ul` móvil + `table` desktop comparten datos, una oculta por breakpoint (`sr-only` vs `hidden`), sin duplicar fetch.
