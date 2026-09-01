import { NavLink } from 'react-router-dom'

export function DesktopSidebar() {
  const base =
    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2'
  const active = 'bg-surface-2 text-primary'
  const idle = 'text-ink-soft hover:bg-surface-2 hover:text-ink'

  return (
    <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-dvh lg:w-[260px] lg:shrink-0 lg:flex-col lg:border-r lg:border-line lg:bg-bg lg:px-3 lg:py-4">
      <div className="mb-6 flex items-center gap-3 px-2">
        <span className="grad-primary nums grid h-10 w-10 place-items-center rounded-xl text-sm font-bold text-on-primary">
          LP
        </span>
        <div>
          <p className="text-sm font-bold leading-none">La Porra</p>
          <p className="text-xs text-ink-faint">Stadium Night</p>
        </div>
      </div>
      <nav aria-label="Principal" className="flex flex-1 flex-col gap-1">
        <NavLink to="/" end className={({ isActive }) => `${base} ${isActive ? active : idle}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 5h16v14H4zM4 10h16M9 5v14" />
          </svg>
          Porras
        </NavLink>
        <NavLink to="/perfil" className={({ isActive }) => `${base} ${isActive ? active : idle}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0" />
          </svg>
          Perfil
        </NavLink>
        <div className="my-3 border-t border-line" aria-hidden="true" />
        <NavLink to="/crear" className={({ isActive }) => `${base} ${isActive ? active : idle}`}>
          + Crear porra
        </NavLink>
        <NavLink to="/unirse" className={({ isActive }) => `${base} ${isActive ? active : idle}`}>
          Unirme con código
        </NavLink>
      </nav>
      <p className="px-2 text-[11px] text-ink-faint">© La Porra · privada entre amigos</p>
    </aside>
  )
}
