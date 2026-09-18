-- Migración: Restringir inserción directa pública en order_request_items (202609180003_harden_order_request_items_rls.sql)
-- Elimina la política permisiva 'public can insert order items'.
-- Toda creación de pedidos de clientes debe ejecutarse a través de la función RPC transaccional
-- submit_order_request (security definer), la cual valida token de mesa, disponibilidad y anti-spam.

drop policy if exists "public can insert order items" on public.order_request_items;

-- Permitir inserción directa exclusivamente a usuarios con rol de staff autenticados
drop policy if exists "staff can insert order items" on public.order_request_items;
create policy "staff can insert order items"
  on public.order_request_items for insert
  to authenticated
  with check (public.is_staff());
