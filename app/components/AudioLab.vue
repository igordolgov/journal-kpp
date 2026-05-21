<template lang="pug">
.audio-lab.p-6.max-w-6xl.mx-auto
  .container.p-4.bg-gray-900.text-white.rounded-lg.shadow-xl
    h2.text-xl.font-bold.mb-4 🔊 Максимальная звуковая лаборатория

    .flex.justify-between.items-center.mb-4
      .text-xs.text-gray-400.status(v-if="ctxState === 'suspended'") ⚠️ Звук заблокирован браузером – нажмите «Разрешить звук»
      .text-xs.text-green-400(v-else) ✅ Аудио готово

      button.px-3.py-1.bg-yellow-600.rounded.text-xs(@click="unlockAudio") 🔊 Разрешить звук

    //- Вкладки типов звуков
    .flex.gap-2.border-b.border-gray-700.mb-4
      button(
        v-for="type in soundTypes"
        :key="type"
        @click="currentType = type"
        :class="[ 'px-3 py-2 rounded-t transition-colors', currentType === type ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white' ]"
      ) {{ typeNames[type] }}

    //- ADSR огибающая (только для коротких звуков)
    .grid.grid-cols-4.gap-2.mb-4.p-2.bg-gray-800.rounded(v-if="hasAdsr")
      .col-span-1
        label.block.text-xs.text-gray-400 Attack (сек)
        input.w-full(type="range" min="0" max="2" step="0.01" v-model.number="params.common.attack")
      .col-span-1
        label.block.text-xs.text-gray-400 Decay (сек)
        input.w-full(type="range" min="0" max="2" step="0.01" v-model.number="params.common.decay")
      .col-span-1
        label.block.text-xs.text-gray-400 Sustain
        input.w-full(type="range" min="0" max="1" step="0.01" v-model.number="params.common.sustain")
      .col-span-1
        label.block.text-xs.text-gray-400 Release (сек)
        input.w-full(type="range" min="0" max="3" step="0.01" v-model.number="params.common.release")

    //- Основные настройки (громкость, панорама)
    .grid.grid-cols-2.gap-4.mb-4
      .bg-gray-800.p-2.rounded
        label.block.text-xs.text-gray-400 Громкость (master)
        input.w-full(type="range" min="0" max="1" step="0.01" v-model.number="params.common.volume")
      .bg-gray-800.p-2.rounded
        label.block.text-xs.text-gray-400 Стереопанорама
        input.w-full(type="range" min="-1" max="1" step="0.01" v-model.number="params.common.pan")

    //- Настройки осцилляторов (для ворот, двигателя, гудков)
    .bg-gray-800.p-3.rounded.mb-4(v-if="isOscillatorType")
      h3.text-sm.font-semibold.mb-2 Осцилляторы и фильтр
      .grid.grid-cols-3.gap-2.mb-2
        .col-span-1
          label.block.text-xs.text-gray-400 Форма волны
          select.w-full.bg-gray-700.text-white.px-2.py-1.rounded(v-model="params[currentType].waveform")
            option(v-for="w in ['sine', 'square', 'sawtooth', 'triangle', 'custom']") {{ w }}
        .col-span-1
          label.block.text-xs.text-gray-400 Частота 1 (Гц)
          input.w-full(type="range" min="20" max="1000" step="1" v-model.number="params[currentType].freq1")
        .col-span-1
          label.block.text-xs.text-gray-400 Частота 2 (Гц)
          input.w-full(type="range" min="20" max="1000" step="1" v-model.number="params[currentType].freq2")
      .grid.grid-cols-2.gap-2.mb-2(v-if="params[currentType].waveform === 'custom'")
        .col-span-2
          label.block.text-xs.text-gray-400 Коэффициенты гармоник (через запятую)
          input.w-full.bg-gray-700.text-white.px-2.py-1.rounded(type="text" v-model="params[currentType].customHarmonics" placeholder="1, 0.5, 0.3, 0.1")
      .grid.grid-cols-2.gap-2
        .col-span-1
          label.block.text-xs.text-gray-400 ФНЧ частота (Гц)
          input.w-full(type="range" min="50" max="2000" step="10" v-model.number="params[currentType].lpfFreq")
        .col-span-1
          label.block.text-xs.text-gray-400 Q фильтра
          input.w-full(type="range" min="0.5" max="20" step="0.1" v-model.number="params[currentType].q")

    //- Специфичные для шага
    .bg-gray-800.p-3.rounded.mb-4(v-if="currentType === 'step'")
      h3.text-sm.font-semibold.mb-2 Параметры шума
      .grid.grid-cols-3.gap-2
        .col-span-1
          label.block.text-xs.text-gray-400 Плотность
          input.w-full(type="range" min="0.5" max="3" step="0.01" v-model.number="params.step.noiseDensity")
        .col-span-1
          label.block.text-xs.text-gray-400 Длительность (сек)
          input.w-full(type="range" min="0.05" max="1" step="0.01" v-model.number="params.step.duration")
        .col-span-1
          label.block.text-xs.text-gray-400 ФНЧ частота (Гц)
          input.w-full(type="range" min="500" max="8000" step="100" v-model.number="params.step.lpfFreq")

    //- Эффекты (компрессор, задержка, реверберация, эквалайзер)
    .grid.grid-cols-2.gap-4.mb-4
      .bg-gray-800.p-2.rounded
        .flex.items-center.justify-between.mb-1
          label.text-xs.text-gray-400 Компрессор
          input(type="checkbox" v-model="params.effects.compressor.enabled")
        div(v-if="params.effects.compressor.enabled")
          .grid.grid-cols-3.gap-1.text-xs
            .col-span-1 threshold (дБ)
            input.w-full(type="range" min="-40" max="0" step="1" v-model.number="params.effects.compressor.threshold")
            .col-span-1 ratio
            input.w-full(type="range" min="1" max="20" step="0.5" v-model.number="params.effects.compressor.ratio")
            .col-span-1 attack (сек)
            input.w-full(type="range" min="0" max="1" step="0.01" v-model.number="params.effects.compressor.attack")
            .col-span-1 release (сек)
            input.w-full(type="range" min="0.01" max="1" step="0.01" v-model.number="params.effects.compressor.release")
            .col-span-1 knee (дБ)
            input.w-full(type="range" min="0" max="40" step="1" v-model.number="params.effects.compressor.knee")
      .bg-gray-800.p-2.rounded
        .flex.items-center.justify-between.mb-1
          label.text-xs.text-gray-400 Задержка (Delay)
          input(type="checkbox" v-model="params.effects.delay.enabled")
        div(v-if="params.effects.delay.enabled")
          .grid.grid-cols-2.gap-1.text-xs
            .col-span-1 время (сек)
            input.w-full(type="range" min="0.05" max="1" step="0.01" v-model.number="params.effects.delay.time")
            .col-span-1 уровень (0–1)
            input.w-full(type="range" min="0" max="1" step="0.01" v-model.number="params.effects.delay.wet")
            .col-span-1 обратная связь
            input.w-full(type="range" min="0" max="0.9" step="0.01" v-model.number="params.effects.delay.feedback")

    .grid.grid-cols-2.gap-4.mb-4
      .bg-gray-800.p-2.rounded
        .flex.items-center.justify-between.mb-1
          label.text-xs.text-gray-400 Реверберация (Convolver)
          input(type="checkbox" v-model="params.effects.reverb.enabled")
        div(v-if="params.effects.reverb.enabled")
          .flex.gap-2.mb-2
            button.text-xs.bg-gray-700.px-2.py-1.rounded(@click="loadDefaultImpulse('small')") Небольшая комната
            button.text-xs.bg-gray-700.px-2.py-1.rounded(@click="loadDefaultImpulse('large')") Большой зал
          .mb-2
            label.block.text-xs.text-gray-400 Загрузить свой WAV/MP3
            input(type="file" accept="audio/wav,audio/mp3" @change="loadCustomImpulse")
      .bg-gray-800.p-2.rounded
        .flex.items-center.justify-between.mb-1
          label.text-xs.text-gray-400 4-полосный эквалайзер
          input(type="checkbox" v-model="params.effects.eq.enabled")
        div(v-if="params.effects.eq.enabled")
          .grid.grid-cols-4.gap-1.text-xs
            .col-span-1 НЧ (dB)
            input.w-full(type="range" min="-15" max="15" step="0.5" v-model.number="params.effects.eq.low")
            .col-span-1 НСЧ
            input.w-full(type="range" min="-15" max="15" step="0.5" v-model.number="params.effects.eq.midLow")
            .col-span-1 ВСЧ
            input.w-full(type="range" min="-15" max="15" step="0.5" v-model.number="params.effects.eq.midHigh")
            .col-span-1 ВЧ
            input.w-full(type="range" min="-15" max="15" step="0.5" v-model.number="params.effects.eq.high")

    //- Визуализация спектра
    .bg-gray-800.p-2.rounded.mb-4
      .flex.items-center.justify-between
        .text-xs.text-gray-400 Спектр анализатор
        button.text-xs.bg-gray-700.px-2.py-1.rounded(@click="toggleVisualizer") {{ visualizerEnabled ? 'Скрыть' : 'Показать' }}
      canvas(ref="spectrumCanvas" width="600" height="100" v-show="visualizerEnabled" class="w-full mt-2")

    //- Кнопки управления
    .actions.flex.gap-3.flex-wrap.mb-6
      button.px-5.py-2.bg-green-600.rounded(@click="playSound" class="hover:bg-green-500") ▶ Прослушать
      button.px-5.py-2.bg-red-600.rounded(@click="stopSound" class="hover:bg-red-500") ⏹ Остановить
      button.px-5.py-2.bg-yellow-600.rounded(@click="savePreset" class="hover:bg-yellow-500") 💾 Сохранить пресет
      button.px-5.py-2.bg-blue-600.rounded(@click="loadPresetDialog" class="hover:bg-blue-500") 📂 Загрузить пресет
      button.px-5.py-2.bg-purple-600.rounded(@click="exportCode" class="hover:bg-purple-500") 📋 Код для useAudioEngine

    .code-output.bg-black.p-3.rounded.font-mono.text-sm.overflow-x-auto(v-if="generatedCode")
      pre {{ generatedCode }}
      button.mt-2.px-3.py-1.bg-gray-600.rounded.text-xs(@click="copyToClipboard") Копировать
