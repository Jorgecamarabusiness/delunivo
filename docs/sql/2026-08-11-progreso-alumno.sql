-- =============================================================================
-- Aularia — 2026-08-11 (segunda tanda)
-- Progreso del alumno: hasta ahora el "% completado" del aula vivía solo en
-- memoria (useState) y `video_views` no la escribía NADIE — solo la leía
-- /admin/estadisticas. Un alumno cerraba la pestaña y perdía su progreso, y las
-- estadísticas del admin mostraban datos congelados.
--
-- Modelo: UNA FILA EN video_views = ESA LECCIÓN ESTÁ COMPLETADA por ese alumno.
-- No hacen falta columnas nuevas (`watched_seconds`/`completed` estaban
-- documentadas pero nunca existieron en la tabla real).
-- Idempotente: se puede ejecutar dos veces.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Una sola fila por (alumno, lección)
--    Sin esto se acumulan duplicados cada vez que alguien marca una lección, y
--    /admin/estadisticas tiene que deduplicar a mano al contar.
--    Primero se limpian los duplicados que ya hubiera, quedándose con el más
--    antiguo de cada par.
-- ─────────────────────────────────────────────────────────────────────────────
delete from public.video_views v
where exists (
  select 1
  from public.video_views otra
  where otra.user_id = v.user_id
    and otra.lesson_id = v.lesson_id
    and (otra.viewed_at < v.viewed_at
         or (otra.viewed_at = v.viewed_at and otra.id < v.id))
);

create unique index if not exists video_views_user_lesson_key
  on public.video_views (user_id, lesson_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Que el alumno pueda DESMARCAR una lección
--    Ya podía insertar (marcarla), pero no había policy de DELETE: el borrado
--    no daba error, simplemente no borraba nada — el peor de los dos mundos,
--    porque la interfaz se quedaba desmarcada y la base de datos no.
--    Solo sus propias filas; las de otros alumnos siguen siendo intocables.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists video_views_owner_delete on public.video_views;
create policy video_views_owner_delete
  on public.video_views
  for delete
  to authenticated
  using (user_id = auth.uid());
