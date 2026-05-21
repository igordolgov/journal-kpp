// =============================================================================
// Файл: composables/useAudioEngine.ts
// Назначение: Единый аудиодвижок на основе Web Audio API.
// Управляет созданием звуков, их воспроизведением, изменением громкости и тона.
// Все звуки генерируются программно (синтезируются).
// =============================================================================

// -----------------------------------------------------------------------------
// Глобальные переменные (синглтон)
// -----------------------------------------------------------------------------
let ctx: AudioContext | null = null               // Основной аудиоконтекст
let masterGain: GainNode | null = null            // Мастер-гейн (общая громкость)
const pools = new Map<string, Array<{ nodes: any | null, state: 'idle' | 'playing', type: string }>>()
const engineFreqMap = new Map<string, number>()   // Хранит текущую частоту двигателя для каждого пула

export const useAudioEngine = () => {
  // ---------------------------------------------------------------------------
  // Заглушка для серверного рендеринга (звуки не нужны)
  // ---------------------------------------------------------------------------
  if (process.server) {
    return {
      init: () => {}, playUI: () => {}, createPool: () => {},
      playFromPool: () => {}, setMasterVolume: () => {},
      disposePool: () => {}, stopPool: () => {}, updateVolume: () => true,
      resetPool: () => {}, updateEngineVolume: () => true, setEnginePitch: () => {}
    }
  }

  // ---------------------------------------------------------------------------
  // Вспомогательные функции
  // ---------------------------------------------------------------------------
  /** Гарантирует существование AudioContext и возвращает его */
  const ensureCtx = () => {
    if (!ctx) {
      ctx = new AudioContext()
      masterGain = ctx.createGain()
      masterGain.connect(ctx.destination)
      // НАСТРОЙКА: общая громкость всех звуков (0..1)
      masterGain.gain.value = 0.6
    }
    return ctx
  }

  const init = () => { ensureCtx() }

  /**
   * Создаёт пул для звуков определённого типа (до size параллельных экземпляров)
   * @param poolId - уникальный идентификатор пула (например, 'gate-active')
   * @param type - тип звука (используется для распознавания внутри playFromPool)
   * @param size - количество слотов в пуле
   */
  const createPool = (poolId: string, type: string, size: number = 5) => {
    if (pools.has(poolId)) return
    const poolArray = []
    for (let i = 0; i < size; i++) poolArray.push({ nodes: null, state: 'idle', type })
    pools.set(poolId, poolArray)
  }

  /**
   * Основной метод воспроизведения звука.
   * Выбирает свободный слот в пуле, синтезирует звук и запускает его.
   * @param poolId - какой пул использовать
   * @param type - тип звука (ui, step, tyre-noise, engine, gate-motor, road-noise, brake, horn, wicket-*)
   * @param volume - громкость (0..1) – будет умножена на внутренние множители
   * @param variation - используется для шагов (рандомизация высоты тона)
   */
  const playFromPool = (poolId: string, type: string, volume: number = 0.5, variation?: number) => {
    const pool = pools.get(poolId)
    if (!pool) return
    const currentCtx = ensureCtx()
    if (!currentCtx) return

    // Для двигателей машин запрещаем второй параллельный экземпляр
    if (type === 'engine') {
      const playingItem = pool.find(n => n.state === 'playing')
      if (playingItem) return
    }

    const idleNode = pool.find(n => n.state === 'idle')
    if (!idleNode) return
    const nodes: any = {}

    // ========== 1. Звук UI (короткий щелчок) ==========
    if (type === 'ui') {
      // Параметры настройки:
      // - длительность: 0.04 сек (фиксировано)
      // - фильтр highpass 2000 Гц, Q=1.5
      // - громкость: volume (берётся из аргумента)
      const bufferSize = Math.floor(currentCtx.sampleRate * 0.04)
      const buffer = currentCtx.createBuffer(1, bufferSize, currentCtx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
      const source = currentCtx.createBufferSource()
      source.buffer = buffer
      const filter = currentCtx.createBiquadFilter()
      filter.type = 'highpass'; filter.frequency.value = 2000; filter.Q.value = 1.5
      const gain = currentCtx.createGain()
      source.connect(filter).connect(gain).connect(masterGain!)
      gain.gain.value = volume
      source.start()
      setTimeout(() => { idleNode.state = 'idle' }, 60)
    }

    // ========== 2. Шаги человека ==========
    else if (type === 'step') {
      // Параметры настройки:
      // - длительность: 0.05 сек
      // - фильтр bandpass: центральная частота = 800 + variation*200 (вариация), Q=3
      // - громкость: volume (обычно 0.6)
      const duration = 0.05
      const bufferSize = Math.floor(currentCtx.sampleRate * duration)
      const buffer = currentCtx.createBuffer(1, bufferSize, currentCtx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3)
      }
      const source = currentCtx.createBufferSource()
      source.buffer = buffer
      const filter = currentCtx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 800 + (variation || 0.5) * 200
      filter.Q.value = 3
      const gain = currentCtx.createGain()
      source.connect(filter).connect(gain).connect(masterGain!)
      gain.gain.value = volume
      source.start()
      setTimeout(() => { idleNode.state = 'idle' }, duration * 1000 + 50)
    }

    // ========== 3. Шум шин (tyre-noise) – зацикленный ==========
    else if (type === 'tyre-noise') {
      // Параметры настройки:
      // - длина буфера: 0.5 сек, зациклен
      // - розовый шум (pink noise)
      // - фильтр bandpass: частота 800 Гц, Q=2
      // - громкость регулируется позже через updateVolume
      const alreadyPlaying = pool.find(n => n.state === 'playing')
      if (alreadyPlaying) return
      const duration = 0.5
      const bufferSize = Math.floor(currentCtx.sampleRate * duration)
      const buffer = currentCtx.createBuffer(1, bufferSize, currentCtx.sampleRate)
      const data = buffer.getChannelData(0)
      let pink = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        pink = 0.95 * pink + 0.05 * white
        data[i] = pink
      }
      const source = currentCtx.createBufferSource()
      source.buffer = buffer
      source.loop = true
      const filter = currentCtx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 800      // НАСТРОЙКА: частота шелеста
      filter.Q.value = 2                // НАСТРОЙКА: ширина полосы
      const gain = currentCtx.createGain()
      gain.gain.value = 0.001
      source.connect(filter).connect(gain).connect(masterGain!)
      source.start()
      nodes.source = source
      nodes.filter = filter
      nodes.gain = gain
      idleNode.nodes = nodes
      idleNode.state = 'playing'
      idleNode.type = type
      return
    }

    // ========== 4. Звук двигателя машины (непрерывный, с возможностью изменения тона) ==========
    else if (type === 'engine') {
      const alreadyPlaying = pool.find(n => n.state === 'playing')
      if (alreadyPlaying) return

      // Осциллятор: sawtooth даёт более агрессивный, «рычащий» звук
      const osc = currentCtx.createOscillator()
      osc.type = 'sawtooth'          // было 'triangle' – теперь резче
      osc.frequency.value = 20       // было 30 – ниже, глубже

      // Шум (розовый) – увеличиваем уровень для насыщенности
      const noiseSize = currentCtx.sampleRate * 2
      const noiseBuffer = currentCtx.createBuffer(1, noiseSize, currentCtx.sampleRate)
      const noiseData = noiseBuffer.getChannelData(0)
      let pink = 0
      for (let i = 0; i < noiseSize; i++) {
        const white = Math.random() * 2 - 1
        pink = 0.95 * pink + 0.05 * white
        noiseData[i] = pink
      }
      const noise = currentCtx.createBufferSource()
      noise.buffer = noiseBuffer
      noise.loop = true
      const noiseFilter = currentCtx.createBiquadFilter()
      noiseFilter.type = 'lowpass'
      noiseFilter.frequency.value = 100   // частота среза шума (низкие)
      noiseFilter.Q.value = 2
      const noiseGain = currentCtx.createGain()
      noiseGain.gain.value = 0.05          // было 0.02 – больше шума, мощнее

      // Общий фильтр двигателя (пропускает низкие и средние частоты)
      const filter = currentCtx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 300         // было 250 – теперь выше, чтобы добавить резкости
      filter.Q.value = 1.5

      const gain = currentCtx.createGain()
      gain.gain.value = 0.001

      osc.connect(filter)
      noise.connect(noiseFilter).connect(noiseGain).connect(filter)
      filter.connect(gain).connect(masterGain!)

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

    // ========== 5. Мотор ворот (зацикленный, с остановкой через stopPool или resetPool) ==========
    else if (type === 'gate-motor') {
      // Параметры настройки:
      // - гул (rumble): буфер шума, фильтр bandpass 980 Гц, Q=27, гейн 1.2
      // - два осциллятора: sawtooth 70 Гц и square 100 Гц, смешиваются через oscGain (0.2)
      // - итоговая громкость: volume * 0.3 (множитель регулирует общую громкость мотора)
      const currentlyPlaying = pool.find(n => n.state === 'playing')
      if (currentlyPlaying?.nodes) {
        // Останавливаем предыдущий экземпляр, если есть
        if (currentlyPlaying.nodes.osc) {
          if (Array.isArray(currentlyPlaying.nodes.osc)) currentlyPlaying.nodes.osc.forEach((o: OscillatorNode) => o.stop())
          else currentlyPlaying.nodes.osc.stop()
        }
        if (currentlyPlaying.nodes.rumble) currentlyPlaying.nodes.rumble.stop()
        if (currentlyPlaying.nodes.gain) currentlyPlaying.nodes.gain.disconnect()
        currentlyPlaying.nodes = null
        currentlyPlaying.state = 'idle'
      }

      const rumbleSize = currentCtx.sampleRate * 2
      const rumbleBuffer = currentCtx.createBuffer(1, rumbleSize, currentCtx.sampleRate)
      const rumbleData = rumbleBuffer.getChannelData(0)
      for (let i = 0; i < rumbleSize; i++) rumbleData[i] = Math.random() * 0.2 - 0.1
      const rumble = currentCtx.createBufferSource()
      rumble.buffer = rumbleBuffer
      rumble.loop = true
      const rumbleFilter = currentCtx.createBiquadFilter()
      rumbleFilter.type = 'bandpass'
      rumbleFilter.frequency.value = 1180   // НАСТРОЙКА: частота гула
      rumbleFilter.Q.value = 17             // НАСТРОЙКА: добротность фильтра
      const rumbleGain = currentCtx.createGain()
      rumbleGain.gain.value = 0.3           // НАСТРОЙКА: громкость гулаz
      const osc1 = currentCtx.createOscillator()
      osc1.type = 'sawtooth'
      osc1.frequency.value = 20             // НАСТРОЙКА: частота осциллятора 1
      const osc2 = currentCtx.createOscillator()
      osc2.type = 'square'
      osc2.frequency.value = 25             // НАСТРОЙКА: частота осциллятора 2
      const oscGain = currentCtx.createGain()
      oscGain.gain.value = 0.6              // НАСТРОЙКА: уровень осцилляторов
      const gain = currentCtx.createGain()
      gain.gain.value = volume * 0.1        // НАСТРОЙКА: общая громкость мотора (множитель)
      rumble.connect(rumbleFilter).connect(rumbleGain).connect(gain)
      osc1.connect(oscGain)
      osc2.connect(oscGain)
      oscGain.connect(gain)
      gain.connect(masterGain!)
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
      return
    }

    // ========== 6. Дорожный шум (фон) – зацикленный ==========
    else if (type === 'road-noise') {
      // Параметры настройки:
      // - розовый шум, длина буфера 2 сек, зациклен
      // - фильтр lowpass 1800 Гц, Q=1
      const alreadyPlaying = pool.find(n => n.state === 'playing')
      if (alreadyPlaying) return
      const duration = 2.0
      const bufferSize = Math.floor(currentCtx.sampleRate * duration)
      const buffer = currentCtx.createBuffer(1, bufferSize, currentCtx.sampleRate)
      const data = buffer.getChannelData(0)
      let pink = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        pink = 0.95 * pink + 0.05 * white
        data[i] = pink
      }
      const source = currentCtx.createBufferSource()
      source.buffer = buffer
      source.loop = true
      const filter = currentCtx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 1800   // НАСТРОЙКА: частота среза
      filter.Q.value = 1
      const gain = currentCtx.createGain()
      gain.gain.value = 0.001
      source.connect(filter).connect(gain).connect(masterGain!)
      source.start()
      nodes.source = source
      nodes.filter = filter
      nodes.gain = gain
      idleNode.nodes = nodes
      idleNode.state = 'playing'
      idleNode.type = type
      return
    }

    // ========== 7. Тормоза ==========
    else if (type === 'brake') {
      // Параметры настройки:
      // - осциллятор sawtooth, частота падает с 1200 до 400 Гц за 0.25 сек
      // - фильтр bandpass 2000 Гц, Q=5
      // - громкость: 0.4 * volume
      const now = currentCtx.currentTime
      const duration = 0.25
      const osc = currentCtx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(1200, now)
      osc.frequency.exponentialRampToValueAtTime(400, now + duration)
      const filter = currentCtx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 2000
      filter.Q.value = 5
      const gain = currentCtx.createGain()
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.linearRampToValueAtTime(0.4 * volume, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
      osc.connect(filter).connect(gain).connect(masterGain!)
      osc.start()
      osc.stop(now + duration)
      setTimeout(() => { idleNode.state = 'idle' }, duration * 1000 + 100)
      return
    }

    // ========== 8. Гудок ==========
    else if (type === 'horn') {
      // Параметры настройки:
      // - два осциллятора square (350 Гц и 440 Гц)
      // - фильтр bandpass 400 Гц, Q=1.5
      // - длительность 1.5 сек, две короткие трели (с паузой 0)
      // - громкость: volume * 0.4
      const now = currentCtx.currentTime
      const duration = 1.5
      const pause = 0.2
      const volumeFactor = 0.4
      const playBeep = (startTime: number) => {
        const osc1 = currentCtx.createOscillator()
        osc1.type = 'square'
        osc1.frequency.value = 350
        const osc2 = currentCtx.createOscillator()
        osc2.type = 'square'
        osc2.frequency.value = 440
        const filter = currentCtx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 400
        filter.Q.value = 1.5
        const gain = currentCtx.createGain()
        gain.gain.setValueAtTime(0.001, startTime)
        gain.gain.linearRampToValueAtTime(volume * volumeFactor, startTime + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
        osc1.connect(filter)
        osc2.connect(filter)
        filter.connect(gain).connect(masterGain!)
        osc1.start(startTime)
        osc2.start(startTime)
        osc1.stop(startTime + duration)
        osc2.stop(startTime + duration)
      }
      playBeep(now)
      playBeep(now + duration + pause)
      setTimeout(() => { idleNode.state = 'idle' }, (duration * 2 + pause + 0.1) * 1000)
      return
    }

    // ========== 9. Скрип калитки ==========
    else if (type === 'wicket-creak') {
      // Параметры настройки:
      // - случайный шум с синусоидальной огибающей
      const duration = 0.8
      const bufferSize = Math.floor(currentCtx.sampleRate * duration)
      const buffer = currentCtx.createBuffer(1, bufferSize, currentCtx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin(i / bufferSize * Math.PI)
      }
      const source = currentCtx.createBufferSource()
      source.buffer = buffer
      const filter = currentCtx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 5500   // НАСТРОЙКА: частота скрипа
      filter.Q.value = 9
      const gain = currentCtx.createGain()
      gain.gain.value = volume * 0.6
      source.connect(filter).connect(gain).connect(masterGain!)
      source.start()
      setTimeout(() => { idleNode.state = 'idle' }, 900)
      return
    }

    // ========== 10. Щелчок замка калитки ==========
    else if (type === 'wicket-lock') {
      // Параметры настройки:
      // - синус 3000 Гц с экспоненциальным затуханием, длительность 0.05 сек
      const duration = 0.05
      const bufferSize = Math.floor(currentCtx.sampleRate * duration)
      const buffer = currentCtx.createBuffer(1, bufferSize, currentCtx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        const t = i / bufferSize
        const envelope = Math.pow(1 - t, 6)
        data[i] = Math.sin(2 * Math.PI * 3000 * t) * envelope * 0.8
      }
      const source = currentCtx.createBufferSource()
      source.buffer = buffer
      const filter = currentCtx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 1500
      const gain = currentCtx.createGain()
      gain.gain.setValueAtTime(0, currentCtx.currentTime)
      gain.gain.linearRampToValueAtTime(volume * 0.9, currentCtx.currentTime + 0.003)
      gain.gain.exponentialRampToValueAtTime(0.001, currentCtx.currentTime + duration)
      source.connect(filter).connect(gain).connect(masterGain!)
      source.start()
      setTimeout(() => { idleNode.state = 'idle' }, duration * 1000 + 50)
      return
    }

    // ========== 11. Грохот калитки (удар) ==========
    else if (type === 'wicket-slam') {
      // Параметры настройки:
      // - синтез удара: комбинация низкочастотного тела и высокочастотного звона,
      //   длительность 0.4 сек, громкость ограничена 1.5
      const duration = 0.4
      const bufferSize = Math.floor(currentCtx.sampleRate * duration)
      const buffer = currentCtx.createBuffer(1, bufferSize, currentCtx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        const t = i / bufferSize
        const envelope = Math.pow(1 - t, 3)
        const body = Math.sin(2 * Math.PI * 100 * t) * envelope * 0.5
        const ring = Math.sin(2 * Math.PI * 1800 * t) * envelope * 0.7
        const noise = (Math.random() * 2 - 1) * envelope * 0.3
        data[i] = (body + ring + noise) * 1.5
      }
      const source = currentCtx.createBufferSource()
      source.buffer = buffer
      const filter = currentCtx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 400
      filter.Q.value = 1.5
      const gain = currentCtx.createGain()
      gain.gain.setValueAtTime(0, currentCtx.currentTime)
      gain.gain.linearRampToValueAtTime(Math.min(1.2 * volume, 1.2), currentCtx.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, currentCtx.currentTime + duration)
      source.connect(filter).connect(gain).connect(masterGain!)
      source.start()
      setTimeout(() => { idleNode.state = 'idle' }, duration * 1000 + 100)
      return
    }

    // Если тип не распознан – просто помечаем слот как свободный
    idleNode.state = 'idle'
  }

  // ---------------------------------------------------------------------------
  // Вспомогательные методы для внешнего управления
  // ---------------------------------------------------------------------------
  const playUI = (volume: number = 0.8) => playFromPool('ui-global', 'ui', volume)
  const setMasterVolume = (vol: number) => { if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, vol)) }

  /**
   * Плавное изменение громкости звука (для большинства звуков)
   * @param poolId - идентификатор пула
   * @param targetVolume - целевая громкость (0..1)
   * @param dt - время, прошедшее с последнего обновления (в секундах)
   * @returns true, если звук полностью заглушён и его можно удалить
   */
  const updateVolume = (poolId: string, targetVolume: number, dt: number): boolean => {
    const pool = pools.get(poolId)
    if (!pool) return true
    const playingItem = pool.find(n => n.state === 'playing' && n.nodes?.gain)
    if (!playingItem || !playingItem.nodes.gain) return true
    const gain = playingItem.nodes.gain
    const lerpFactor = 1 - Math.pow(0.001, dt * 8)
    const newVol = gain.gain.value + (targetVolume - gain.gain.value) * lerpFactor
    gain.gain.value = Math.abs(newVol) < 0.001 ? 0 : newVol
    return targetVolume === 0 && gain.gain.value === 0
  }

  /**
   * Плавное изменение громкости двигателя (более медленное, с постоянной времени 0.8 сек)
   */
  const updateEngineVolume = (poolId, targetVolume, dt) => {
    const pool = pools.get(poolId)
    if (!pool) return true
    const playingItem = pool.find(n => n.state === 'playing' && n.nodes?.gain)
    if (!playingItem || !playingItem.nodes.gain) return true
    const gain = playingItem.nodes.gain
    const alpha = 1 - Math.exp(-dt / 0.8)   // НАСТРОЙКА: постоянная времени (0.8 сек)
    const newVol = gain.gain.value + (targetVolume - gain.gain.value) * alpha
    gain.gain.value = Math.abs(newVol) < 0.001 ? 0 : newVol
    return targetVolume === 0 && gain.gain.value === 0
  }

  /**
   * Плавное изменение частоты двигателя (тона) в зависимости от скорости
   * @param poolId - пул двигателя
   * @param targetFreq - целевая частота (Гц)
   * @param dt - прошедшее время
   */
  const setEnginePitch = (poolId, targetFreq, dt) => {
    const pool = pools.get(poolId)
    if (!pool) return
    const playingItem = pool.find(n => n.state === 'playing')
    if (!playingItem?.nodes) return
    const nodes = playingItem.nodes
    let osc = nodes.osc
    if (Array.isArray(osc)) osc = osc[0]
    if (!osc || typeof osc.frequency === 'undefined') return

    let current = engineFreqMap.get(poolId) ?? osc.frequency.value
    const alpha = 1 - Math.exp(-dt / 0.8)   // НАСТРОЙКА: скорость изменения тона (0.6 сек)
    const newFreq = current + (targetFreq - current) * alpha
    engineFreqMap.set(poolId, newFreq)
    osc.frequency.value = newFreq
  }

  /**
   * Полностью удалить пул и освободить ресурсы
   */
  const disposePool = (poolId: string) => {
    const pool = pools.get(poolId)
    if (!pool) return
    for (const item of pool) {
      if (item.nodes) {
        if (item.nodes.osc) {
          if (Array.isArray(item.nodes.osc)) item.nodes.osc.forEach((o: OscillatorNode) => o.stop())
          else item.nodes.osc.stop()
        }
        if (item.nodes.rumble) item.nodes.rumble.stop()
        if (item.nodes.noise) try { item.nodes.noise.stop() } catch(e) {}
        if (item.nodes.source) try { item.nodes.source.stop() } catch(e) {}
        if (item.nodes.filter) try { item.nodes.filter.disconnect() } catch(e) {}
        if (item.nodes.gain) try { item.nodes.gain.disconnect() } catch(e) {}
      }
    }
    pools.delete(poolId)
    engineFreqMap.delete(poolId)
  }

  /**
   * Быстро остановить звук, установив гейн на 0.001 (не удаляя пул)
   */
  const stopPool = (poolId: string) => {
    const pool = pools.get(poolId)
    if (!pool) return
    for (const item of pool) {
      if (item.nodes?.gain) item.nodes.gain.gain.value = 0.001
    }
  }

  /**
   * Полностью сбросить пул – остановить все звуки и перевести в состояние idle
   */
  const resetPool = (poolId: string) => {
    const pool = pools.get(poolId)
    if (!pool) return
    for (const item of pool) {
      if (item.state === 'playing' && item.nodes) {
        if (item.nodes.osc) {
          if (Array.isArray(item.nodes.osc)) item.nodes.osc.forEach((o: OscillatorNode) => o.stop())
          else item.nodes.osc.stop()
        }
        if (item.nodes.rumble) item.nodes.rumble.stop()
        if (item.nodes.noise) try { item.nodes.noise.stop() } catch(e) {}
        if (item.nodes.filter) try { item.nodes.filter.disconnect() } catch(e) {}
        if (item.nodes.gain) try { item.nodes.gain.disconnect() } catch(e) {}
      }
      item.nodes = null
      item.state = 'idle'
    }
    engineFreqMap.delete(poolId)
  }

  // ---------------------------------------------------------------------------
  // Экспортируемый API
  // ---------------------------------------------------------------------------
  return {
    init,
    playUI,
    createPool,
    playFromPool,
    setMasterVolume,
    updateVolume,
    updateEngineVolume,
    setEnginePitch,
    disposePool,
    stopPool,
    resetPool,
    ctx: () => ctx
  }
}