</template>

<script setup>
import { ref, reactive, computed, watch, onBeforeUnmount, onMounted } from 'vue'

// --- Типы звуков ---
const soundTypes = ['gate-motor', 'car-engine', 'step', 'horn', 'ui', 'wicket-creak']
const typeNames = {
  'gate-motor': 'Мотор ворот',
  'car-engine': 'Двигатель машины',
  'step': 'Шаг',
  'horn': 'Гудок',
  'ui': 'Звук UI',
  'wicket-creak': 'Скрип калитки'
}

// --- Состояние компонента ---
const currentType = ref('gate-motor')
const visualizerEnabled = ref(false)
const ctxState = ref('suspended')
let ctx = null
let soundNodes = null
let animationId = null
const spectrumCanvas = ref(null)
let analyser = null

// --- Параметры ---
const params = reactive({
  common: {
    volume: 0.7,
    pan: 0,
    attack: 0.01,
    decay: 0.3,
    sustain: 0.7,
    release: 0.2
  },
  effects: {
    compressor: {
      enabled: false,
      threshold: -24,
      ratio: 12,
      attack: 0.003,
      release: 0.25,
      knee: 30
    },
    delay: {
      enabled: false,
      time: 0.3,
      wet: 0.4,
      feedback: 0.5
    },
    reverb: {
      enabled: false,
      impulseBuffer: null
    },
    eq: {
      enabled: false,
      low: 0,
      midLow: 0,
      midHigh: 0,
      high: 0
    }
  },
  'gate-motor': {
    waveform: 'sine',
    freq1: 100,
    freq2: 150,
    lpfFreq: 250,
    q: 1.0,
    customHarmonics: '1,0.5,0.3'
  },
  'car-engine': {
    waveform: 'sawtooth',
    freq1: 40,
    freq2: 80,
    lpfFreq: 180,
    q: 1.0,
    customHarmonics: '1,0.5,0.2'
  },
  step: {
    noiseDensity: 1.0,
    lpfFreq: 4000,
    duration: 0.2
  },
  horn: {
    waveform: 'sine',
    freq1: 880,
    customHarmonics: '1,0.3'
  },
  ui: {
    waveform: 'sine',
    freq1: 1200,
    customHarmonics: ''
  },
  'wicket-creak': {
    waveform: 'sine',
    freq1: 2500,
    freq2: 800,
    duration: 0.8,
    lpfFreq: 1000
  }
})

