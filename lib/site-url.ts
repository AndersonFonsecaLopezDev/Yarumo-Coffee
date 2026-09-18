/**
 * Fuente única de verdad para la URL pública del sitio.
 *
 * El dominio canónico de producción es https://yarumo-coffee.vercel.app.
 * Si en el futuro se usa un dominio propio, hay que actualizar TANTO
 * la variable de entorno NEXT_PUBLIC_APP_URL en Vercel COMO el valor
 * de CANONICAL_SITE_URL aquí abajo (que sirve como fallback si la env
 * var no está seteada en algún entorno).
 */
export const CANONICAL_SITE_URL = 'https://yarumo-coffee.vercel.app'

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || CANONICAL_SITE_URL

/**
 * Enlace directo al panel de reseñas de Google con el ID de lugar (CID).
 * Abre directamente la ficha y opiniones de Yarumo Coffee en Google Maps / Search.
 */
export const GOOGLE_REVIEWS_URL =
  'https://www.google.com/search?q=Yarumo+Coffee+Armenia#lrd=0x8e38f50004b02e57:0x9b259ac75da27a11,3,,,,'

