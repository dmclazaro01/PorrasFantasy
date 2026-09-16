-- ============================================================
-- Porra Fantasy · 0035 · Freeze con PRENSA (30 min)
-- ============================================================
-- Si hay una Rueda de prensa JUGADA contra ti en un partido, tu
-- pronóstico queda congelado cuando faltan 30 minutos o menos para el
-- pitido: ni crear ni modificar (el upsert del frontend pasa por ambas
-- políticas). Con más de 30 minutos se puede cambiar con normalidad,
-- aunque la predicción ya sea pública.
-- ============================================================

drop policy if exists predictions_insert on porra.predictions;
create policy predictions_insert on porra.predictions
for insert to authenticated
with check (
  user_id = auth.uid()
  and porra.is_pool_member(pool_id, auth.uid())
  and exists (
    select 1 from porra.matches m
    where m.id = predictions.match_id
      and m.kickoff > now()
      and (
        m.kickoff > now() + interval '30 minutes'
        or not exists (
          select 1 from porra.cards c
          where c.pool_id = predictions.pool_id
            and c.type = 'PRENSA'
            and c.status = 'PLAYED'
            and c.match_id = predictions.match_id
            and c.target_user_id = predictions.user_id
        )
      )
  )
);

drop policy if exists predictions_update on porra.predictions;
create policy predictions_update on porra.predictions
for update to authenticated
using (
  user_id = auth.uid()
  and not exists (
    select 1 from porra.cards c
    join porra.matches m on m.id = predictions.match_id
    where c.pool_id = predictions.pool_id
      and c.type = 'PRENSA'
      and c.status = 'PLAYED'
      and c.match_id = predictions.match_id
      and c.target_user_id = predictions.user_id
      and m.kickoff <= now() + interval '30 minutes'
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from porra.matches m
    where m.id = predictions.match_id
      and m.kickoff > now()
      and (
        m.kickoff > now() + interval '30 minutes'
        or not exists (
          select 1 from porra.cards c
          where c.pool_id = predictions.pool_id
            and c.type = 'PRENSA'
            and c.status = 'PLAYED'
            and c.match_id = predictions.match_id
            and c.target_user_id = predictions.user_id
        )
      )
  )
);