const generatedCode = ref('')

// --- Вычисляемые свойства ---
const isOscillatorType = computed(() => ['gate-motor', 'car-engine', 'horn', 'ui', 'wicket-creak'].includes(currentType.value))
const hasAdsr = computed(() => !['car-engine', 'gate-motor'].includes(currentType.value))

// --- Инициализация аудиоконтекста (без автоматического Resume) ---
async function initCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    ctx.onstatechange = () => {
      ctxState.value = ctx.state
    }
    ctxState.value = ctx.state
  }
  return ctx
}

// --- Принудительная разблокировка (по клику) ---
async function unlockAudio() {
  const audioCtx = await initCtx()
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume()
  }
  ctxState.value = audioCtx.state
  if (ctxState.value !== 'suspended') {
    // можно показать уведомление
  }
}

// --- Остановка всех текущих звуков ---
function stopSound() {
  if (soundNodes) {
    // Останавливаем осцилляторы / источники
    if (soundNodes.osc) {
      if (Array.isArray(soundNodes.osc)) soundNodes.osc.forEach(osc => osc.stop())
      else soundNodes.osc.stop()
    }
    if (soundNodes.source) soundNodes.source.stop()
    if (soundNodes.noise) soundNodes.noise.stop()
    // Отключаем узлы
    if (soundNodes.gain) soundNodes.gain.disconnect()
    if (soundNodes.filter) soundNodes.filter.disconnect()
    soundNodes = null
  }
  if (animationId) cancelAnimationFrame(animationId)
  if (analyser) analyser.disconnect()
  analyser = null
}

