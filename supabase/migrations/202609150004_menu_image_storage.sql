-- Public reads are needed by the customer menu; writes remain restricted to admins.
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do update set public = true;

drop policy if exists "admins can upload menu images" on storage.objects;
create policy "admins can upload menu images"
on storage.objects for insert to authenticated
with check (bucket_id = 'menu-images' and public.is_admin());

drop policy if exists "admins can update menu images" on storage.objects;
create policy "admins can update menu images"
on storage.objects for update to authenticated
using (bucket_id = 'menu-images' and public.is_admin())
with check (bucket_id = 'menu-images' and public.is_admin());

drop policy if exists "admins can delete menu images" on storage.objects;
create policy "admins can delete menu images"
on storage.objects for delete to authenticated
using (bucket_id = 'menu-images' and public.is_admin());
