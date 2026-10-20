# -*- coding: utf-8 -*-
# [ФИКС-флуд-4 + ДИАГНОСТИКА]
# 1) app/utils/simTuning.ts — НОВЫЙ файл: чистая санитизация интервалов.
# 2) SimulatorWidget.vue — дефолты 60-120с (пешие) / 90-180с (авто),
#    полы 45/60с, плейсхолдеры.
# 3) useSimulatorSpawn.ts — пассажиры реже (0.3) и мельче (1-2).
# 4) useSimulatorPhysics.ts — console.warn на всех спасательных ветках.
# CRLF-репозиторий: байтовые замены \r\n, guard count==1.

import sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def readb(p):
    with open(p, 'rb') as f:
        return f.read()

def writeb(p, data):
    with open(p, 'wb') as f:
        f.write(data)

def patch(path, replacements):
    full = os.path.join(ROOT, path)
    data = readb(full)
    crlf = data.count(b'\r\n')
    print(f"{path}: {crlf} CRLF / {data.count(chr(10).encode())-crlf} LF-only (before)")
    for i, (old, new) in enumerate(replacements):
        old_b = old.replace('\n', '\r\n').encode('utf-8')
        new_b = new.replace('\n', '\r\n').encode('utf-8')
        cnt = data.count(old_b)
        if cnt != 1:
            print(f"  [{i}] GUARD FAIL: {cnt} occurrences"); sys.exit(1)
        data = data.replace(old_b, new_b)
        print(f"  [{i}] ok")
    writeb(full, data)
    d2 = readb(full)
    c2 = d2.count(b'\r\n')
    print(f"{path}: {c2} CRLF / {d2.count(chr(10).encode())-c2} LF-only (after)")

# ------------------------------------------------------- simTuning.ts (NEW)
TUNING = 'app/utils/simTuning.ts'
tuning_content = """// app/utils/simTuning.ts
// Назначение: санитизация интервалов спавна симулятора — чистая функция,
// покрыта юнит-тестами (tests/sim-tuning.test.ts). Пол не даёт старым
// сценам и ручному вводу душить ручной журнал, потолок отсекает
// бессмысленные значения, максимум держится минимум на 15с выше
// минимума (иначе getNextInterval(min, max) даёт перевёрнутый диапазон).

export interface SpawnInterval {
  min: number
  max: number
}

export const sanitizeSpawnInterval = (
  rawMin: unknown,
  rawMax: unknown,
  floor: number,
  capMin: number,
  fallbackMin: number,
  fallbackMax: number,
): SpawnInterval => {
  const nMin = Number(rawMin)
  const nMax = Number(rawMax)
  let min = Number.isFinite(nMin) && nMin > 0 ? nMin : fallbackMin
  let max = Number.isFinite(nMax) && nMax > 0 ? nMax : fallbackMax
  min = Math.min(capMin, Math.max(floor, min))
  max = Math.min(capMin + 150, Math.max(min + 15, max))
  return { min, max }
}
"""

if not os.path.exists(os.path.join(ROOT, TUNING)):
    writeb(os.path.join(ROOT, TUNING), tuning_content.replace('\n', '\r\n').encode('utf-8'))
    print(f"{TUNING}: created (CRLF)")
else:
    print(f"{TUNING}: already exists, skipped")

# ---------------------------------------------------------------- widget
WIDGET = 'app/components/SimulatorWidget.vue'
widget_reps = []

widget_reps.append((
"""// [ФИКС-НАСТРОЙКИ] сохранение настроек поповера симулятора между запусками
import { loadWidgetSettings, saveWidgetSettings } from '~/utils/widgetSettings'
""",
"""// [ФИКС-НАСТРОЙКИ] сохранение настроек поповера симулятора между запусками
import { loadWidgetSettings, saveWidgetSettings } from '~/utils/widgetSettings'
// [ФИКС-флуд-4] чистая санитизация интервалов спавна
import { sanitizeSpawnInterval } from '~/utils/simTuning'
"""))