// --- Вспомогательные функции для синтеза ---
function createPeriodicWave(audioCtx, harmonicsStr) {
  if (!harmonicsStr) return null
  const coeffs = harmonicsStr.split(',').map(Number).filter(v => !isNaN(v))
  if (coeffs.length === 0) return null
  const real = new Float32Array(coeffs.length)
  const imag = new Float32Array(coeffs.length)
  for (let i = 0; i < coeffs.length; i++) {
    real[i] = coeffs[i]
    imag[i] = 0
  }
  return audioCtx.createPeriodicWave(real, imag)
}

function applyAdsr(gainNode, startTime, duration, attack, decay, sustain, release) {
  const a = attack ?? params.common.attack
  const d = decay ?? params.common.decay
  const s = sustain ?? params.common.sustain
  const r = release ?? params.common.release
  if (!gainNode.gain) return
  gainNode.gain.cancelScheduledValues(startTime)
  gainNode.gain.setValueAtTime(0, startTime)
  gainNode.gain.linearRampToValueAtTime(1, startTime + a)
  gainNode.gain.linearRampToValueAtTime(s, startTime + a + d)
  if (r > 0) {
    gainNode.gain.setValueAtTime(s, startTime + duration - r)
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration)
  } else {
    gainNode.gain.setValueAtTime(s, startTime + duration)
  }
}

