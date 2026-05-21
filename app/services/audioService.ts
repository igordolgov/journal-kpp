// services/audioService.ts
// Единый сервис для управления звуками (AudioContext, пулы, громкость).
// Заменяет собой composable useAudioEngine.

type AudioPoolItem = {
  nodes: any | null      // узлы AudioNode для текущего воспроизведения
  state: 'idle' | 'playing'
  type: string           // тип звука (engine, step, brake, horn, ...)
}

class AudioService {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private pools = new Map<string, AudioPoolItem[]>()
  private engineFreq = new Map<string, number>()   // текущая частота двигателя

  // Конфигурация всех звуков (скопирована из useAudioEngine)
  private readonly CFG = {
    step: { duration: 0.05, baseFreq: 800, freqRange: 200, qFactor: 3 },
    engine: {
      startFreq: 45,
      maxFreq: 130,
      pitchTimeConstant: 0.6,
      volumeTimeConstant: 0.8,
    },
    brake: { duration: 0.25, volume: 0.4, freq: 1200, freqEnd: 400 },
    horn: { /* не используется, гудок генерируется отдельно */ },
    gate_motor: {
      maxVolume: 0.12,
      rumbleFreq: 980,
      rumbleQ: 27,
      oscFreq1: 70,
      oscFreq2: 100,
      oscVolume: 0.2,
    },
    wicket_open: { duration: 0.08, filterFreq: 5000, maxVolume: 4.0 },
    wicket_slam: { duration: 0.4, bodyFreq: 100, ringFreq: 1800, maxVolume: 3.5 },
    wicket_lock: { duration: 0.05, clickFreq: 3000, volume: 0.9 },
    roadNoise: { maxVolume: 0.15, filterFreq: 1800 },
  }

  constructor() {
    if (process.client) {
      this.init()
    }
  }

  // --------------------------------------------------------------------------
  // Приватные методы
  // --------------------------------------------------------------------------

  /** Получить или создать AudioContext */
  private ensureCtx(): AudioContext | null {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.connect(this.ctx.destination)
      this.masterGain.gain.value = 0.6
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }

