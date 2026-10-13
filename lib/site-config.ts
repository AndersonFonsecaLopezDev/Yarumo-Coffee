import { GOOGLE_REVIEWS_URL } from '@/lib/site-url'

export const SITE_CONFIG = {
  name: 'Yarumo Coffee',
  phone: {
    display: '+57 319 220 8938',
    e164: '+573192208938',
    whatsapp: '573192208938',
  },
  address: {
    street: 'Carrera 19 # 21 Norte-01 Local 1',
    city: 'Armenia',
    region: 'Quindío',
    country: 'CO',
    formatted: 'Carrera 19 # 21 Norte-01 Local 1, Armenia, Quindío',
  },
  coordinates: {
    latitude: 4.5429,
    longitude: -75.6668,
  },
  schedule: {
    weekdays: {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '08:00',
      closes: '20:00',
      text: 'Lunes a Sábado · 8:00 a.m. – 8:00 p.m.',
    },
    sunday: {
      days: ['Sunday'],
      opens: '09:00',
      closes: '19:00',
      text: 'Domingos y Festivos · 9:00 a.m. – 7:00 p.m.',
    },
  },
  social: {
    instagram: 'https://www.instagram.com/yarumocafearmenia/',
    googleMaps: 'https://maps.app.goo.gl/yr8DTNsgNKm6NQb6A?g_st=iw',
    googleReviews: GOOGLE_REVIEWS_URL,
  },
  cuisine: ['Café de especialidad', 'Repostería artesanal', 'Bebidas calientes y frías'],
  priceRange: '$$',
} as const
