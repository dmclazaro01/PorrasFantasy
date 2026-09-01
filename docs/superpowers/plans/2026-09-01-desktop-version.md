# Desktop Version — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir versión ordenador (≥1024px) adaptativa manteniendo móvil 100% intacto — sidebar 260px, grillas densas en ranking/bote, sheets como dialogs, WCAG 2.2 AA + heurísticas IPO, sin tocar lógica Supabase.

**Architecture:** Mobile-first intacto (`max-width:440px` + `app-bottombar`); en `lg` el `.app-shell` se convierte en `grid 260px 1fr max 1280px`. Nuevo `DesktopSidebar` (`hidden lg:flex`) con `NavLink aria-current`. Pool usa `lg:grid 1fr 360px` con aside sticky. Tokens Hallmark (`Stadium Night`) inmutables.

**Tech Stack:** Vite + React 19 + TS + Tailwind v4 (`@theme` tokens), react-router-dom 7, Supabase-js; verificación `npm run typecheck/build` + Lighthouse + keyboard/zoom 200%.

---

## File Structure

**Crear:**
- `src/components/DesktopSidebar.tsx` — nav desktop (logo LP, links Porras/Perfil/Crear/Unirse), `aria-current`, `hidden lg:flex`.

**Modificar:**
- `src/index.css:1,109,131,246` — sello Hallmark desktop, shell grid `lg`, `app-bottombar lg:hidden`, `skip-link`, contraste `ink-faint` fix, `focus-visible` + `overflow-x:clip`.
- `src/App.tsx:23,60,71,147` — `skip-link`, `TabLayout` con `DesktopSidebar` + `<main id="main-content">`, `TabBar lg:hidden`, `Profile` layout `lg:grid`.
- `src/screens/Home.tsx:42` — grilla salas `lg:grid-cols-2 xl:grid-cols-3`, wrapper `max-w-1120px`.
- `src/screens/Pool.tsx:126,167,262,553,740,809` — layout `lg:grid-cols-[1fr_360px]`, `JornadaBar` tablist, `Predicciones` `xl:grid-cols-2`, `Ranking/Bote` table semántica `lg`, `PoolNav lg:hidden`.
- `src/screens/Auth.tsx:57` — `lg:grid-cols-2 max-w-5xl`.
- `src/screens/CreatePool.tsx:48` — `lg:grid-cols-2`.
- `src/components/Cards.tsx:84,284` — `Sheet` desktop `dialog` centrado + `grid-cols-3 lg`, inert focus-trap.
- `src/ui.tsx:31,53` — `Button min-h-12` + `focus-visible`, contraste hints.

**No tocar:** `supabase/migrations/*`, `src/lib/api.ts`, `src/hooks/useSession.ts`, `public/manifest.webmanifest`, lógica triggers.

---

### Task 1: Shell + Sidebar + Accesibilidad base

