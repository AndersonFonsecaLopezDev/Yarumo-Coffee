'use client'

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'

export type Language = 'es' | 'en'

const esTranslations = {
  // Header & Nav
  nav_home: 'Inicio',
  nav_menu: 'Carta Digital',
  nav_opinions: 'Opiniones',
  nav_visit: 'Visítanos',
  nav_aria_main: 'Navegación principal',
  table_badge: 'Mesa',
  table_badge_title: 'Mesa vinculada mediante código QR',
  table_badge_active: 'Activa',
  table_label_prefix: 'Mesa',
  takeaway: 'Para llevar / Barra',
  lang_switch: 'English',
  skip_link: 'Saltar a la carta',
  instagram_aria: 'Abrir perfil de Instagram de Yarumo Coffee',

  // Hero
  hero_eyebrow: 'Armenia · Quindío · Colombia',
  hero_title_1: 'Donde cada taza',
  hero_title_2: 'cuenta una historia.',
  hero_desc:
    'Café especial cultivado en las montañas del Quindío, tostado con precisión y servido con calidez en tu mesa.',
  hero_cta: 'Ver carta digital ↓',
  hero_badge: '☕ Atención en mesa y domicilios',
  hero_origin_title: 'Café de Origen',
  hero_origin_sub: 'Armenia, Quindío',
  hero_welcome_aria: 'Bienvenida a Yarumo Coffee',
  hero_photo_aria: 'Café de Yarumo servido en mesa',
  hero_photo_alt: 'Taza de café especial servida en mesa de Yarumo Coffee',

  // Footer
  footer_tagline: 'Yarumo Coffee · Donde cada taza cuenta una historia.',
  footer_nav_aria: 'Enlaces del pie de página',
  footer_leave_review: 'Dejar recomendación',
  footer_google_reviews: 'Reseñas de Google ↗',
  footer_google_aria: 'Abrir reseñas de Google de Yarumo Coffee',
  footer_instagram_aria: 'Abrir Instagram de Yarumo Coffee',

  // VisitStrip
  visit_aria: 'Ubicación y horarios',
  visit_eyebrow: 'Ven a vernos',
  visit_title_1: 'Tu mesa',
  visit_title_2: 'te espera.',
  visit_address_line1: 'Carrera 19 # 21 Norte-01 Local 1',
  visit_address_line2: 'Armenia, Quindío',
  visit_maps_cta: 'Abrir en Google Maps ↗',
  visit_maps_aria: 'Abrir dirección de Yarumo Coffee en Google Maps',

  // TableServiceSection
  service_checking_aria: 'Verificando mesa',
  service_qr_invalid_title: '⚠️ Código QR no encontrado o caducado',
  service_qr_invalid_heading: 'Atención en Barra o Para Llevar',
  service_qr_invalid_desc:
    'El código escaneado no corresponde a una mesa activa en este momento. Puedes explorar la carta para pedir en barra, solicitar domicilio o consultar a nuestro equipo.',
  service_continue_counter: 'Continuar en barra / Para llevar',
  service_aria: 'Servicio en mesa',
  service_notice_aria: 'Aviso de mesa',
  service_eyebrow_table_prefix: 'Atención personalizada · Mesa',
  service_eyebrow_delivery: 'Atención en mesa y domicilios',
  service_heading_table_suffix: 'conectada',
  service_heading_general: 'Pide a tu mesa o a domicilio',
  service_desc_table:
    'Puedes llamar al mesero, pedir la cuenta o agregar productos directo a tu comanda.',
  service_desc_general:
    'Si estás en la cafetería, escanea el código QR de tu mesa para vincular tu pedido.',
  service_call_waiter: 'Llamar mesero',
  service_calling_waiter: 'Llamando...',
  service_call_waiter_aria: 'Llamar al mesero a la mesa',
  service_request_bill: 'Pedir la cuenta',
  service_requesting_bill: 'Solicitando...',
  service_request_bill_aria: 'Pedir la cuenta de la mesa',
  service_explore_menu: 'Explorar carta',
  toast_qr_expired: 'Este código QR no está activo o caducó. Pide asistencia a nuestro equipo.',
  toast_scan_qr_prompt: 'Escanea el QR de tu mesa para llamar al mesero o pedir la cuenta.',
  toast_service_error: 'No se pudo enviar la solicitud. Intenta nuevamente.',
  toast_waiter_sent: '🛎️ Solicitud enviada: el mesero viene en camino a tu mesa.',
  toast_bill_sent: '🧾 Solicitud enviada: la cuenta fue solicitada para tu mesa.',

  // Catalog
  catalog_eyebrow: 'Selección de la casa',
  catalog_title: 'Nuestra Carta',
  catalog_aria: 'Carta digital de productos',
  tab_all: 'Todos',
  tab_favorites: 'Favoritos',
  search_placeholder: 'Buscar café, postres, bebidas...',
  search_aria: 'Buscar productos en la carta',
  clear_search: 'Limpiar búsqueda',
  showing_items: 'Mostrando',
  of_items: 'de',
  products: 'productos',
  in_order: 'en pedido',
  btn_add: '+ Agregar',
  btn_order: 'Pedir',
  btn_added: 'Agregado ✓',
  no_results: 'No encontramos productos que coincidan con tu búsqueda.',
  no_favorites: 'Aún no tienes productos guardados en favoritos.',
  view_all_products: 'Ver todos los productos',
  media_details_aria_prefix: 'Ver detalles y fotos de',
  media_details_simple_prefix: 'Ver detalles de',
  fav_remove_prefix: 'Quitar de favoritos',
  fav_add_prefix: 'Guardar en favoritos',
  stepper_modify_prefix: 'Modificar cantidad de',
  stepper_minus_prefix: 'Quitar uno de',
  stepper_plus_prefix: 'Agregar otro',
  toast_order_success_prefix: '✓ Comanda enviada con éxito',
  item_unavailable: 'Este producto ya no está disponible.',

  // Variants & Details Modal
  modal_details: 'Detalles del producto',
  modal_price: 'Precio',
  modal_allergens: 'Información dietética y alérgenos',
  modal_variants: 'Personaliza tu preparación',
  modal_notes_label: 'Instrucciones especiales para el barista',
  modal_notes_ph: 'Ej: con hielo suave, servido bien caliente...',
  modal_add_to_cart: 'Agregar al pedido',
  modal_add_another: 'Agregar otro',
  modal_share: 'Compartir en WhatsApp',
  modal_close_aria: 'Cerrar modal',
  modal_prev_photo: 'Foto anterior',
  modal_next_photo: 'Foto siguiente',
  modal_thumb_aria_prefix: 'Ver foto',
  modal_opt_required: 'Requerido',
  modal_opt_optional: 'Opcional',
  modal_opt_max_prefix: 'Elige hasta',
  modal_opt_choose_one: 'Elige 1 opción',
  share_product_text_prefix: '¡Mira este café de Yarumo Coffee!',

  // Order Cart
  cart_title: 'Tu Pedido',
  cart_title_table: 'Tu Pedido en Mesa',
  cart_floating_aria_prefix: 'Ver pedido actual',
  cart_floating_products_suffix: 'productos',
  cart_floating_table_prefix: 'Mesa',
  cart_floating_delivery: 'Tu Domicilio',
  cart_floating_orders_suffix: 'comanda(s)',
  cart_dialog_table_aria: 'Resumen de tu pedido en mesa',
  cart_dialog_delivery_aria: 'Resumen de tu pedido a domicilio',
  cart_eyebrow_delivery: '🛵 Pedido a Domicilio',
  cart_close_aria: 'Cerrar pedido',
  cart_empty_title: 'Tu pedido está vacío',
  cart_empty_desc: 'Explora nuestra carta y agrega tus cafés y postres favoritos.',
  cart_empty_msg: 'No tienes productos en tu carrito.',
  cart_explore: 'Ver la carta',
  cart_table_label: 'Pedido para Mesa',
  cart_delivery_label: 'Pedido a Domicilio',
  cart_notes_label: 'Notas generales del pedido',
  cart_send_kitchen: 'Enviar comanda a barra',
  cart_send_whatsapp: 'Enviar pedido por WhatsApp',
  cart_sending: 'Enviando…',
  cart_total: 'Total',
  cart_total_to_send: 'Total a enviar',
  cart_total_products: 'Total productos',
  cart_delivery_not_included: '(Domicilio no incluido)',
  cart_clear: 'Vaciar carrito',
  cart_clear_confirm_title: '¿Vaciar carrito?',
  cart_clear_confirm_msg: '¿Estás seguro de que deseas eliminar todos los productos del pedido?',
  btn_cancel: 'Cancelar',
  cart_delete_confirm: '¿Eliminar este producto del pedido?',
  cart_each_suffix: 'c/u',
  cart_remove_btn: 'Quitar',
  cart_remove_aria_prefix: 'Eliminar del pedido',
  cart_qty_minus_prefix: 'Disminuir cantidad de',
  cart_qty_plus_prefix: 'Aumentar cantidad de',
  cart_item_note_ph: 'Nota para este producto (ej. sin azúcar, leche deslactosada)',
  cart_item_note_aria_prefix: 'Nota adicional para',
  cart_delivery_section_title: '📍 Datos de entrega para el domicilio:',
  cart_delivery_name_label: 'Tu nombre completo: *',
  cart_delivery_name_ph: 'Ej. Ana María Gómez',
  cart_delivery_address_label: 'Dirección de entrega (Apto / Casa / Barrio): *',
  cart_delivery_address_ph: 'Ej. Cra 14 # 9 Norte - 20, Apto 402, Barrio Los Profesionales',
  cart_delivery_phone_label: 'Teléfono / Celular de contacto: *',
  cart_delivery_phone_ph: 'Ej. 310 123 4567',
  cart_delivery_payment_label: 'Forma de pago: *',
  cart_payment_cash: 'Efectivo',
  cart_payment_transfer: 'Llave / Transferencia',
  cart_delivery_disclaimer:
    '🛵 Nota: El costo de domicilio no está incluido en este valor y te será confirmado por WhatsApp al validar la cobertura de tu dirección.',
  cart_notes_table_label: 'Notas o instrucciones para el equipo:',
  cart_notes_delivery_label: 'Instrucciones adicionales para la entrega / preparación:',
  cart_notes_table_ph: 'Ej. Servir bebidas primero, cubiertos adicionales...',
  cart_notes_delivery_ph: 'Ej. Dejar en portería, timbrar al llegar, llevar cambio de $50.000...',
  cart_history_title: 'Todo lo que has pedido',
  cart_history_consumption_prefix: 'Consumo:',
  cart_order_order_prefix: 'Comanda #',
  cart_order_waiter_tag: '(Mesero)',
  cart_order_subtotal_prefix: 'Subtotal:',
  cart_status_pending_label: '⏳ Enviado a barra',
  cart_status_acknowledged_label: '👀 Recibido',
  cart_status_preparing_label: '☕ En preparación',
  cart_status_delivered_label: '✓ Entregado',
  cart_status_cancelled_label: '✕ Cancelado',
  cart_btn_sending_kitchen: 'Enviando comanda…',
  cart_btn_send_table_prefix: 'Enviar comanda · Mesa',
  cart_btn_send_whatsapp_cta: '📲 Enviar pedido por WhatsApp →',
  cart_err_empty: 'Tu carrito está vacío.',
  cart_err_scan_qr: 'Debes escanear el QR asignado a tu mesa para enviar un pedido.',
  cart_err_wait_seconds: 'Por favor espera unos segundos antes de enviar otro pedido.',
  cart_err_generic: 'No se pudo enviar el pedido. Intenta nuevamente.',
  cart_err_connection: 'Error de conexión al enviar el pedido. Verifica tu conexión a internet.',
  cart_err_name_req: 'Por favor ingresa tu nombre para el domicilio.',
  cart_err_address_req: 'Por favor ingresa tu dirección de entrega.',
  cart_err_phone_req: 'Por favor ingresa tu número de teléfono o celular.',

  // CustomerOrderTracker
  tracker_aria: 'Seguimiento en vivo de tu pedido',
  tracker_live_order_prefix: 'Comanda en vivo #',
  tracker_hide_items: 'Ocultar productos ▲',
  tracker_show_items: 'Ver productos ▼',
  tracker_note_prefix: 'Nota:',
  tracker_active: 'Comanda en curso',
  tracker_status_pending: 'Recibido en barra',
  tracker_status_preparing: 'En preparación',
  tracker_status_delivered: 'Entregado en mesa',
  tracker_step_pending: 'Enviado a barra',
  tracker_step_pending_desc: 'Tu comanda está en fila',
  tracker_step_ack: 'Recibido',
  tracker_step_ack_desc: 'El barista confirmó tu pedido',
  tracker_step_prep: 'En preparación',
  tracker_step_prep_desc: 'Estamos preparando tus productos',
  tracker_step_deliv: 'Entregado en mesa',
  tracker_step_deliv_desc: '¡Buen provecho!',
  tracker_step_cancel: 'Comanda cancelada',
  tracker_step_cancel_desc: 'Consulta con el equipo',
  call_waiter: 'Llamar mesero',
  request_bill: 'Pedir la cuenta',
  request_sent: 'Solicitud enviada a barra',

  // Recommendations & Reviews
  rec_eyebrow: 'Comunidad Yarumo',
  rec_page_title: 'Voces de nuestra mesa',
  rec_page_desc:
    'Cada visita escribe un capítulo. Cuéntanos qué sentiste al probar nuestro café o explora las impresiones de otros amantes del café especial.',
  rec_recent_title_prefix: 'Opiniones recientes',
  rec_empty: 'Sé el primero en dejarnos tu opinión en esta mesa.',
  rec_table_prefix: 'Mesa',
  rec_stars_aria_suffix: 'de 5 estrellas',
  rec_form_title: 'Déjanos tu opinión',
  rec_form_desc:
    'Tu experiencia nos ayuda a mejorar y a que otros descubran la magia del café especial.',
  rec_name_label: 'Tu nombre *',
  rec_name_ph: 'Ej: Laura Gómez',
  rec_rating_label: 'Calificación *',
  rec_rating_aria: 'Calificación en estrellas',
  rec_stars_suffix: 'estrellas',
  rec_table_label: 'Número de mesa (opcional)',
  rec_table_ph: 'Ej: 3',
  rec_comment_label: 'Tu comentario *',
  rec_comment_ph: '¿Qué te pareció el café, la atención y el espacio?',
  rec_submit_btn: 'Publicar recomendación',
  rec_submitting: 'Enviando...',
  rec_success_msg:
    '¡Muchas gracias por tu recomendación! Tu opinión ha sido recibida y se publicará pronto.',
  rec_bot_success_msg:
    '¡Muchas gracias por tu recomendación! Tu opinión ha sido recibida.',
  rec_err_generic: 'Ocurrió un error al enviar tu recomendación.',
  rec_err_connection: 'No se pudo conectar con el servidor. Por favor intenta de nuevo.',

  // Not Found & Error
  not_found_title: 'No encontramos esta página',
  not_found_desc:
    'El enlace que seguiste no existe o se movió. Vuelve al menú para seguir explorando.',
  not_found_btn: 'Volver al menú',
  error_title: 'Algo salió mal',
  error_desc: 'No pudimos cargar Yarumo en este momento. Intenta de nuevo en unos segundos.',
  error_btn: 'Intentar de nuevo',
} as const