// --- Воспроизведение звука (с предварительной разблокировкой) ---
async function playSound() {
  try {
    // Разблокируем контекст, если он ещё не активен
    await unlockAudio()
    const audioCtx = ctx
    if (!audioCtx || audioCtx.state !== 'running') {
      console.warn('AudioContext не запущен')
      return
    }

    stopSound()
    const now = audioCtx.currentTime
    const type = currentType.value
    const vol = params.common.volume

    // Цепочка узлов
    const masterGain = audioCtx.createGain()
    masterGain.gain.value = 0.001
    let output = masterGain

    // Панорама
    const panner = audioCtx.createStereoPanner()
    panner.pan.value = params.common.pan
    masterGain.connect(panner)
    output = panner

    // Эквалайзер
    if (params.effects.eq.enabled) {
      const eqConfig = [
        { freq: 80, gain: params.effects.eq.low, type: 'lowshelf' },
        { freq: 400, gain: params.effects.eq.midLow, type: 'peaking', Q: 1 },
        { freq: 2000, gain: params.effects.eq.midHigh, type: 'peaking', Q: 1 },
        { freq: 6000, gain: params.effects.eq.high, type: 'highshelf' }
      ]
      for (const cfg of eqConfig) {
        const filter = audioCtx.createBiquadFilter()
        filter.type = cfg.type
        filter.frequency.value = cfg.freq
        filter.gain.value = cfg.gain
        if (cfg.Q) filter.Q.value = cfg.Q
        output.connect(filter)
        output = filter
      }
    }

    // Компрессор
    if (params.effects.compressor.enabled) {
      const comp = audioCtx.createDynamicsCompressor()
      const c = params.effects.compressor
      comp.threshold.value = c.threshold
      comp.ratio.value = c.ratio
      comp.attack.value = c.attack
      comp.release.value = c.release
      comp.knee.value = c.knee
      output.connect(comp)
      output = comp
    }

    // Задержка
    let delayOutput = output
    if (params.effects.delay.enabled) {
      const delayNode = audioCtx.createDelay()
      delayNode.delayTime.value = params.effects.delay.time
      const delayGain = audioCtx.createGain()
      delayGain.gain.value = params.effects.delay.wet
      const feedback = audioCtx.createGain()
      feedback.gain.value = params.effects.delay.feedback
      output.connect(delayNode)
      delayNode.connect(delayGain)
      delayGain.connect(feedback)
      feedback.connect(delayNode)
      output.connect(delayGain)
      delayOutput = delayGain
    }
    output = delayOutput

    // Реверберация
    if (params.effects.reverb.enabled && params.effects.reverb.impulseBuffer) {
      const reverb = audioCtx.createConvolver()
      reverb.buffer = params.effects.reverb.impulseBuffer
      output.connect(reverb)
      output = reverb
    }

    // Финальное подключение к динамикам
    output.connect(audioCtx.destination)

    // Генерация источника звука
    let srcNodes = {}
    if (type === 'step') {
      const p = params.step
      const bufferSize = audioCtx.sampleRate * p.duration
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, p.noiseDensity)
      }
      const source = audioCtx.createBufferSource()
      source.buffer = noiseBuffer
      const filter = audioCtx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = p.lpfFreq
      const gain = audioCtx.createGain()
      applyAdsr(gain, now, p.duration, 0.01, 0.1, 0, 0.1)
      source.connect(filter).connect(gain).connect(output)
      source.start()
      srcNodes = { source, filter, gain }
    } else if (type === 'gate-motor' || type === 'car-engine') {
      const p = params[type]
      let osc1, osc2
      if (p.waveform === 'custom' && p.customHarmonics) {
        const wave = createPeriodicWave(audioCtx, p.customHarmonics)
        osc1 = audioCtx.createOscillator()
        osc1.setPeriodicWave(wave)
        osc2 = audioCtx.createOscillator()
        osc2.setPeriodicWave(wave)
      } else {
        osc1 = audioCtx.createOscillator()
        osc1.type = p.waveform
        osc2 = audioCtx.createOscillator()
        osc2.type = p.waveform
      }
      osc1.frequency.value = p.freq1
      osc2.frequency.value = p.freq2
      const filter = audioCtx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = p.lpfFreq
      filter.Q.value = p.q
      const gain = audioCtx.createGain()
      gain.gain.value = 0.25
      osc1.connect(filter)
      osc2.connect(filter)
      filter.connect(gain).connect(output)
      osc1.start()
      osc2.start()
      srcNodes = { osc: [osc1, osc2], filter, gain }
    } else {
      // horn, ui, wicket-creak
      const p = params[type]
      let osc
      if (p.waveform === 'custom' && p.customHarmonics) {
        const wave = createPeriodicWave(audioCtx, p.customHarmonics)
        osc = audioCtx.createOscillator()
        osc.setPeriodicWave(wave)
      } else {
        osc = audioCtx.createOscillator()
        osc.type = p.waveform || 'sine'
      }
      osc.frequency.value = p.freq1 || 440
      const gain = audioCtx.createGain()
      let duration = 0
      if (type === 'wicket-creak') {
        osc.frequency.setValueAtTime(p.freq1, 0)
        osc.frequency.exponentialRampToValueAtTime(p.freq2, p.duration)
        duration = p.duration
      } else {
        duration = params.common.attack + params.common.decay + params.common.release
      }
      applyAdsr(gain, now, duration, params.common.attack, params.common.decay, params.common.sustain, params.common.release)
      osc.connect(gain).connect(output)
      osc.start()
      if (duration > 0) osc.stop(now + duration + 0.05)
      srcNodes = { osc, gain }
    }

    soundNodes = srcNodes

    // Визуализатор
    if (visualizerEnabled.value) {
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      output.connect(analyser)
      startVisualizer()
    }

    // Плавное нарастание громкости
    masterGain.gain.setValueAtTime(0, now)
    masterGain.gain.linearRampToValueAtTime(vol, now + 0.05)

    // Авто‑остановка для не‑циклических звуков
    if (!['car-engine', 'gate-motor'].includes(type)) {
      const totalDur = (type === 'wicket-creak' ? params['wicket-creak'].duration : params.common.attack + params.common.decay + params.common.release) + 0.2
      setTimeout(() => stopSound(), totalDur * 1000)
    }
  } catch (err) {
    console.error('playSound error', err)
  }
}