widget_reps.append((
"""  // [ФИКС-флуд-3] темп поднят: два пеших потока по 25-60с давали нового
  // пешехода в среднем каждые ~10с — ручной журнал не успевал. Новые
  // дефолты 40-90с, пол 30с (старые сцены с агрессивными интервалами),
  // потолок минимума 150с, максимум расширен до 300с.
  const rawPMin = Number(userPersonIntervalMin.value ?? st.intervalMin ?? st.spawnIntervalMin ?? props.simSettings?.spawnIntervalMin ?? 40) || 40
  const rawPMax = Number(userPersonIntervalMax.value ?? st.intervalMax ?? st.spawnIntervalMax ?? props.simSettings?.spawnIntervalMax ?? 90) || 90
  const personIntervalMin = Math.min(150, Math.max(30, rawPMin))
  const personIntervalMax = Math.min(300, Math.max(personIntervalMin + 15, rawPMax))
""",
"""  // [ФИКС-флуд-4] темп снижен ещё вдвое: пешие 60-120с (было 40-90с),
  // пол 45с, потолок минимума 150с, максимум до 300с. Санитизация —
  // чистая функция sanitizeSpawnInterval (tests/sim-tuning.test.ts).
  const person = sanitizeSpawnInterval(
    userPersonIntervalMin.value ?? st.intervalMin ?? st.spawnIntervalMin ?? props.simSettings?.spawnIntervalMin,
    userPersonIntervalMax.value ?? st.intervalMax ?? st.spawnIntervalMax ?? props.simSettings?.spawnIntervalMax,
    45, 150, 60, 120,
  )
"""))

widget_reps.append((
"""    intervalMin: personIntervalMin,
    intervalMax: personIntervalMax,
""",
"""    intervalMin: person.min,
    intervalMax: person.max,
"""))

widget_reps.append((
"""// [ФИКС-флуд-3] интервалы машин тоже санитарны: раньше шли в спавн как есть
// (поповер допускает 1с, старые сцены — любые значения), поток машин душит
// ручной журнал. Дефолты подняты 30-60 -> 60-120с, пол 45с, потолок 300с.
const simOpts = computed(() => {
  const rawCarMin = Number(userCarIntervalMin.value ?? props.simSettings?.carSpawnIntervalMin ?? 60) || 60
  const rawCarMax = Number(userCarIntervalMax.value ?? props.simSettings?.carSpawnIntervalMax ?? 120) || 120
  const carMin = Math.min(180, Math.max(45, rawCarMin))
  return {
    ...props.simSettings,
    maxGroupSize: userMaxGroupSize.value ?? 4,
    maxNonFamily: userMaxNonFamily.value ?? 1,
    personWidth: PERSON_WIDTH,
    personHeight: PERSON_HEIGHT,
    carWidth: CAR_WIDTH,
    carHeight: CAR_HEIGHT,
    carSpawnIntervalMin: carMin,
    carSpawnIntervalMax: Math.min(300, Math.max(carMin + 15, rawCarMax)),
  }
})
""",
"""// [ФИКС-флуд-4] интервалы машин: дефолт 90-180с (было 60-120с), пол 60с,
// потолок минимума 180с. Санитизация — чистая функция
// sanitizeSpawnInterval (tests/sim-tuning.test.ts).
const simOpts = computed(() => {
  const car = sanitizeSpawnInterval(
    userCarIntervalMin.value ?? props.simSettings?.carSpawnIntervalMin,
    userCarIntervalMax.value ?? props.simSettings?.carSpawnIntervalMax,
    60, 180, 90, 180,
  )
  return {
    ...props.simSettings,
    maxGroupSize: userMaxGroupSize.value ?? 4,
    maxNonFamily: userMaxNonFamily.value ?? 1,
    personWidth: PERSON_WIDTH,
    personHeight: PERSON_HEIGHT,
    carWidth: CAR_WIDTH,
    carHeight: CAR_HEIGHT,
    carSpawnIntervalMin: car.min,
    carSpawnIntervalMax: car.max,
  }
})
"""))

widget_reps.append((
"""            input.input.input-xs.w-16(type="number" v-model.number="userPersonIntervalMin" min="30" placeholder="40")
            input.input.input-xs.w-16(type="number" v-model.number="userPersonIntervalMax" min="30" placeholder="90")
""",
"""            input.input.input-xs.w-16(type="number" v-model.number="userPersonIntervalMin" min="45" placeholder="60")
            input.input.input-xs.w-16(type="number" v-model.number="userPersonIntervalMax" min="45" placeholder="120")
"""))