  /** Освободить все узлы звука */
  private cleanupNodes(nodes: any) {
    if (!nodes) return
    if (nodes.osc) {
      if (Array.isArray(nodes.osc)) nodes.osc.forEach((o: OscillatorNode) => o.stop())
      else nodes.osc.stop()
    }
    if (nodes.noise) try { nodes.noise.stop() } catch (e) {}
    if (nodes.rumble) try { nodes.rumble.stop() } catch (e) {}
    if (nodes.source) try { nodes.source.stop() } catch (e) {}
    if (nodes.gain) try { nodes.gain.disconnect() } catch (e) {}
    if (nodes.filter) try { nodes.filter.disconnect() } catch (e) {}
    if (nodes.noiseGain) try { nodes.noiseGain.disconnect() } catch (e) {}
    if (nodes.noiseFilter) try { nodes.noiseFilter.disconnect() } catch (e) {}
    if (nodes.rumbleGain) try { nodes.rumbleGain.disconnect() } catch (e) {}
    if (nodes.rumbleFilter) try { nodes.rumbleFilter.disconnect() } catch (e) {}
    if (nodes.oscGain) try { nodes.oscGain.disconnect() } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // Публичные методы – управление пулами и звуками
  // --------------------------------------------------------------------------

  /** Инициализация (вызывается автоматически) */
  init() {
    this.ensureCtx()
  }

  /** Создать пул звуков (несколько экземпляров для одновременного воспроизведения) */
  createPool(poolId: string, type: string, size: number = 5) {
    if (this.pools.has(poolId)) return
    const pool: AudioPoolItem[] = []
    for (let i = 0; i < size; i++) {
      pool.push({ nodes: null, state: 'idle', type })
    }
    this.pools.set(poolId, pool)
  }

  /** Воспроизвести звук из пула */
  playFromPool(poolId: string, type: string, volume: number = 0.5, variation?: number) {
    const pool = this.pools.get(poolId)
    if (!pool) return
    const ctx = this.ensureCtx()
    if (!ctx) return

    const idleNode = pool.find(n => n.state === 'idle')
    if (!idleNode) return

    const nodes: any = {}

    // ----- 1. UI звук (короткий щелчок) -----
    if (type === 'ui') {
      const bufferSize = Math.floor(ctx.sampleRate * 0.04)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
      }
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const filter = ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 2000
      filter.Q.value = 1.5
      const gain = ctx.createGain()
      source.connect(filter).connect(gain).connect(this.masterGain!)
      gain.gain.value = volume
      source.start()
      setTimeout(() => {
        idleNode.state = 'idle'
      }, 60)
    }

    // ----- 2. Шаги (шаги человека) -----
    else if (type === 'step') {
      const duration = this.CFG.step.duration
      const bufferSize = Math.floor(ctx.sampleRate * duration)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3)
      }
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value =
        this.CFG.step.baseFreq + (variation || 0.5) * this.CFG.step.freqRange
      filter.Q.value = this.CFG.step.qFactor
      const gain = ctx.createGain()
      source.connect(filter).connect(gain).connect(this.masterGain!)
      gain.gain.value = volume
      source.start()
      setTimeout(() => {
        idleNode.state = 'idle'
      }, duration * 1000 + 50)
    }

    // ----- 3. Шум шин (зацикленный) -----
    else if (type === 'tyre-noise') {
      const alreadyPlaying = pool.find(n => n.state === 'playing')
      if (alreadyPlaying) return

      const duration = 0.5
      const bufferSize = Math.floor(ctx.sampleRate * duration)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      let pink = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        pink = 0.95 * pink + 0.05 * white
        data[i] = pink
      }
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true

      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 800
      filter.Q.value = 2

      const gain = ctx.createGain()
      gain.gain.value = 0.001

      source.connect(filter).connect(gain).connect(this.masterGain!)
      source.start()

      nodes.source = source
      nodes.filter = filter
      nodes.gain = gain

      idleNode.nodes = nodes
      idleNode.state = 'playing'
      idleNode.type = type
      return
    }

    // ----- 4. Звук двигателя (зацикленный) -----
    else if (type === 'engine') {
      const alreadyPlaying = pool.find(n => n.state === 'playing')
      if (alreadyPlaying) return

      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = this.CFG.engine.startFreq

      // Шум двигателя (pink noise)
      const noiseSize = ctx.sampleRate * 2
      const noiseBuffer = ctx.createBuffer(1, noiseSize, ctx.sampleRate)
      const noiseData = noiseBuffer.getChannelData(0)
      let pink = 0
      for (let i = 0; i < noiseSize; i++) {
        const white = Math.random() * 2 - 1
        pink = 0.95 * pink + 0.05 * white
        noiseData[i] = pink
      }
      const noise = ctx.createBufferSource()
      noise.buffer = noiseBuffer
      noise.loop = true
      const noiseFilter = ctx.createBiquadFilter()
      noiseFilter.type = 'lowpass'
      noiseFilter.frequency.value = 100
      noiseFilter.Q.value = 2
      const noiseGain = ctx.createGain()
      noiseGain.gain.value = 0.04

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 250
      filter.Q.value = 1.5

      const gain = ctx.createGain()
      gain.gain.value = 0.001

      osc.connect(filter)
      noise.connect(noiseFilter).connect(noiseGain).connect(filter)
      filter.connect(gain).connect(this.masterGain!)
      osc.start()
      noise.start()

      nodes.osc = osc
      nodes.noise = noise
      nodes.noiseFilter = noiseFilter
      nodes.noiseGain = noiseGain
      nodes.filter = filter
      nodes.gain = gain

      idleNode.nodes = nodes
      idleNode.state = 'playing'
      idleNode.type = type
      return
    }

    // ----- 5. Дорожный шум (фон, зацикленный) -----
    else if (type === 'road-noise') {
      const alreadyPlaying = pool.find(n => n.state === 'playing')
      if (alreadyPlaying) return

      const duration = 2.0
      const bufferSize = Math.floor(ctx.sampleRate * duration)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      let pink = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        pink = 0.95 * pink + 0.05 * white
        data[i] = pink
      }
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = this.CFG.roadNoise.filterFreq
      filter.Q.value = 1

      const gain = ctx.createGain()
      gain.gain.value = 0.001

      source.connect(filter).connect(gain).connect(this.masterGain!)
      source.start()

      nodes.source = source
      nodes.filter = filter
      nodes.gain = gain

      idleNode.nodes = nodes
      idleNode.state = 'playing'
      idleNode.type = type
      return
    }

    // ----- 6. Тормоза -----
    else if (type === 'brake') {
      const now = ctx.currentTime
      const duration = this.CFG.brake.duration
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(this.CFG.brake.freq, now)
      osc.frequency.exponentialRampToValueAtTime(this.CFG.brake.freqEnd, now + duration)
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 2000
      filter.Q.value = 5
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.linearRampToValueAtTime(volume * this.CFG.brake.volume, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
      osc.connect(filter).connect(gain).connect(this.masterGain!)
      osc.start()
      osc.stop(now + duration)
      setTimeout(() => {
        idleNode.state = 'idle'
      }, duration * 1000 + 100)
      return
    }

    // ----- 7. Гудок (два коротких сигнала) -----
    else if (type === 'horn') {
      const now = ctx.currentTime
      const duration = 1.5
      const pause = 0.0
      const volumeFactor = 0.4

      const playBeep = (startTime: number) => {
        const osc1 = ctx.createOscillator()
        osc1.type = 'square'
        osc1.frequency.value = 350
        const osc2 = ctx.createOscillator()
        osc2.type = 'square'
        osc2.frequency.value = 440
        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 400
        filter.Q.value = 1.5
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0.001, startTime)
        gain.gain.linearRampToValueAtTime(volume * volumeFactor, startTime + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
        osc1.connect(filter)
        osc2.connect(filter)
        filter.connect(gain).connect(this.masterGain!)
        osc1.start(startTime)
        osc2.start(startTime)
        osc1.stop(startTime + duration)
        osc2.stop(startTime + duration)
      }

      playBeep(now)
      playBeep(now + duration + pause)

      setTimeout(() => {
        idleNode.state = 'idle'
      }, (duration * 2 + pause + 0.1) * 1000)
      return
    }

    // ----- 8. Мотор ворот (зацикленный, останавливается через 3 секунды) -----
    else if (type === 'gate-motor') {
      // Останавливаем предыдущий экземпляр, если есть
      const currentlyPlaying = pool.find(n => n.state === 'playing')
      if (currentlyPlaying?.nodes) {
        this.cleanupNodes(currentlyPlaying.nodes)
        currentlyPlaying.nodes = null
        currentlyPlaying.state = 'idle'
      }

      const rumbleSize = ctx.sampleRate * 2
      const rumbleBuffer = ctx.createBuffer(1, rumbleSize, ctx.sampleRate)
      const rumbleData = rumbleBuffer.getChannelData(0)
      for (let i = 0; i < rumbleSize; i++) {
        rumbleData[i] = Math.random() * 0.2 - 0.1
      }
      const rumble = ctx.createBufferSource()
      rumble.buffer = rumbleBuffer
      rumble.loop = true
      const rumbleFilter = ctx.createBiquadFilter()
      rumbleFilter.type = 'bandpass'
      rumbleFilter.frequency.value = this.CFG.gate_motor.rumbleFreq
      rumbleFilter.Q.value = this.CFG.gate_motor.rumbleQ
      const rumbleGain = ctx.createGain()
      rumbleGain.gain.value = 1.2

      const osc1 = ctx.createOscillator()
      osc1.type = 'sawtooth'
      osc1.frequency.value = this.CFG.gate_motor.oscFreq1
      const osc2 = ctx.createOscillator()
      osc2.type = 'square'
      osc2.frequency.value = this.CFG.gate_motor.oscFreq2
      const oscGain = ctx.createGain()
      oscGain.gain.value = this.CFG.gate_motor.oscVolume

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.001, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(this.CFG.gate_motor.maxVolume, ctx.currentTime + 0.1)

      rumble.connect(rumbleFilter).connect(rumbleGain).connect(gain)
      osc1.connect(oscGain)
      osc2.connect(oscGain)
      oscGain.connect(gain)
      gain.connect(this.masterGain!)

      rumble.start()
      osc1.start()
      osc2.start()

      nodes.rumble = rumble
      nodes.rumbleFilter = rumbleFilter
      nodes.rumbleGain = rumbleGain
      nodes.osc = [osc1, osc2]
      nodes.oscGain = oscGain
      nodes.gain = gain

      idleNode.nodes = nodes
      idleNode.state = 'playing'
      idleNode.type = type

      // Принудительная остановка через 3 секунды (защита от зависания)
      setTimeout(() => {
        const currentItem = pool.find(item => item === idleNode)
        if (currentItem && currentItem.state === 'playing') {
          this.cleanupNodes(currentItem.nodes)
          currentItem.nodes = null
          currentItem.state = 'idle'
        }
      }, 3000)
      return
    }

    // ----- 9. Открытие калитки (короткий высокочастотный шум) -----
    else if (type === 'wicket-open') {
      const duration = this.CFG.wicket_open.duration
      const bufferSize = Math.floor(ctx.sampleRate * duration)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      const attackSamples = Math.floor(ctx.sampleRate * 0.005)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.min(1, i / attackSamples)
      }
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = this.CFG.wicket_open.filterFreq
      filter.Q.value = 3
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.001, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(this.CFG.wicket_open.maxVolume * volume, ctx.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
      source.connect(filter).connect(gain).connect(this.masterGain!)
      source.start()
      setTimeout(() => {
        try {
          source.stop()
          gain.disconnect()
          filter.disconnect()
        } catch (e) {}
        idleNode.state = 'idle'
      }, 150)
      return
    }

    // ----- 10. Удар калитки (хлопок) -----
    else if (type === 'wicket-slam') {
      const duration = this.CFG.wicket_slam.duration
      const bufferSize = Math.floor(ctx.sampleRate * duration)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        const t = i / bufferSize
        const envelope = Math.pow(1 - t, 3)
        const body = Math.sin(2 * Math.PI * this.CFG.wicket_slam.bodyFreq * t) * envelope * 0.5
        const ring = Math.sin(2 * Math.PI * this.CFG.wicket_slam.ringFreq * t) * envelope * 0.7
        const noise = (Math.random() * 2 - 1) * envelope * 0.3
        data[i] = (body + ring + noise) * 1.5
      }
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 400
      filter.Q.value = 1.2
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(volume * 1.2, ctx.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      source.connect(filter).connect(gain).connect(this.masterGain!)
      source.start()
      setTimeout(() => {
        try {
          source.stop()
          gain.disconnect()
          filter.disconnect()
        } catch (e) {}
        idleNode.state = 'idle'
      }, duration * 1000 + 100)
      return
    }

    // ----- 11. Замок калитки (короткий щелчок) -----
    else if (type === 'wicket-lock') {
      const duration = this.CFG.wicket_lock.duration
      const bufferSize = Math.floor(ctx.sampleRate * duration)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        const t = i / bufferSize
        const envelope = Math.pow(1 - t, 6)
        data[i] = Math.sin(2 * Math.PI * this.CFG.wicket_lock.clickFreq * t) * envelope * 0.8
      }
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const filter = ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 1500
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(volume * this.CFG.wicket_lock.volume, ctx.currentTime + 0.003)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      source.connect(filter).connect(gain).connect(this.masterGain!)
      source.start()
      setTimeout(() => {
        try {
          source.stop()
          gain.disconnect()
          filter.disconnect()
        } catch (e) {}
        idleNode.state = 'idle'
      }, duration * 1000 + 50)
      return
    }

    // Если тип не распознан – помечаем как проигранный и выходим
    idleNode.state = 'idle'
  }

  /** Обновить громкость звука в пуле (плавно) */
  updateVolume(poolId: string, targetVolume: number, dt: number): boolean {
    const pool = this.pools.get(poolId)
    if (!pool) return true
    const playingItem = pool.find(n => n.state === 'playing' && n.nodes?.gain)
    if (!playingItem?.nodes?.gain) return true
    const gain = playingItem.nodes.gain
    const lerpFactor = 1 - Math.pow(0.001, dt * 2)
    const newVol = gain.gain.value + (targetVolume - gain.gain.value) * lerpFactor
    gain.gain.value = Math.abs(newVol) < 0.001 ? 0 : newVol
    return targetVolume === 0 && gain.gain.value === 0
  }

  /** Обновить громкость двигателя с другой константой времени */
  updateEngineVolume(poolId: string, targetVolume: number, dt: number): boolean {
    const pool = this.pools.get(poolId)
    if (!pool) return true
    const playingItem = pool.find(n => n.state === 'playing' && n.nodes?.gain)
    if (!playingItem?.nodes?.gain) return true
    const gain = playingItem.nodes.gain
    const alpha = 1 - Math.exp(-dt / this.CFG.engine.volumeTimeConstant)
    const newVol = gain.gain.value + (targetVolume - gain.gain.value) * alpha
    gain.gain.value = Math.abs(newVol) < 0.001 ? 0 : newVol
    return targetVolume === 0 && gain.gain.value === 0
  }

  /** Изменить частоту двигателя (плавно) */
  setEnginePitch(poolId: string, targetFreq: number, dt: number) {
    const pool = this.pools.get(poolId)
    if (!pool) return
    const playingItem = pool.find(n => n.state === 'playing')
    if (!playingItem?.nodes) return
    const nodes = playingItem.nodes
    let osc = nodes.osc
    if (Array.isArray(osc)) osc = osc[0]
    if (!osc || typeof osc.frequency === 'undefined') return

    let current = this.engineFreq.get(poolId) ?? osc.frequency.value
    const alpha = 1 - Math.exp(-dt / this.CFG.engine.pitchTimeConstant)
    const newFreq = current + (targetFreq - current) * alpha
    this.engineFreq.set(poolId, newFreq)
    osc.frequency.value = newFreq
  }

  /** Получить текущую громкость двигателя */
  getEngineVolume(poolId: string): number {
    const pool = this.pools.get(poolId)
    if (!pool) return 0
    const playingItem = pool.find(n => n.state === 'playing' && n.nodes?.gain)
    if (!playingItem?.nodes?.gain) return 0
    return playingItem.nodes.gain.gain.value
  }

  /** Полностью сбросить пул (остановить все звуки) */
  resetPool(poolId: string) {
    const pool = this.pools.get(poolId)
    if (!pool) return
    for (const item of pool) {
      if (item.state === 'playing') {
        this.cleanupNodes(item.nodes)
        item.nodes = null
      }
      item.state = 'idle'
    }
  }

  /** Удалить пул и освободить ресурсы */
  disposePool(poolId: string) {
    const pool = this.pools.get(poolId)
    if (!pool) return
    for (const item of pool) {
      this.cleanupNodes(item.nodes)
    }
    this.pools.delete(poolId)
  }

  /** Установить общую громкость всех звуков */
  setMasterVolume(vol: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, vol))
    }
  }
}

// Экспортируем единственный экземпляр (синглтон)
export const audioService = new AudioService()