// --- Визуализация спектра ---
function startVisualizer() {
  if (!analyser) return
  const canvas = spectrumCanvas.value
  if (!canvas) return
  const ctx2d = canvas.getContext('2d')
  const dataArray = new Uint8Array(analyser.frequencyBinCount)
  function draw() {
    if (!visualizerEnabled.value) return
    analyser.getByteFrequencyData(dataArray)
    ctx2d.fillStyle = '#000'
    ctx2d.fillRect(0, 0, canvas.width, canvas.height)
    const barWidth = canvas.width / dataArray.length
    for (let i = 0; i < dataArray.length; i++) {
      const barHeight = dataArray[i] / 255 * canvas.height
      ctx2d.fillStyle = `hsl(${i * 360 / dataArray.length}, 100%, 50%)`
      ctx2d.fillRect(i * barWidth, canvas.height - barHeight, barWidth, barHeight)
    }
    animationId = requestAnimationFrame(draw)
  }
  draw()
}

function toggleVisualizer() {
  visualizerEnabled.value = !visualizerEnabled.value
  if (!visualizerEnabled.value && animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  } else if (visualizerEnabled.value && soundNodes) {
    if (!analyser) {
      const audioCtx = ctx
      if (audioCtx) {
        analyser = audioCtx.createAnalyser()
        // В идеале нужно переподключить analyser к текущему output, но для упрощения – отключаем
      }
    }
    startVisualizer()
  }
}

