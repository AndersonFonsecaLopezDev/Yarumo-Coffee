-- Migración: Restringir inserción directa pública en order_requests (202610200002_harden_order_requests_rls.sql)
-- Elimina la política permisiva 'public can create order for matching active table'.
-- Toda creación de pedidos por parte de clientes se canaliza a través de la función RPC transaccional
-- submit_order_request (security definer), que valida el token de mesa, disponibilidad, snapshot de precios y anti-spam.

drop policy if exists "public can create order for matching active table" on public.order_requests;

-- Asegurar que el personal de staff autenticado conserve la capacidad de insertar pedidos directamente
drop policy if exists "staff can insert order_requests" on public.order_requests;
create policy "staff can insert order_requests"
  on public.order_requests for insert
  to authenticated
  with check (public.is_staff());
