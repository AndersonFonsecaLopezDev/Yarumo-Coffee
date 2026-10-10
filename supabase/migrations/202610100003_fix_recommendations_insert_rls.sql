-- Migración: Corrección de RLS e inserción de recomendaciones con status 'pending'
-- Asegurar que la restricción CHECK admita 'published', 'pending', 'hidden' y tenga default 'pending'
alter table if exists public.recommendations drop constraint if exists recommendations_status_check;
alter table if exists public.recommendations add constraint recommendations_status_check check (status in ('published', 'pending', 'hidden'));
alter table if exists public.recommendations alter column status set default 'pending';

-- Actualizar política RLS para permitir inserciones públicas de recomendaciones en estado 'pending' o 'published'
drop policy if exists "public can insert recommendations" on public.recommendations;
create policy "public can insert recommendations"
  on public.recommendations for insert
  to anon, authenticated
  with check (status in ('pending', 'published'));