**Files:**
- Modify: `src/index.css`
- Create: `src/components/DesktopSidebar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write visual regression check (no test framework — manual script)**

Create `/tmp/opencode/check-shell.sh`:
```bash
#!/bin/bash
# Verifica que shell actual sigue 440px en móvil y no hay sidebar
grep -q "max-width: 440px" src/index.css && echo "SHELL_MOBILE_OK" || echo "FAIL"
test ! -f src/components/DesktopSidebar.tsx && echo "NO_SIDEBAR_YET_OK" || echo "FAIL"
grep -q "app-bottombar" src/App.tsx && echo "BOTTOMBAR_EXISTS_OK" || echo "FAIL"
```
Run: `bash /tmp/opencode/check-shell.sh`
Expected: `SHELL_MOBILE_OK / NO_SIDEBAR_YET_OK / BOTTOMBAR_EXISTS_OK`

- [ ] **Step 2: Update `src/index.css` — tokens y shell responsive**

Edit `src/index.css:1` header to add desktop stamp:
```css
/* Hallmark · macrostructure: Boleto-on-dark · desktop: N3 side-rail 260px + grid 1fr 360px · genre: atmospheric/playful · theme: Stadium Night */
```
Replace `.app-shell` block `src/index.css:109-128`:
```css
.app-shell {
  width: 100%;
  max-width: 440px;
  margin-inline: auto;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  position: relative;
  background: var(--color-bg);
  background-image: var(--grad-pitch);
  background-repeat: no-repeat;
}
@media (min-width: 1024px) {
  .app-shell {
    max-width: 1280px;
    display: grid;
    grid-template-columns: 260px 1fr;
    gap: 0;
  }
}
@media (min-width: 480px) and (max-width: 1023px) {
  .app-shell {
    border-left: 1px solid var(--color-line);
    border-right: 1px solid var(--color-line);
  }
}
```
Update `.app-bottombar` `src/index.css:131` add responsive hide:
```css
.app-bottombar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 440px;
  z-index: 30;
}
@media (min-width: 1024px) {
  .app-bottombar { display: none; }
}
```
Add skip-link + fix contrast at end of file before `/* Gradientes */`:
```css
.skip-link {
  position: absolute;
  left: -9999px;
  top: 8px;
  z-index: 100;
  background: var(--color-primary);
  color: var(--color-on-primary);
  padding: 8px 16px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 14px;
}
.skip-link:focus { left: 8px; }
@media (min-width: 1024px) {
  :root { --color-ink-faint: #7a82b5; } /* 4.5:1 sobre surface para 12px */
}
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
```

- [ ] **Step 3: Run typecheck to ensure CSS edit doesn't break build**

Run: `npm run typecheck`
Expected: PASS (no TS errors)

- [ ] **Step 4: Create `src/components/DesktopSidebar.tsx`**

```tsx
import { NavLink } from 'react-router-dom'

export function DesktopSidebar() {
  const base = 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors'
  const active = 'bg-surface-2 text-primary'
  const idle = 'text-ink-soft hover:bg-surface-2 hover:text-ink'
  return (
    <aside className="hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-dvh lg:w-[260px] lg:shrink-0 lg:border-r lg:border-line lg:bg-bg lg:px-3 lg:py-4">
      <div className="mb-6 flex items-center gap-3 px-2">
        <span className="grad-primary nums grid h-10 w-10 place-items-center rounded-xl text-sm font-bold text-on-primary">LP</span>
        <div>
          <p className="text-sm font-bold leading-none">La Porra</p>
          <p className="text-xs text-ink-faint">Stadium Night</p>
        </div>
      </div>
      <nav aria-label="Principal" className="flex flex-1 flex-col gap-1">
        <NavLink to="/" end className={({isActive})=> `${base} ${isActive?active:idle}`} aria-label="Porras">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5h16v14H4zM4 10h16M9 5v14"/></svg> Porras
        </NavLink>
        <NavLink to="/perfil" className={({isActive})=> `${base} ${isActive?active:idle}`} aria-label="Perfil">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0"/></svg> Perfil
        </NavLink>
        <div className="my-3 border-t border-line" />
        <NavLink to="/crear" className={({isActive})=> `${base} ${isActive?active:idle}`}>+ Crear porra</NavLink>
        <NavLink to="/unirse" className={({isActive})=> `${base} ${isActive?active:idle}`}>Unirme con código</NavLink>
      </nav>
      <p className="px-2 text-[11px] text-ink-faint">© La Porra · privada entre amigos</p>
    </aside>
  )
}
```

- [ ] **Step 5: Modify `src/App.tsx` — integrate sidebar, skip-link, landmarks**

Add import: `import { DesktopSidebar } from './components/DesktopSidebar'`
In `Root()` `src/App.tsx:44` wrap authenticated routes:
```tsx
if (!session) return <Auth />
return (
  <div className="app-shell">
    <a href="#main-content" className="skip-link">Saltar al contenido</a>
    <DesktopSidebar />
    <div className="flex min-w-0 flex-1 flex-col">
      <Routes> {/* ...existing Routes */} </Routes>
    </div>
  </div>
)
```
In `TabLayout` `src/App.tsx:60` add id and hide bottom bar on lg:
```tsx
function TabLayout() {
  return (
    <div className="flex flex-1 flex-col">
      <div id="main-content" className="flex flex-1 flex-col pb-20 lg:pb-0">
        <Outlet />
      </div>
      <TabBar />
    </div>
  )
}
function TabBar() { /* add lg:hidden to nav class */ 
  return <nav className="app-bottombar safe-bottom border-t border-line bg-surface/95 backdrop-blur lg:hidden"> ...
}
```
In `Profile` `src/App.tsx:222` header already has `safe-top`; add `lg:px-8` to outer div, and change inner cards container to `lg:grid lg:grid-cols-[280px_1fr] gap-6` for desktop (keep mobile stack).

- [ ] **Step 6: Run typecheck + build**

Run: `npm run typecheck && npm run build 2>&1 | tail -n 30`
Expected: PASS, no TS errors, Vite build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/index.css src/components/DesktopSidebar.tsx src/App.tsx
git commit -m "feat(desktop): shell grid 260px+1fr, sidebar N3, skip-link, a11y base"
```

---

### Task 2: Home + Auth/CreatePool responsive

**Files:**
- Modify: `src/screens/Home.tsx`
- Modify: `src/screens/Auth.tsx`
- Modify: `src/screens/CreatePool.tsx`

- [ ] **Step 1: Verify current Home layout fails desktop width**

Run: `grep -n "space-y-3" src/screens/Home.tsx && echo "USES_STACK_OK"`
Expected: finds `space-y-3` on pool list

- [ ] **Step 2: Edit `src/screens/Home.tsx` — grilla salas + max-width desktop**

In `Home` `src/screens/Home.tsx:43` wrap outer div:
```tsx
return (
  <div className="flex flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-[1120px]">
    <header className="safe-top px-5 pb-1 pt-5 lg:px-8 lg:pt-8"> {/* + lg:px */}
```
Change pool list `src/screens/Home.tsx:90`:
```tsx
<ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:grid-cols-3">
```
InstallBanner + botones mantienen `px-5 lg:px-8`.

- [ ] **Step 3: Edit `src/screens/Auth.tsx` — split hero/form en desktop**

In outer `Auth` `src/screens/Auth.tsx:58`:
```tsx
<div className="app-shell"> {/* already, but inner */}
<div className="flex flex-1 items-center justify-center px-5 py-8 lg:px-8">
  <div className="card w-full max-w-sm overflow-hidden lg:max-w-5xl lg:grid lg:grid-cols-2">
    <div className="grad-hero ... lg:flex lg:flex-col lg:justify-center lg:px-10"> {/* hero */}
    <div className="p-6 lg:p-8"> {/* form */}
```
Keep existing hero + form content, just add grid classes. Same for `SetPassword` in `App.tsx:118` (optional — leave mobile-only).

- [ ] **Step 4: Edit `src/screens/CreatePool.tsx` — two-col desktop**

Wrap form `src/screens/CreatePool.tsx:49`:
```tsx
<div className="flex flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-[900px]">
  <ScreenHeader ... />
  <form className="flex flex-1 flex-col gap-6 px-5 py-6 lg:grid lg:grid-cols-2 lg:gap-8 lg:px-8">
    <div className="space-y-6"> {/* col izq: nombre + competición */}
    <div className="space-y-6"> {/* col der: puntuación + submit */}
```
Move submit button to `lg:col-span-2 lg:mt-4`.

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck && npm run build 2>&1 | tail -n 20`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/screens/Home.tsx src/screens/Auth.tsx src/screens/CreatePool.tsx
git commit -m "feat(desktop): Home/Auth/CreatePool grillas lg"
```

---

### Task 3: Pool — Predicciones 2cols, JornadaBar tablist, Ranking/Bote tabla

**Files:**
- Modify: `src/screens/Pool.tsx`

- [ ] **Step 1: Verify current Pool structure**

Run: `grep -n "JornadaBar\|PoolNav\|PrediccionesSection" src/screens/Pool.tsx | head`
Expected: finds 3 components

- [ ] **Step 2: Pool main layout — grid 1fr 360px + sticky aside**

In `Pool` `src/screens/Pool.tsx:124` return block:
```tsx
return (
  <div className="flex flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-[1280px]">
    <ScreenHeader ... />
    <div className="flex-1 px-4 pb-32 pt-4 lg:grid lg:grid-cols-[1fr_360px] lg:gap-6 lg:px-6 lg:pb-6">
      <div className="min-w-0">
        {section === 'predicciones' && ...}
        {section === 'ranking' && <div className="lg:hidden"><RankingSection .../></div>}
        {section === 'cartas' && ...}
      </div>
      <aside className="hidden lg:block lg:sticky lg:top-4 lg:h-fit lg:space-y-4">
        {/* Desktop: siempre muestra ranking/bote contextual */}
        <RankingSection pool={pool} round={selectedRound} />
        {/* opcional: resumen bote compacto */}
      </aside>
    </div>
    <div className="app-bottombar safe-bottom border-t border-line bg-surface/95 backdrop-blur lg:hidden">
      {section !== 'cartas' && <JornadaBar ... />}
      <PoolNav ... />
    </div>
    {/* Desktop JornadaBar replica arriba del main */}
    <div className="hidden lg:block">
      {section !== 'cartas' && <JornadaBar segments={segments} selectedKey={selectedSegKey} onSelect={setSelectedSegKey} />}
    </div>
  </div>
)
```
Keep mobile logic: ranking inside main only when `section==='ranking'` and `lg:hidden`; desktop aside always visible.

- [ ] **Step 3: PrediccionesSection — xl 2cols**

In `PrediccionesSection` `src/screens/Pool.tsx:425` change:
```tsx
<div className="divide-y divide-line lg:divide-y-0 xl:grid xl:grid-cols-2 xl:gap-3 xl:divide-y-0 xl:p-3">
```
Each `MatchRow` wrapper gets `xl:rounded-2xl xl:border xl:border-line xl:bg-surface/50`.

- [ ] **Step 4: JornadaBar — tablist keyboard (WCAG 2.1.1)**

Rewrite `JornadaBar` `src/screens/Pool.tsx:167` to add desktop tablist variant visible `lg`:
```tsx
function JornadaBar({segments,selectedKey,onSelect}:...){
  if(!segments.length) return null
  const idx = segments.findIndex(s=>s.key===selectedKey)
  const seg = segments[idx]
  const sameRound = seg ? segments.filter(s=>s.roundId===seg.roundId) : []
  const partLabel = ...
  // Desktop
  return (
    <>
      {/* Mobile: keep existing flex Ant/Sig */}
      <div className="flex items-center justify-between border-b border-line px-2 py-1.5 lg:hidden"> ...</div>
      {/* Desktop */}
      <div role="tablist" aria-label="Jornadas" className="hidden lg:flex lg:items-center lg:gap-2 lg:border lg:border-line lg:rounded-2xl lg:bg-surface lg:p-2">
        {segments.map(s=>{
          const sel = s.key===selectedKey
          return <button key={s.key} role="tab" aria-selected={sel} onClick={()=>onSelect(s.key)} onKeyDown={e=>{if(e.key==='ArrowRight'){const n=Math.min(idx+1,segments.length-1);onSelect(segments[n].key)} if(e.key==='ArrowLeft'){const p=Math.max(idx-1,0);onSelect(segments[p].key)}}} className={`rounded-xl px-3 py-2 text-sm font-bold ${sel?'bg-surface-2 text-primary':'text-ink-faint hover:bg-surface-2'}`}>{s.name}</button>
        })}
      </div>
    </>
  )
}
```

- [ ] **Step 5: RankingSection/BoteList — tabla semántica lg**

In `StandingsList` `src/screens/Pool.tsx:867` keep `ul` but add `lg:hidden` and add sibling table `hidden lg:table`:
```tsx
return (
  <>
    <ul className="space-y-2 lg:hidden"> ...existing li ... </ul>
    <table className="hidden lg:table w-full text-sm">
      <caption className="sr-only">Clasificación general</caption>
      <thead><tr className="text-xs text-ink-faint"><th className="text-left p-2">#</th><th className="text-left p-2">Jugador</th><th className="text-right p-2">Pts</th></tr></thead>
      <tbody>{rows.map((r,i)=><tr key={r.user_id} className="border-t border-line"><td className="p-2">{i<3?MEDAL[i]:i+1}</td><td className="p-2 flex items-center gap-2"><Avatar url={r.avatar_url} name={r.display_name} size={28}/>{r.display_name}</td><td className="p-2 text-right scoreboard text-primary">{r.points}</td></tr>)}</tbody>
    </table>
  </>
)
```
Same pattern for `BoteList` `src/screens/Pool.tsx:809`.

- [ ] **Step 6: PoolNav hide on lg**

In `PoolNav` `src/screens/Pool.tsx:212` add `lg:hidden` to outer `div className="flex"`.

- [ ] **Step 7: Typecheck + build**

Run: `npm run typecheck && npm run build 2>&1 | tail -n 20`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/screens/Pool.tsx
git commit -m "feat(desktop): Pool grid 1fr 360px, JornadaBar tablist, Ranking tabla lg"
```

---

### Task 4: Cards Sheet dialog + contrast/perf polish + verificación

**Files:**
- Modify: `src/components/Cards.tsx`
- Modify: `src/ui.tsx`
- Verify: full app

- [ ] **Step 1: Sheet — desktop dialog centrado + focus trap**

Edit `Sheet` `src/components/Cards.tsx:84`:
```tsx
function Sheet({title,children,onClose}:{...}){
  useEffect(()=>{
    const onKey=e=>{if(e.key==='Escape') onClose()}
    window.addEventListener('keydown',onKey)
    const prev=document.activeElement
    // trap: focus first button
    return ()=>{window.removeEventListener('keydown',onKey); (prev as HTMLElement)?.focus?.()}
  },[onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm lg:items-center lg:p-6" onClick={onClose}>
      <div className="safe-bottom max-h-[85dvh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl border-t border-line bg-surface px-5 pb-6 pt-3 lg:max-h-[85vh] lg:max-w-[560px] lg:rounded-2xl lg:border" style={{animation:'slideup 0.3s var(--ease-out)'}} onClick={e=>e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-strong lg:hidden" />
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} aria-label="Cerrar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft hover:bg-surface-3">…</button>
        </div>
        {children}
      </div>
    </div>
  )
}
```
Also `ProfileSheet` `src/components/Cards.tsx:124` y `MatchDetailSheet:569` aplican mismo patrón `lg:items-center lg:max-w-[560px] lg:rounded-2xl`.

- [ ] **Step 2: CartasSection grid 3 cols lg**

In `CartasSection` `src/components/Cards.tsx:374` change:
```tsx
<div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
```

- [ ] **Step 3: ui.tsx — asegura focus-visible y min target**

In `Button` `src/ui.tsx:31` class already `min-h-12`, add `focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2`.
In `Field` `src/ui.tsx:53` add `focus-visible:border-primary`.

- [ ] **Step 4: Verificación completa (320/768/1024/1280 + teclado)**

Run:
```bash
npm run typecheck && npm run build
echo "CHECK: buscar lg:hidden en shell"
grep -rq "lg:hidden" src/App.tsx src/screens/Pool.tsx && echo "LG_HIDDEN_OK" || echo "FAIL"
grep -q "skip-link" src/App.tsx && echo "SKIP_OK" || echo "FAIL"
grep -q "DesktopSidebar" src/App.tsx && echo "SIDEBAR_OK" || echo "FAIL"
# Lighthouse manual: abrir http://localhost:5173, Chrome DevTools Lighthouse A11y
```
Expected: all `*_OK`, build PASS.

Manual QA checklist (hacer en preview):
- [ ] 320px sin scroll-x, TabBar visible, sidebar oculto.
- [ ] 1024px sidebar visible, bottomBar oculto, Pool `1fr 360px`, Predicciones 1col lg / 2cols xl.
- [ ] 1280px Home 3 cols, Auth 2cols.
- [ ] Tab recorre sidebar→main→aside→Sheet, Esc cierra Sheet, focus vuelve al trigger.
- [ ] Zoom 200% sin rotura, `prefers-reduced-motion` reduce animaciones.
- [ ] Lighthouse A11y ≥95, Contrast 4.5:1 en `ink-faint` desktop.

- [ ] **Step 5: Commit**

```bash
git add src/components/Cards.tsx src/ui.tsx
git commit -m "feat(desktop): Sheet dialog lg, Cartas 3cols, focus-visible polish"
```

---

## Plan Review Loop

- Dispatch `plan-document-reviewer` with paths: `docs/superpowers/plans/2026-09-01-desktop-version.md` + `docs/superpowers/specs/2026-09-01-desktop-version-design.md`
- If Issues Found → fix + re-dispatch (max 3)
- If Approved → handoff to execution

## Execution Handoff

After approval, offer:

**1. Subagent-Driven (recommended)** — fresh subagent per Task 1-4, review entre tareas, iteración rápida.

**2. Inline Execution** — `superpowers:executing-plans` en esta sesión, checkpoints por lote.

**User pick → dispatch accordingly.**

