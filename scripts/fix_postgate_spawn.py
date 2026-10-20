# -*- coding: utf-8 -*-
# [ФИКС-застыл-калитка + ФИКС-флуд-3]
# 1) useSimulatorPhysics.ts: предохранитель фазы crossing (15с пешеход /
#    25с машина) + исключение «очереди за своим» только для to_gate.
# 2) SimulatorWidget.vue: подняты дефолты интервалов спавна (пешие 40-90,
#    авто 60-120), полы 30/45с, санитизация интервалов машин, плейсхолдеры.
# CRLF-репозиторий: все замены байтами, \r\n, guard count==1.

import sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def patch(path, replacements):
    full = os.path.join(ROOT, path)
    with open(full, 'rb') as f:
        data = f.read()
    crlf = data.count(b'\r\n')
    lf_only = data.count(b'\n') - crlf
    print(f"{path}: {crlf} CRLF / {lf_only} LF-only (before)")
    for i, (old, new) in enumerate(replacements):
        old_b = old.replace('\n', '\r\n').encode('utf-8')
        new_b = new.replace('\n', '\r\n').encode('utf-8')
        cnt = data.count(old_b)
        if cnt != 1:
            print(f"  [{i}] GUARD FAIL: found {cnt} occurrences (expected 1)")
            print(f"      old head: {old_b[:90]!r}")
            sys.exit(1)
        data = data.replace(old_b, new_b)
        print(f"  [{i}] replaced ok")
    with open(full, 'wb') as f:
        f.write(data)
    with open(full, 'rb') as f:
        check = f.read()
    crlf2 = check.count(b'\r\n')
    lf_only2 = check.count(b'\n') - crlf2
    print(f"{path}: {crlf2} CRLF / {lf_only2} LF-only (after)")

# ---------------------------------------------------------------- physics
PHYSICS = 'app/composables/simulator/useSimulatorPhysics.ts'

physics_reps = []

# 1. Константы лимита crossing рядом с POST_GATE_MAX
physics_reps.append((
"""  const postGateTrack = new Map<string, number>()
  const POST_GATE_MAX = simOpts.postGateMax ?? 90   // сек
""",
"""  const postGateTrack = new Map<string, number>()
  const POST_GATE_MAX = simOpts.postGateMax ?? 90   // сек
  // [ФИКС-застыл-калитка] предохранитель фазы crossing: проход штатно
  // занимает секунды, а застрявший ПОСЛЕ калитки агент — самый заметный
  // («вошёл и замер»). Лимит жёстче пост-гатового: по истечении агент
  // переносится в конец прохода, и штатный блок прибытия доводит цепочку
  // (moving_away / waiting_after -> done -> деспавн).
  const crossTrack = new Map<string, number>()
  const CROSS_MAX_PERSON = 15   // сек
  const CROSS_MAX_CAR = 25      // сек
"""))

# 2. Очистка crossTrack при деспавне
physics_reps.append((
"""        postGateTrack.delete(agent.id) // [ФИКС-висяки-3] без утечек
""",
"""        postGateTrack.delete(agent.id) // [ФИКС-висяки-3] без утечек
        crossTrack.delete(agent.id) // [ФИКС-застыл-калитка] без утечек
"""))

# 3. Исключение очереди — только для to_gate
physics_reps.append((
"""            const mateAhead = aiAgents.value.some(o => {
""",
"""            // [ФИКС-застыл-калитка] исключение «очереди за своим» — только
            // для to_gate: у прохода ждать своего законно. В crossing/
            // moving_away стоячих мест нет: раньше застрявший в проходе
            // агент вечно «ждал» идущего впереди и не спасался сторожем.
            const mateAhead = agent.state === 'to_gate' && aiAgents.value.some(o => {
"""))

# 4. Лимит crossing в пост-гатовом блоке
physics_reps.append((
"""      if (agent.state === 'crossing' || agent.state === 'moving_away') {
        const gateAge = (postGateTrack.get(agent.id) ?? 0) + dt
        postGateTrack.set(agent.id, gateAge)
        if (gateAge >= POST_GATE_MAX) {
""",
"""      if (agent.state === 'crossing' || agent.state === 'moving_away') {
        const gateAge = (postGateTrack.get(agent.id) ?? 0) + dt
        postGateTrack.set(agent.id, gateAge)
        // [ФИКС-застыл-калитка] crossing дольше CROSS_MAX_* — принудительный
        // перенос в конец прохода (exitPoint, при мусорной цели — target);
        // штатный блок прибытия ниже доведёт состояние до moving_away /
        // waiting_after сам, без смены семантики прохода
        if (agent.state === 'crossing') {
          const crossAge = (crossTrack.get(agent.id) ?? 0) + dt
          crossTrack.set(agent.id, crossAge)
          const crossLimit = agent.type === 'car' ? CROSS_MAX_CAR : CROSS_MAX_PERSON
          if (crossAge >= crossLimit) {
            const exitT = (Number.isFinite(agent.exitPoint?.x) && Number.isFinite(agent.exitPoint?.y))
              ? agent.exitPoint
              : agent.target
            if (Number.isFinite(exitT?.x) && Number.isFinite(exitT?.y)) {
              el.x = exitT.x - el.width / 2
              el.y = exitT.y - el.height / 2
            }
            el.velocity = 0
            crossTrack.delete(agent.id)
          }
        } else {
          crossTrack.delete(agent.id)
        }
        if (gateAge >= POST_GATE_MAX) {
"""))