widget_reps.append((
"""            input.input.input-xs.w-16(type="number" v-model.number="userCarIntervalMin" min="45" placeholder="60")
            input.input.input-xs.w-16(type="number" v-model.number="userCarIntervalMax" min="45" placeholder="120")
""",
"""            input.input.input-xs.w-16(type="number" v-model.number="userCarIntervalMin" min="60" placeholder="90")
            input.input.input-xs.w-16(type="number" v-model.number="userCarIntervalMax" min="60" placeholder="180")
"""))

# ----------------------------------------------------------------- spawn
SPAWN = 'app/composables/simulator/useSimulatorSpawn.ts'
spawn_reps = [
(
"""      const hasPassengers = Math.random() < 0.5
      let passengers: any[] = []
      if (hasPassengers) {
        const count = Math.floor(Math.random() * 4) + 1
""",
"""      // [ФИКС-флуд-4] пассажиры реже и мельче: машина с 3-4 пассажирами
      // = 4-5 журнальных записей разом, при ручном журнале не успевать
      const hasPassengers = Math.random() < 0.3
      let passengers: any[] = []
      if (hasPassengers) {
        const count = Math.floor(Math.random() * 2) + 1
"""),
]

# --------------------------------------------------------------- physics
PHYSICS = 'app/composables/simulator/useSimulatorPhysics.ts'
physics_reps = []

# 1. Телепорт сторожа
physics_reps.append((
"""            if (!mateAhead) {
              // [WATCHDOG] дистанция в физике считается центр-к-центру,
""",
"""            if (!mateAhead) {
              console.warn('[watchdog] агент стоял', STALL_LIMIT, 'с — телепорт на цель:', agent.state, agent.id)
              // [WATCHDOG] дистанция в физике считается центр-к-центру,
"""))

# 2. NaN-цель
physics_reps.append((
"""          // Восстанавливаем конечную цель из afterTarget или выталкиваем за
          // ближайший боковой край (штатный деспавн за границей сцены).
          const at = agent.afterTarget
""",
"""          // Восстанавливаем конечную цель из afterTarget или выталкиваем за
          // ближайший боковой край (штатный деспавн за границей сцены).
          console.warn('[watchdog] NaN-цель — восстановление из afterTarget:', agent.id)
          const at = agent.afterTarget
"""))

# 3. Crossing cap
physics_reps.append((
"""          if (crossAge >= crossLimit) {
            const exitT = (agent.exitPoint && Number.isFinite(agent.exitPoint.x) && Number.isFinite(agent.exitPoint.y))
""",
"""          if (crossAge >= crossLimit) {
            console.warn('[crossing-cap] crossing дольше', crossLimit, 'с — перенос в конец прохода:', agent.type, agent.id)
            const exitT = (agent.exitPoint && Number.isFinite(agent.exitPoint.x) && Number.isFinite(agent.exitPoint.y))
"""))

# 4. Post-gate cap
physics_reps.append((
"""        if (gateAge >= POST_GATE_MAX) {
          const atF = agent.afterTarget
""",
"""        if (gateAge >= POST_GATE_MAX) {
          console.warn('[post-gate-cap] агент завершён принудительно:', agent.state, agent.id)
          const atF = agent.afterTarget
"""))

# 5. Direction queue fuse
physics_reps.append((
"""      if (bt >= DIR_BLOCK_MAX) {
        dirBlockByAgentId.delete(agent.id)
        return false
      }
""",
"""      if (bt >= DIR_BLOCK_MAX) {
        console.warn('[direction-queue] предохранитель', DIR_BLOCK_MAX, 'с — проходим принудительно:', agent.id)
        dirBlockByAgentId.delete(agent.id)
        return false
      }
"""))

# 6. Missing gate
physics_reps.append((
"""          if (missingWait >= (agent.isLeader || !agent.groupId ? FORCE_CROSS_AFTER : FORCE_CROSS_GROUP_AFTER)) {
            waitOpenByAgentId.delete(agent.id)
            startCrossing(agent)
          }
""",
"""          if (missingWait >= (agent.isLeader || !agent.groupId ? FORCE_CROSS_AFTER : FORCE_CROSS_GROUP_AFTER)) {
            console.warn('[gate-missing] ворот нет — принудительный проход:', agent.id)
            waitOpenByAgentId.delete(agent.id)
            startCrossing(agent)
          }
"""))

if __name__ == '__main__':
    patch(WIDGET, widget_reps)
    patch(SPAWN, spawn_reps)
    patch(PHYSICS, physics_reps)
    print("OK: all replacements applied")