// --- Реверберация (импульсные отклики) ---
async function loadDefaultImpulse(size) {
  const audioCtx = ctx || await initCtx()
  const duration = size === 'small' ? 0.4 : 1.5
  const sampleRate = audioCtx.sampleRate
  const buffer = audioCtx.createBuffer(2, sampleRate * duration, sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const channel = buffer.getChannelData(ch)
    for (let i = 0; i < channel.length; i++) {
      const t = i / sampleRate
      channel[i] = (Math.random() * 2 - 1) * Math.exp(-t * (size === 'small' ? 10 : 3))
    }
  }
  params.effects.reverb.impulseBuffer = buffer
}

function loadCustomImpulse(event) {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async (e) => {
    const audioCtx = ctx || await initCtx()
    audioCtx.decodeAudioData(e.target.result, (buffer) => {
      params.effects.reverb.impulseBuffer = buffer
    })
  }
  reader.readAsArrayBuffer(file)
}

// --- Пресеты ---
function savePreset() {
  const name = prompt('Имя пресета', 'my_sound')
  if (!name) return
  const preset = {
    name,
    type: currentType.value,
    params: JSON.parse(JSON.stringify(params))
  }
  const presets = JSON.parse(localStorage.getItem('audioLabPresets') || '{}')
  presets[name] = preset
  localStorage.setItem('audioLabPresets', JSON.stringify(presets))
  alert('Пресет сохранён')
}

function loadPresetDialog() {
  const presets = JSON.parse(localStorage.getItem('audioLabPresets') || '{}')
  const names = Object.keys(presets)
  if (!names.length) { alert('Нет сохранённых пресетов'); return }
  const name = prompt('Доступные пресеты:\n' + names.join('\n'), names[0])
  if (name && presets[name]) {
    const p = presets[name]
    currentType.value = p.type
    // Глубокое копирование (заменяем params)
    Object.assign(params, JSON.parse(JSON.stringify(p.params)))
  }
}

// --- Экспорт и копирование ---
function exportCode() {
  const config = { type: currentType.value, params: JSON.parse(JSON.stringify(params)) }
  generatedCode.value = `const soundConfig = ${JSON.stringify(config, null, 2)};\n// Используйте в playWithConfig(config)`
}
function copyToClipboard() {
  if (!generatedCode.value) return
  navigator.clipboard.writeText(generatedCode.value)
  alert('Код скопирован')
}

// --- Автообновление (перезапуск звука при изменении параметров) ---
let debounceTimer = null
function scheduleRestart() {
  if (!soundNodes) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    stopSound()
    playSound()
    debounceTimer = null
  }, 100)
}
watch(() => params.common, () => scheduleRestart(), { deep: true })
watch(() => params.step, () => scheduleRestart(), { deep: true })
watch(() => params['gate-motor'], () => scheduleRestart(), { deep: true })
watch(() => params['car-engine'], () => scheduleRestart(), { deep: true })
watch(() => params.horn, () => scheduleRestart(), { deep: true })
watch(() => params.ui, () => scheduleRestart(), { deep: true })
watch(() => params['wicket-creak'], () => scheduleRestart(), { deep: true })
watch(() => params.effects, () => scheduleRestart(), { deep: true })
watch(currentType, () => scheduleRestart())

// --- Жизненный цикл ---
onMounted(async () => {
  // Инициализируем контекст, но не разблокируем до клика
  await initCtx()
  loadDefaultImpulse('small')
  // Кнопка «Разрешить звук» появится, пользователь нажмёт её сам
})

onBeforeUnmount(() => {
  if (animationId) cancelAnimationFrame(animationId)
  stopSound()
  if (ctx) ctx.close()
})
</script>