# ----------------------------------------------------------------- widget
WIDGET = 'app/components/SimulatorWidget.vue'

widget_reps = []

# 5. simOpts: санитизация интервалов машин + новые дефолты
widget_reps.append((
"""const simOpts = computed(() => ({
  ...props.simSettings,
  maxGroupSize: userMaxGroupSize.value ?? 4,
  maxNonFamily: userMaxNonFamily.value ?? 1,
  personWidth: PERSON_WIDTH,
  personHeight: PERSON_HEIGHT,
  carWidth: CAR_WIDTH,
  carHeight: CAR_HEIGHT,
  carSpawnIntervalMin: userCarIntervalMin.value ?? props.simSettings?.carSpawnIntervalMin ?? 30,
  carSpawnIntervalMax: userCarIntervalMax.value ?? props.simSettings?.carSpawnIntervalMax ?? 60,
}))
""",
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
"""))

# 6. getTrafficConfig: темп пешеходов поднят, пол 30с
widget_reps.append((
"""  const rawPMin = Number(userPersonIntervalMin.value ?? st.intervalMin ?? st.spawnIntervalMin ?? props.simSettings?.spawnIntervalMin ?? 25) || 25
  const rawPMax = Number(userPersonIntervalMax.value ?? st.intervalMax ?? st.spawnIntervalMax ?? props.simSettings?.spawnIntervalMax ?? 60) || 60
  const personIntervalMin = Math.min(120, Math.max(20, rawPMin))
  const personIntervalMax = Math.min(120, Math.max(personIntervalMin + 15, rawPMax))
""",
"""  // [ФИКС-флуд-3] темп поднят: два пеших потока по 25-60с давали нового
  // пешехода в среднем каждые ~10с — ручной журнал не успевал. Новые
  // дефолты 40-90с, пол 30с (старые сцены с агрессивными интервалами),
  // потолок минимума 150с, максимум расширен до 300с.
  const rawPMin = Number(userPersonIntervalMin.value ?? st.intervalMin ?? st.spawnIntervalMin ?? props.simSettings?.spawnIntervalMin ?? 40) || 40
  const rawPMax = Number(userPersonIntervalMax.value ?? st.intervalMax ?? st.spawnIntervalMax ?? props.simSettings?.spawnIntervalMax ?? 90) || 90
  const personIntervalMin = Math.min(150, Math.max(30, rawPMin))
  const personIntervalMax = Math.min(300, Math.max(personIntervalMin + 15, rawPMax))
"""))

# 7. Плейсхолдеры пешеходов
widget_reps.append((
"""            input.input.input-xs.w-16(type="number" v-model.number="userPersonIntervalMin" min="1" placeholder="25")
            input.input.input-xs.w-16(type="number" v-model.number="userPersonIntervalMax" min="1" placeholder="60")
""",
"""            input.input.input-xs.w-16(type="number" v-model.number="userPersonIntervalMin" min="30" placeholder="40")
            input.input.input-xs.w-16(type="number" v-model.number="userPersonIntervalMax" min="30" placeholder="90")
"""))

# 8. Плейсхолдеры машин
widget_reps.append((
"""            input.input.input-xs.w-16(type="number" v-model.number="userCarIntervalMin" min="1" placeholder="30")
            input.input.input-xs.w-16(type="number" v-model.number="userCarIntervalMax" min="1" placeholder="60")
""",
"""            input.input.input-xs.w-16(type="number" v-model.number="userCarIntervalMin" min="45" placeholder="60")
            input.input.input-xs.w-16(type="number" v-model.number="userCarIntervalMax" min="45" placeholder="120")
"""))

if __name__ == '__main__':
    patch(PHYSICS, physics_reps)
    patch(WIDGET, widget_reps)
    print("OK: all replacements applied")
