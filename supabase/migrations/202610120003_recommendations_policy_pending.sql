-- Migración: Restringir inserción anónima de recomendaciones estrictamente a status 'pending'
-- Reemplaza la política anterior que permitía status 'published' directo a usuarios anónimos

drop policy if exists "public can insert recommendations" on public.recommendations;

create policy "public can insert recommendations"
  on public.recommendations for insert
  to anon, authenticated
  with check (status = 'pending');
