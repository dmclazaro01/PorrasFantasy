import { useEffect, useState } from 'react'
import {
  deletePool,
  getMembers,
  regenPoolCode,
  removePoolMember,
  rescorePool,
  updatePool,
  type Member,
  type Pool,
} from '../lib/api'
import { Avatar, Button, Field, Spinner } from '../ui'
import { Sheet } from './Cards'

/** Panel de administración de la porra (dueño o admin de la app). */
export function PoolAdminSheet({
  pool,
  onChanged,
  onDeleted,
  onClose,
}: {
  pool: Pool
  onChanged: () => void
  onDeleted: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(pool.name)
  const [p1x2, setP1x2] = useState(String(pool.points_1x2))
  const [pExact, setPExact] = useState(String(pool.points_exact))
  const [members, setMembers] = useState<Member[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [kickId, setKickId] = useState<string | null>(null)

  useEffect(() => {
    getMembers(pool.id).then(setMembers).catch(() => setMembers([]))
  }, [pool.id])

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key)
    setMsg(null)
    try {
      await fn()
      setMsg(`✓ ${ok}`)
      onChanged()
      if (key === 'members') setMembers(await getMembers(pool.id))
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(null)
      setKickId(null)
    }
  }

  return (
    <Sheet title="Administrar porra" onClose={onClose}>
      <div className="mt-2 space-y-5">
        <div>
          <Field
            label="Nombre de la porra"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="mt-2 sm:max-w-xs">
            <Button
              full loading={busy === 'name'} disabled={!name.trim() || name.trim() === pool.name}
              onClick={() => run('name', () => updatePool(pool.id, { name: name.trim() }), 'Nombre guardado')}
            >
              Guardar nombre
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface-2 p-4">
          <p className="text-sm font-bold">Puntuación</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Al guardar se recalcula TODO el historial con los nuevos valores.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Acertar 1·X·2" type="number" min={0} max={50} value={p1x2} onChange={(e) => setP1x2(e.target.value.replace(/\D/g, ''))} />
            <Field label="Resultado exacto" type="number" min={0} max={50} value={pExact} onChange={(e) => setPExact(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="mt-3 sm:max-w-xs">
            <Button
              full variant="secondary" loading={busy === 'points'}
              onClick={() =>
                run('points', async () => {
                  await updatePool(pool.id, { points_1x2: Number(p1x2), points_exact: Number(pExact) })
                  await rescorePool(pool.id)
                }, 'Puntos guardados y recalculados')
              }
            >
              Guardar y recalcular
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 p-4">
          <div>
            <p className="text-sm font-bold">Código de invitación</p>
            <p className="nums text-2xl font-bold tracking-[0.2em] text-primary">{pool.invite_code}</p>
          </div>
          <Button variant="secondary" loading={busy === 'code'} onClick={() => run('code', () => regenPoolCode(pool.id), 'Código nuevo generado')}>
            Nuevo
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-bold">Miembros ({members?.length ?? '…'})</p>
          {members === null ? (
            <div className="flex justify-center py-4 text-ink-faint"><Spinner small /></div>
          ) : (
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 rounded-xl border border-line-strong bg-surface-2 px-3 py-2">
                  <Avatar url={m.avatar_url} name={m.display_name} size={30} />
                  <span className="flex-1 truncate text-sm font-semibold">
                    {m.display_name}
                    {m.user_id === pool.owner_id && <span className="text-ink-faint"> · dueño</span>}
                  </span>
                  {m.user_id !== pool.owner_id &&
                    (kickId === m.user_id ? (
                      <span className="flex gap-1">
                        <button
                          onClick={() => run('members', () => removePoolMember(pool.id, m.user_id), 'Expulsado')}
                          className="rounded-lg bg-loss/15 px-2 py-1 text-xs font-bold text-loss"
                        >
                          Sí
                        </button>
                        <button onClick={() => setKickId(null)} className="rounded-lg bg-surface-3 px-2 py-1 text-xs font-bold">
                          No
                        </button>
                      </span>
                    ) : (
                      <button onClick={() => setKickId(m.user_id)} className="rounded-lg px-2 py-1 text-xs font-bold text-ink-faint hover:text-loss">
                        Expulsar
                      </button>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-loss/40 bg-loss/5 p-4">
          <p className="text-sm font-bold text-loss">Zona de peligro</p>
          {!confirmDelete ? (
            <div className="mt-2">
              <Button variant="danger" full onClick={() => setConfirmDelete(true)}>
                Eliminar la porra
              </Button>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-ink-soft">Se borra todo: miembros, pronósticos, cartas y bote. Sin vuelta atrás.</p>
              <div className="flex gap-2">
                <Button variant="danger" full loading={busy === 'delete'} onClick={() => run('delete', () => deletePool(pool.id), '').then(onDeleted)}>
                  Sí, eliminar
                </Button>
                <Button variant="secondary" full onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>

        {msg && (
          <p className={`text-sm font-medium ${msg.startsWith('✓') ? 'text-primary' : 'text-loss'}`}>{msg}</p>
        )}
      </div>
    </Sheet>
  )
}
