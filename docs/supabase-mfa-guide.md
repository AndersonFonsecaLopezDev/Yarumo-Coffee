# Guía de Activación y Gestión de Autenticación Multifactor (MFA / 2FA)
## Yarumo Coffee · Panel de Staff (`/staff`)

Esta guía describe el procedimiento técnico y operativo para habilitar la **Autenticación en Dos Pasos (TOTP / Authenticator)** en Supabase Auth, protegiendo las cuentas con roles críticos (`owner` y `manager`).

---

### 1. ¿Por qué es fundamental para Yarumo Coffee?
El panel `/staff` gestiona precios, catálogo comercial, comandas de mesas en tiempo real y credenciales de empleados. La activación de MFA impide accesos no autorizados incluso ante filtraciones accidentales de contraseña o ataques de phishing.

---

### 2. Activación en el Dashboard de Supabase
1. Ingresa a [https://supabase.com/dashboard](https://supabase.com/dashboard) y selecciona el proyecto de Yarumo Coffee.
2. En la barra lateral izquierda, dirígete a **Authentication** > **Providers** (o **Configuration** > **Auth**).
3. Localiza la sección **Multi-Factor Authentication (MFA)**.
4. Asegúrate de que **TOTP (Time-based One-time Password)** esté en estado **Enabled**.
5. Configura la política de aplicación recomendada:
   - **Max Enrolled Factors Per User:** `2` (permite registrar un factor principal y uno de respaldo).

---

### 3. Procedimiento para el Personal (Dueño y Administradores)
1. Iniciar sesión normalmente con correo y contraseña en `/staff`.
2. Una vez dentro, en la pestaña **Configuración** (`settings`) o perfil de usuario:
   - La app invoca el flujo nativo de Supabase Auth:
     ```ts
     const { data, error } = await supabase.auth.mfa.enroll({
       factorType: 'totp',
       friendlyName: 'Yarumo Authenticator'
     })
     ```
   - Se presenta un código QR en pantalla o la clave secreta manual.
3. El usuario escanea el código QR con su aplicación de autenticación preferida:
   - **Google Authenticator** (Android / iOS)
   - **1Password** o **Bitwarden**
   - **Microsoft Authenticator**
4. Se introduce el código temporal de 6 dígitos para verificar y activar el factor:
   ```ts
   await supabase.auth.mfa.challengeAndVerify({
     factorId: data.id,
     code: '123456'
   })
   ```

---

### 4. Aplicación de Políticas RLS y Nivel de Garantía (AAL2)
Para forzar que las operaciones críticas del panel (como `/api/admin/users` o mutaciones sobre `menu_items`) requieran obligatoriamente haber completado el segundo factor:

```sql
-- Ejemplo de política Postgres RLS reforzada para requerir AAL2 (Authenticator verificado)
create policy "Solo administradores con MFA pueden editar usuarios"
on public.staff_profiles
as restrictive
for all
to authenticated
using (
  auth.jwt()->>'aal' = 'aal2'
);
```

---

### 5. Plan de Contingencia y Recuperación
- **¿Qué hacer si un administrador pierde su teléfono?**
  1. El usuario con rol `owner` ingresa a Supabase Dashboard > **Authentication** > **Users**.
  2. Localiza al usuario afectado y hace clic en **View User Factors**.
  3. Desvincula el factor TOTP perdido.
  4. El empleado vuelve a iniciar sesión con contraseña e inscribe su nuevo dispositivo.