export type TranslationKey = keyof typeof esTranslations

const enTranslations: Record<TranslationKey, string> = {
  // Header & Nav
  nav_home: 'Home',
  nav_menu: 'Digital Menu',
  nav_opinions: 'Reviews',
  nav_visit: 'Visit us',
  nav_aria_main: 'Main navigation',
  table_badge: 'Table',
  table_badge_title: 'Table linked via QR code',
  table_badge_active: 'Active',
  table_label_prefix: 'Table',
  takeaway: 'Takeaway / Counter',
  lang_switch: 'Español',
  skip_link: 'Skip to menu',
  instagram_aria: 'Open Yarumo Coffee Instagram profile',

  // Hero
  hero_eyebrow: 'Armenia · Quindío · Colombia',
  hero_title_1: 'Where every cup',
  hero_title_2: 'tells a story.',
  hero_desc:
    'Specialty coffee harvested in the mountains of Quindío, roasted with craft and served with warmth at your table.',
  hero_cta: 'Explore digital menu ↓',
  hero_badge: '☕ Table service & deliveries',
  hero_origin_title: 'Single Origin Coffee',
  hero_origin_sub: 'Armenia, Quindío',
  hero_welcome_aria: 'Welcome to Yarumo Coffee',
  hero_photo_aria: 'Yarumo coffee served at table',
  hero_photo_alt: 'Cup of specialty coffee served at Yarumo Coffee table',

  // Footer
  footer_tagline: 'Yarumo Coffee · Where every cup tells a story.',
  footer_nav_aria: 'Footer links',
  footer_leave_review: 'Leave a review',
  footer_google_reviews: 'Google Reviews ↗',
  footer_google_aria: 'Open Yarumo Coffee Google reviews',
  footer_instagram_aria: 'Open Yarumo Coffee Instagram',

  // VisitStrip
  visit_aria: 'Location and hours',
  visit_eyebrow: 'Come see us',
  visit_title_1: 'Your table',
  visit_title_2: 'awaits you.',
  visit_address_line1: 'Carrera 19 # 21 Norte-01 Local 1',
  visit_address_line2: 'Armenia, Quindío, Colombia',
  visit_maps_cta: 'Open in Google Maps ↗',
  visit_maps_aria: 'Open Yarumo Coffee location in Google Maps',

  // TableServiceSection
  service_checking_aria: 'Checking table',
  service_qr_invalid_title: '⚠️ QR code not found or expired',
  service_qr_invalid_heading: 'Counter Service or Takeaway',
  service_qr_invalid_desc:
    'The scanned code is not linked to an active table right now. You can browse the menu to order at the counter, request delivery, or ask our staff.',
  service_continue_counter: 'Continue at counter / Takeaway',
  service_aria: 'Table service',
  service_notice_aria: 'Table notice',
  service_eyebrow_table_prefix: 'Personalized service · Table',
  service_eyebrow_delivery: 'Table service and delivery',
  service_heading_table_suffix: 'connected',
  service_heading_general: 'Order to your table or for delivery',
  service_desc_table:
    'You can call the server, request the bill, or add items directly to your order.',
  service_desc_general:
    'If you are at the cafe, scan the QR code on your table to link your order.',
  service_call_waiter: 'Call server',
  service_calling_waiter: 'Calling...',
  service_call_waiter_aria: 'Call server to table',
  service_request_bill: 'Request bill',
  service_requesting_bill: 'Requesting...',
  service_request_bill_aria: 'Request bill for table',
  service_explore_menu: 'Explore menu',
  toast_qr_expired: 'This QR code is not active or has expired. Please ask our team for assistance.',
  toast_scan_qr_prompt: 'Scan your table QR code to call the server or request the bill.',
  toast_service_error: 'Could not send request. Please try again.',
  toast_waiter_sent: '🛎️ Request sent: your server is on their way.',
  toast_bill_sent: '🧾 Request sent: the bill has been requested for your table.',

  // Catalog
  catalog_eyebrow: 'House selection',
  catalog_title: 'Our Menu',
  catalog_aria: 'Digital product menu',
  tab_all: 'All',
  tab_favorites: 'Favorites',
  search_placeholder: 'Search coffee, pastries, drinks...',
  search_aria: 'Search menu products',
  clear_search: 'Clear search',
  showing_items: 'Showing',
  of_items: 'of',
  products: 'items',
  in_order: 'in order',
  btn_add: '+ Add',
  btn_order: 'Order',
  btn_added: 'Added ✓',
  no_results: 'No products found matching your search.',
  no_favorites: 'You have not saved any favorites yet.',
  view_all_products: 'View all products',
  media_details_aria_prefix: 'View details and photos of',
  media_details_simple_prefix: 'View details of',
  fav_remove_prefix: 'Remove from favorites',
  fav_add_prefix: 'Save to favorites',
  stepper_modify_prefix: 'Change quantity of',
  stepper_minus_prefix: 'Remove one of',
  stepper_plus_prefix: 'Add another',
  toast_order_success_prefix: '✓ Order sent successfully',
  item_unavailable: 'This product is no longer available.',

  // Variants & Details Modal
  modal_details: 'Product details',
  modal_price: 'Price',
  modal_allergens: 'Dietary & allergen information',
  modal_variants: 'Customize your drink',
  modal_notes_label: 'Special barista notes',
  modal_notes_ph: 'E.g., extra hot, light ice...',
  modal_add_to_cart: 'Add to order',
  modal_add_another: 'Add another',
  modal_share: 'Share on WhatsApp',
  modal_close_aria: 'Close modal',
  modal_prev_photo: 'Previous photo',
  modal_next_photo: 'Next photo',
  modal_thumb_aria_prefix: 'View photo',
  modal_opt_required: 'Required',
  modal_opt_optional: 'Optional',
  modal_opt_max_prefix: 'Choose up to',
  modal_opt_choose_one: 'Choose 1 option',
  share_product_text_prefix: 'Check out this specialty coffee from Yarumo Coffee!',

  // Order Cart
  cart_title: 'Your Order',
  cart_title_table: 'Your Table Order',
  cart_floating_aria_prefix: 'View current order',
  cart_floating_products_suffix: 'items',
  cart_floating_table_prefix: 'Table',
  cart_floating_delivery: 'Your Delivery',
  cart_floating_orders_suffix: 'order(s)',
  cart_dialog_table_aria: 'Summary of your table order',
  cart_dialog_delivery_aria: 'Summary of your delivery order',
  cart_eyebrow_delivery: '🛵 Delivery Order',
  cart_close_aria: 'Close order',
  cart_empty_title: 'Your cart is empty',
  cart_empty_desc: 'Browse our menu and pick your favorite coffees and treats.',
  cart_empty_msg: 'Your cart is empty.',
  cart_explore: 'Browse menu',
  cart_table_label: 'Order for Table',
  cart_delivery_label: 'Delivery Order',
  cart_notes_label: 'General order notes',
  cart_send_kitchen: 'Send order to bar',
  cart_send_whatsapp: 'Order via WhatsApp',
  cart_sending: 'Sending…',
  cart_total: 'Total',
  cart_total_to_send: 'Total to send',
  cart_total_products: 'Total items',
  cart_delivery_not_included: '(Delivery not included)',
  cart_clear: 'Clear cart',
  cart_clear_confirm_title: 'Clear cart?',
  cart_clear_confirm_msg: 'Are you sure you want to remove all items from your order?',
  btn_cancel: 'Cancel',
  cart_delete_confirm: 'Remove this item from your order?',
  cart_each_suffix: 'each',
  cart_remove_btn: 'Remove',
  cart_remove_aria_prefix: 'Remove from order',
  cart_qty_minus_prefix: 'Decrease quantity of',
  cart_qty_plus_prefix: 'Increase quantity of',
  cart_item_note_ph: 'Note for this item (e.g. no sugar, oat milk)',
  cart_item_note_aria_prefix: 'Additional note for',
  cart_delivery_section_title: '📍 Delivery details:',
  cart_delivery_name_label: 'Your full name: *',
  cart_delivery_name_ph: 'E.g. Jane Doe',
  cart_delivery_address_label: 'Delivery address (Apt / House / Neighborhood): *',
  cart_delivery_address_ph: 'E.g. 123 Main St, Apt 4B',
  cart_delivery_phone_label: 'Contact phone number: *',
  cart_delivery_phone_ph: 'E.g. +1 555 123 4567',
  cart_delivery_payment_label: 'Payment method: *',
  cart_payment_cash: 'Cash',
  cart_payment_transfer: 'Bank Transfer / QR',
  cart_delivery_disclaimer:
    '🛵 Note: Delivery fee is not included in this total and will be confirmed via WhatsApp based on your location.',
  cart_notes_table_label: 'Notes or instructions for the team:',
  cart_notes_delivery_label: 'Additional instructions for delivery / preparation:',
  cart_notes_table_ph: 'E.g. Serve drinks first, extra napkins...',
  cart_notes_delivery_ph: 'E.g. Leave at front desk, ring doorbell...',
  cart_history_title: 'Everything you have ordered',
  cart_history_consumption_prefix: 'Total spent:',
  cart_order_order_prefix: 'Order #',
  cart_order_waiter_tag: '(Server)',
  cart_order_subtotal_prefix: 'Subtotal:',
  cart_status_pending_label: '⏳ Sent to counter',
  cart_status_acknowledged_label: '👀 Received',
  cart_status_preparing_label: '☕ Preparing',
  cart_status_delivered_label: '✓ Delivered',
  cart_status_cancelled_label: '✕ Cancelled',
  cart_btn_sending_kitchen: 'Sending order…',
  cart_btn_send_table_prefix: 'Send order · Table',
  cart_btn_send_whatsapp_cta: '📲 Send order via WhatsApp →',
  cart_err_empty: 'Your cart is empty.',
  cart_err_scan_qr: 'You must scan your table QR code to place an order.',
  cart_err_wait_seconds: 'Please wait a few seconds before placing another order.',
  cart_err_generic: 'Could not send order. Please try again.',
  cart_err_connection: 'Connection error. Please check your internet connection.',
  cart_err_name_req: 'Please enter your name for delivery.',
  cart_err_address_req: 'Please enter your delivery address.',
  cart_err_phone_req: 'Please enter your phone number.',

  // CustomerOrderTracker
  tracker_aria: 'Live tracking of your order',
  tracker_live_order_prefix: 'Live order #',
  tracker_hide_items: 'Hide items ▲',
  tracker_show_items: 'View items ▼',
  tracker_note_prefix: 'Note:',
  tracker_active: 'Active order',
  tracker_status_pending: 'Received at counter',
  tracker_status_preparing: 'Preparing',
  tracker_status_delivered: 'Delivered to table',
  tracker_step_pending: 'Sent to counter',
  tracker_step_pending_desc: 'Your order is in queue',
  tracker_step_ack: 'Received',
  tracker_step_ack_desc: 'The barista confirmed your order',
  tracker_step_prep: 'Preparing',
  tracker_step_prep_desc: 'We are preparing your items',
  tracker_step_deliv: 'Delivered to table',
  tracker_step_deliv_desc: 'Enjoy your order!',
  tracker_step_cancel: 'Order cancelled',
  tracker_step_cancel_desc: 'Please check with our team',
  call_waiter: 'Call server',
  request_bill: 'Request bill',
  request_sent: 'Request sent to counter',

  // Recommendations & Reviews
  rec_eyebrow: 'Yarumo Community',
  rec_page_title: 'Voices from our tables',
  rec_page_desc:
    'Every visit writes a story. Tell us about your coffee experience or read reviews from other coffee lovers.',
  rec_recent_title_prefix: 'Recent reviews',
  rec_empty: 'Be the first to leave a review at this table.',
  rec_table_prefix: 'Table',
  rec_stars_aria_suffix: 'out of 5 stars',
  rec_form_title: 'Share your review',
  rec_form_desc:
    'Your experience helps us improve and helps others discover specialty coffee.',
  rec_name_label: 'Your name *',
  rec_name_ph: 'E.g. Laura Gomez',
  rec_rating_label: 'Rating *',
  rec_rating_aria: 'Star rating',
  rec_stars_suffix: 'stars',
  rec_table_label: 'Table number (optional)',
  rec_table_ph: 'E.g. 3',
  rec_comment_label: 'Your review *',
  rec_comment_ph: 'How was the coffee, service and space?',
  rec_submit_btn: 'Post review',
  rec_submitting: 'Submitting...',
  rec_success_msg:
    'Thank you very much for your review! It has been received and will be published soon.',
  rec_bot_success_msg:
    'Thank you very much for your review! Your opinion has been received.',
  rec_err_generic: 'An error occurred while submitting your review.',
  rec_err_connection: 'Could not connect to the server. Please try again.',

  // Not Found & Error
  not_found_title: 'Page not found',
  not_found_desc:
    'The link does not exist or was moved. Go back to the menu to keep exploring.',
  not_found_btn: 'Back to menu',
  error_title: 'Something went wrong',
  error_desc: 'Could not load Yarumo right now. Please try again in a few seconds.',
  error_btn: 'Try again',
} satisfies Record<TranslationKey, string>

