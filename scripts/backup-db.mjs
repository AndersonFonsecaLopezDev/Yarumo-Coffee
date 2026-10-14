#!/usr/bin/env node
/**
 * Script de Copia de Seguridad Local para Yarumo Coffee
 * Archivo: scripts/backup-db.mjs
 *
 * Uso: npm run db:backup
 *
 * Genera un volcado SQL comprimido (.sql.gz) de la base de datos de Supabase
 * en la carpeta local `backups/` (ignorada por Git).
 */

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

// 1. Cargar variables de entorno desde .env.local o .env si existen
function loadEnv() {
  const envFiles = ['.env.local', '.env']
  const env = { ...process.env }

  for (const file of envFiles) {
    const fullPath = path.join(projectRoot, file)
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim()
          let val = trimmed.slice(eqIdx + 1).trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          if (!env[key]) {
            env[key] = val
          }
        }
      }
    }
  }

  // Inferir SUPABASE_PROJECT_ID desde NEXT_PUBLIC_SUPABASE_URL si no está explícito
  if (!env.SUPABASE_PROJECT_ID && env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const u = new URL(env.NEXT_PUBLIC_SUPABASE_URL)
      const hostParts = u.hostname.split('.')
      if (hostParts.length >= 3 && hostParts[1] === 'supabase') {
        env.SUPABASE_PROJECT_ID = hostParts[0]
      }
    } catch {}
  }

  return env
}

const env = loadEnv()

// 2. Crear directorio de backups si no existe
const backupDir = path.join(projectRoot, 'backups')
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true })
}

// 3. Generar nombre de archivo con timestamp colombiano (UTC-5)
const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
const baseFilename = `yarumo_db_${timestamp}`
const sqlPath = path.join(backupDir, `${baseFilename}.sql`)
const gzPath = path.join(backupDir, `${baseFilename}.sql.gz`)

console.log('\n=============================================================')
console.log('📦 Yarumo Coffee · Generador de Copia de Seguridad de BD')
console.log('=============================================================')
console.log(`Fecha: ${now.toLocaleString('es-CO')}`)
console.log(`Destino: backups/${baseFilename}.sql.gz`)

const projectId = env.SUPABASE_PROJECT_ID
const dbPassword = env.SUPABASE_DB_PASSWORD
const databaseUrl = env.DATABASE_URL || env.POSTGRES_URL

let backupSuccess = false

// Estrategia A: Supabase CLI (si hay project-id)
if (projectId) {
  console.log(`\n▶ Intentando respaldo con Supabase CLI (Proyecto: ${projectId})...`)

  // Intentar ejecutar npx supabase db dump
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const dumpArgs = ['supabase', 'db', 'dump', '--project-ref', projectId, '-f', sqlPath]

  if (dbPassword) {
    dumpArgs.push('--password', dbPassword)
  }

  const res = spawnSync(npxCmd, dumpArgs, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })

  if (res.status === 0 && fs.existsSync(sqlPath) && fs.statSync(sqlPath).size > 0) {
    backupSuccess = true
  } else {
    console.warn('⚠️ Supabase CLI no pudo completar el volcado directo. Probando alternativas...')
  }
}

// Estrategia B: pg_dump directo si existe DATABASE_URL
if (!backupSuccess && databaseUrl) {
  console.log('\n▶ Intentando respaldo mediante pg_dump con DATABASE_URL...')
  const pgDumpCmd = 'pg_dump'
  try {
    const res = spawnSync(pgDumpCmd, ['--clean', '--if-exists', '-f', sqlPath, databaseUrl], {
      cwd: projectRoot,
      stdio: 'inherit',
    })
    if (res.status === 0 && fs.existsSync(sqlPath) && fs.statSync(sqlPath).size > 0) {
      backupSuccess = true
    }
  } catch (err) {
    console.warn('⚠️ pg_dump no está disponible en el PATH del sistema.')
  }
}

// Si no se pudo generar con CLI local:
if (!backupSuccess) {
  console.error('\n❌ No se pudo generar el respaldo automáticamente.')
  console.log('\n💡 Instrucciones para habilitarlo localmente:')
  console.log('   1. Agrega en tu archivo .env.local:')
  console.log('      SUPABASE_PROJECT_ID=tu-id-de-proyecto')
  console.log('      SUPABASE_DB_PASSWORD=tu-contraseña-de-base-de-datos')
  console.log('   2. O ejecuta primero: npx supabase login')
  console.log('   3. Recuerda que la copia automática en GitHub Actions funciona')
  console.log('      sin configuración adicional porque usa los secretos del repositorio.\n')
  process.exit(1)
}

// 4. Comprimir archivo SQL con gzip nativo
console.log('\n🗜️  Comprimiendo archivo SQL con gzip...')
try {
  const fileContent = fs.readFileSync(sqlPath)
  const compressed = zlib.gzipSync(fileContent, { level: 9 })
  fs.writeFileSync(gzPath, compressed)

  const rawSizeKb = (fileContent.length / 1024).toFixed(1)
  const gzSizeKb = (compressed.length / 1024).toFixed(1)

  // Eliminar el archivo .sql sin comprimir para ahorrar espacio
  fs.unlinkSync(sqlPath)

  console.log('\n✅ ¡Copia de seguridad completada con éxito!')
  console.log(`   📄 Archivo: backups/${baseFilename}.sql.gz`)
  console.log(`   📊 Tamaño original: ${rawSizeKb} KB  -->  Comprimido: ${gzSizeKb} KB`)
  console.log('\nℹ️  Para restaurar este respaldo en caso de emergencia:')
  console.log(`   1. Descomprime: gzip -d backups/${baseFilename}.sql.gz`)
  console.log(`   2. Restaura: psql "<DATABASE_URL>" < backups/${baseFilename}.sql\n`)
} catch (err) {
  console.error('❌ Error al comprimir el archivo:', err.message)
  process.exit(1)
}
