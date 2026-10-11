// Notificaciones de sonido y vibración sintéticas para panel de staff (Web Audio API)
// Sin dependencias externas de archivos mp3, sin latencia de red, 100% resiliente.

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return null
    if (!audioCtx) {
      audioCtx = new AudioContextClass()
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume()
    }
    return audioCtx
  } catch {
    return null
  }
}

/**
 * Campanada armónica de dos tonos (D5 -> A5) para nuevo pedido registrado
 */
export function playOrderChime() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    // Tono 1 (D5: 587.33 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now)
    gain1.gain.setValueAtTime(0, now)
    gain1.gain.linearRampToValueAtTime(0.25, now + 0.02)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.5)

    // Tono 2 (A5: 880 Hz)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880, now + 0.15)
    gain2.gain.setValueAtTime(0, now + 0.15)
    gain2.gain.linearRampToValueAtTime(0.28, now + 0.17)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.15)
    osc2.stop(now + 0.75)

    // Vibración en dispositivos compatibles
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([150, 80, 200])
    }
  } catch (err) {
    console.debug('No se pudo emitir sonido de pedido:', err)
  }
}

/**
 * Ding nítido y brillante (E5) para llamado de mesero o cuenta
 */
export function playWaiterChime() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(659.25, now)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.3, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.6)

    // Vibración en dispositivos compatibles
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([250])
    }
  } catch (err) {
    console.debug('No se pudo emitir sonido de mesero:', err)
  }
}