export const translations = {
  es: esTranslations,
  en: enTranslations,
}

type I18nContextType = {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextType>({
  language: 'es',
  setLanguage: () => {},
  t: (key) => esTranslations[key] || key,
})

const langListeners = new Set<() => void>()

function subscribeLang(callback: () => void) {
  langListeners.add(callback)
  const onStorage = (e: StorageEvent) => {
    if (e.key === 'yarumo-lang') {
      callback()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    langListeners.delete(callback)
    window.removeEventListener('storage', onStorage)
  }
}

function getLangSnapshot(): Language {
  if (typeof window === 'undefined') return 'es'
  try {
    const stored = localStorage.getItem('yarumo-lang')
    if (stored === 'es' || stored === 'en') return stored
  } catch {}
  return 'es'
}

function getLangServerSnapshot(): Language {
  return 'es'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = language
    }
  }, [language])

  const setLanguage = (lang: Language) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('yarumo-lang', lang)
        document.documentElement.lang = lang
      } catch {}
    }
    langListeners.forEach((listener) => listener())
  }

  const t = useMemo(() => {
    return (key: TranslationKey): string => {
      return translations[language][key] || translations.es[key] || key
    }
  }, [language])

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

/**
 * Componente cliente liviano para traducir textos en Server Components
 * sin convertir el árbol completo a cliente (preserva LCP del Hero y streaming).
 */
export function T({ k }: { k: TranslationKey }) {
  const { t } = useI18n()
  return <>{t(k)}</>
}
