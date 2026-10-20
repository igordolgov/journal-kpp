# -*- coding: utf-8 -*-
# Патчер: (1) остаточные зависания вошедших — взаимная блокировка mateAhead,
# предохранитель post-gate, очистка трекера; (2) броня gameLoop + окно смены
# при каждом запуске; (3) автозакрытие предыдущей смены при принятии новой;
# (4) надписи JournalSidebar: Вышел/Вошел/Выехал/Въехал.
# CRLF-safe: все замены с \r\n, guard count==1.
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
fails = []

def patch(rel, replacements):
    p = ROOT / rel
    raw = p.read_bytes()
    crlf_before = raw.count(b'\r\n')
    lf_only_before = raw.count(b'\n') - crlf_before
    text = raw.decode('utf-8')
    local_fail = False
    for old, new, label in replacements:
        n = text.count(old)
        if n != 1:
            fails.append(f"[{rel}] {label}: найдено {n} вхождений (ожидалось 1)")
            local_fail = True
            continue
        text = text.replace(old, new)
    crlf_after = text.count('\r\n')
    lf_only_after = text.count('\n') - crlf_after
    # Инвариант: тип концовок не смешивается. Было 0 LF-only (CRLF-файл) —
    # и осталось 0; количество CRLF законно растёт от добавленных строк.
    if lf_only_before != 0 or lf_only_after != 0:
        fails.append(f"[{rel}] CRLF сломан: LF-only было {lf_only_before}, стало {lf_only_after}")
        return
    if local_fail:
        return
    p.write_bytes(text.encode('utf-8'))
    print(f"OK  {rel}  CRLF={crlf_after} LF-only={lf_only_after}")

# ============ 1) useSimulatorPhysics.ts ============
PHYS = 'app/composables/simulator/useSimulatorPhysics.ts'

phys_r1_old = (
"            const mateAhead = aiAgents.value.some(o => {\r\n"
"              if (o.id === agent.id || o.type !== agent.type || o.direction !== agent.direction || o.state === 'done') return false\r\n"
"              const ox = o.element.x + o.element.width / 2 - cx0\r\n"
)
phys_r1_new = (
"            const mateAhead = aiAgents.value.some(o => {\r\n"
"              if (o.id === agent.id || o.type !== agent.type || o.direction !== agent.direction || o.state === 'done') return false\r\n"
"              // [ФИКС-взаимная-блокировка] «свой» впереди — законная причина\r\n"
"              // ждать, только если он реально движется или стоит у прохода\r\n"
"              // (waiting_before). Два СТОЯЩИХ агента с пересекающимися целями\r\n"
"              // иначе спасают друг друга вечно: каждый в конусе другого.\r\n"
"              if (o.state !== 'waiting_before' && (o.element.velocity || 0) <= 0.5) return false\r\n"
"              const ox = o.element.x + o.element.width / 2 - cx0\r\n"
)

phys_r2_old = "  const waitAfterByAgentId = new Map<string, number>()\r\n"
phys_r2_new = (
"  const waitAfterByAgentId = new Map<string, number>()\r\n"
"  // [ФИКС-висяки-3] жёсткий предохранитель фазы ПОСЛЕ прохода: суммарное\r\n"
"  // время агента в crossing + moving_away. Штатно это секунды (плюс ~1 мин\r\n"
"  // хода за край у медленного пешехода); превышение лимита означает\r\n"
"  // зависание, которое не поймал сторож, — агент принудительно завершается\r\n"
"  // (телепорт на afterTarget/за край -> done -> штатный деспавн).\r\n"
"  const postGateTrack = new Map<string, number>()\r\n"
"  const POST_GATE_MAX = simOpts.postGateMax ?? 90   // сек\r\n"
)

phys_r3_old = "        waitAfterByAgentId.delete(agent.id) // [ФИКС-висяки-2] без утечек\r\n"
phys_r3_new = (
"        waitAfterByAgentId.delete(agent.id) // [ФИКС-висяки-2] без утечек\r\n"
"        postGateTrack.delete(agent.id) // [ФИКС-висяки-3] без утечек\r\n"
)

phys_r4_old = (
"        if (agent.state !== 'waiting_after') waitAfterByAgentId.delete(agent.id)\r\n"
"        continue\r\n"
"      }\r\n"
"\r\n"
"      const cx = el.x + el.width / 2\r\n"
)
phys_r4_new = (
"        if (agent.state !== 'waiting_after') waitAfterByAgentId.delete(agent.id)\r\n"
"        continue\r\n"
"      }\r\n"
"\r\n"
"      // [ФИКС-висяки-3] предохранитель фазы после прохода: crossing и\r\n"
"      // moving_away суммарно дольше POST_GATE_MAX — принудительное\r\n"
"      // завершение (деспавн за краем освобождает слот лимита агентов)\r\n"
"      if (agent.state === 'crossing' || agent.state === 'moving_away') {\r\n"
"        const gateAge = (postGateTrack.get(agent.id) ?? 0) + dt\r\n"
"        postGateTrack.set(agent.id, gateAge)\r\n"
"        if (gateAge >= POST_GATE_MAX) {\r\n"
"          const atF = agent.afterTarget\r\n"
"          if (Number.isFinite(atF?.x) && Number.isFinite(atF?.y)) {\r\n"
"            el.x = atF.x - el.width / 2\r\n"
"            el.y = atF.y - el.height / 2\r\n"
"          } else {\r\n"
"            el.x = (el.x < sceneSize.value.width / 2)\r\n"
"              ? -DESPAWN_MARGIN - el.width\r\n"
"              : sceneSize.value.width + DESPAWN_MARGIN\r\n"
"          }\r\n"
"          el.velocity = 0\r\n"
"          agent.state = 'done'\r\n"
"          postGateTrack.delete(agent.id)\r\n"
"          continue\r\n"
"        }\r\n"
"      } else if (agent.state === 'to_gate') {\r\n"
"        postGateTrack.delete(agent.id)\r\n"
"      }\r\n"
"\r\n"
"      const cx = el.x + el.width / 2\r\n"
)

# ============ 2) SimulatorWidget.vue ============
WIDGET = 'app/components/SimulatorWidget.vue'

widget_r1_old = (
"const gameLoop = (timestamp: number) => {\r\n"
"  if (!props.isRunning) return\r\n"
"  const dt = Math.min((timestamp - lastTime) / 1000, 0.1)\r\n"
"  lastTime = timestamp\r\n"
"  const cfg = getTrafficConfig()\r\n"
"  // [ФИКС-ЗАСТРЯНИЕ] сторож ворот: лечит зависшие isAnimating/isOpen\r\n"
"  core.updateGateWatchdog(dt)\r\n"
"  if (cfg.enabled) {\r\n"
"    spawn.updateSpawnLogic(dt, cfg, allPeople.value.length > 0, cfg.maxAgents)\r\n"
"    physics.updateAiMovement(dt, { carGateId: cfg.carGateId, personGateId: cfg.personGateId })\r\n"
"    scriptsHandler.processScriptLogic(dt)\r\n"
"    scriptsHandler.updateActiveCommands(dt)\r\n"
"  }\r\n"
"  updateAllAudio(dt)\r\n"
"  animationFrameId = requestAnimationFrame(gameLoop)\r\n"
"}\r\n"
)
widget_r1_new = (
"const gameLoop = (timestamp: number) => {\r\n"
"  if (!props.isRunning) return\r\n"
"  const dt = Math.min((timestamp - lastTime) / 1000, 0.1)\r\n"
"  lastTime = timestamp\r\n"
"  // [ФИКС-ЗАСТРЯНИЕ] броня игрового цикла: ЛЮБОЕ исключение в подсистеме\r\n"
"  // (спавн/физика/скрипты/аудио) раньше убивало rAF-цикл навсегда — вся\r\n"
"  // сцена замирала («зависают вошедшие люди»), а сторожа внутри физики\r\n"
"  // не спасали, потому что физика тоже больше не вызывалась. Каждый шаг\r\n"
"  // изолирован; requestAnimationFrame вне try — кадр всегда перевыстраивается.\r\n"
"  try {\r\n"
"    const cfg = getTrafficConfig()\r\n"
"    // [ФИКС-ЗАСТРЯНИЕ] сторож ворот: лечит зависшие isAnimating/isOpen\r\n"
"    core.updateGateWatchdog(dt)\r\n"
"    if (cfg.enabled) {\r\n"
"      try {\r\n"
"        spawn.updateSpawnLogic(dt, cfg, allPeople.value.length > 0, cfg.maxAgents)\r\n"
"      } catch (e) { console.error('[gameLoop] спавн:', e) }\r\n"
"      try {\r\n"
"        physics.updateAiMovement(dt, { carGateId: cfg.carGateId, personGateId: cfg.personGateId })\r\n"
"      } catch (e) { console.error('[gameLoop] физика:', e) }\r\n"
"      try { scriptsHandler.processScriptLogic(dt) } catch (e) { console.error('[gameLoop] скрипты:', e) }\r\n"
"      try { scriptsHandler.updateActiveCommands(dt) } catch (e) { console.error('[gameLoop] команды:', e) }\r\n"
"    }\r\n"
"    try { updateAllAudio(dt) } catch (e) { console.error('[gameLoop] аудио:', e) }\r\n"
"  } catch (e) {\r\n"
"    console.error('[gameLoop] кадр:', e)\r\n"
"  }\r\n"
"  animationFrameId = requestAnimationFrame(gameLoop)\r\n"
"}\r\n"
)

widget_r2_old = (
"  // [СМЕНА] старт без принятой смены — показать напоминание (показывается\r\n"
"  // при каждом открытии симулятора, пока смена не принята)\r\n"
"  try {\r\n"
"    await loadCurrentShift()\r\n"
"    if (!currentShift.value) shiftWarningOpen.value = true\r\n"
"  } catch (e) {\r\n"
"    console.warn('[SimulatorWidget] не удалось проверить смену:', e)\r\n"
"  }\r\n"
)
widget_r2_new = (
"  // [СМЕНА] при КАЖДОМ запуске симулятора смена считается непринятой:\r\n"
"  // окно «Смена не принята» всплывает всегда, пока охранник не нажмёт\r\n"
"  // «Принять смену». loadCurrentShift лишь освежает данные активной смены.\r\n"
"  try {\r\n"
"    await loadCurrentShift()\r\n"
"  } catch (e) {\r\n"
"    console.warn('[SimulatorWidget] не удалось проверить смену:', e)\r\n"
"  }\r\n"
"  shiftWarningOpen.value = true\r\n"
)

# ============ 3) useShift.ts ============
SHIFT = 'app/composables/useShift.ts'

shift_r1_old = (
"  const startShift = async (guardName: string) => {\r\n"
"    if (!guardName.trim()) throw new Error('Введите имя охранника')\r\n"
"\r\n"
"    const now = Date.now()\r\n"
)
shift_r1_new = (
"  const startShift = async (guardName: string) => {\r\n"
"    if (!guardName.trim()) throw new Error('Введите имя охранника')\r\n"
"\r\n"
"    // [СМЕНА] «Принять смену» при незакрытой предыдущей: предыдущая\r\n"
"    // закрывается автоматически. Иначе в store 'shifts' копятся вечные\r\n"
"    // активные смены — loadCurrentShift берёт первую без end_time, и\r\n"
"    // фактически принятая смена «не считается» принятой.\r\n"
"    if (currentShift.value && !currentShift.value.end_time) {\r\n"
"      try {\r\n"
"        await updateItem('shifts', {\r\n"
"          ...currentShift.value,\r\n"
"          end_time: Date.now(),\r\n"
"          notes: currentShift.value.notes || 'Автозакрытие при принятии новой смены'\r\n"
"        })\r\n"
"      } catch (e) {\r\n"
"        console.error('[useShift] не удалось закрыть предыдущую смену:', e)\r\n"
"      }\r\n"
"    }\r\n"
"\r\n"
"    const now = Date.now()\r\n"
)

# ============ 4) JournalSidebar.vue ============
SIDEBAR = 'app/components/JournalSidebar.vue'

sidebar_r1_old = (
"const actionButtonLabel = computed(() => {\r\n"
"  if (isResidentInside.value || isGuestInside.value) return 'Выезд'\r\n"
"  if (isResidentOutside.value || isGuestOutside.value) return 'Въезд'\r\n"
"  return 'Действие'\r\n"
"})\r\n"
)
sidebar_r1_new = (
"// [НАДПИСИ] кнопка поездки на машине — глагол прошедшего времени, как в\r\n"
"// журнале: выехал/въехал (пешие варианты — в walkingButtonLabel)\r\n"
"const actionButtonLabel = computed(() => {\r\n"
"  if (isResidentInside.value || isGuestInside.value) return 'Выехал'\r\n"
"  if (isResidentOutside.value || isGuestOutside.value) return 'Въехал'\r\n"
"  return 'Действие'\r\n"
"})\r\n"
)

sidebar_r2_old = (
"const walkingButtonLabel = computed(() => {\r\n"
"  const isExit = isResidentInside.value || isGuestInside.value\r\n"
"  const isEnter = isResidentOutside.value || isGuestOutside.value\r\n"
"  const isGuest = !isResident.value\r\n"
"\r\n"
"  if (isExit) {\r\n"
"    const base = isGuest\r\n"
"      ? (totalPeopleCount.value > 1 ? 'Уехали' : 'Уехал')\r\n"
"      : (totalPeopleCount.value > 1 ? 'Вышли' : 'Вышел')\r\n"
"    return `${base} (${totalPeopleCount.value})`\r\n"
"  } else if (isEnter) {\r\n"
"    const base = isGuest\r\n"
"      ? (totalPeopleCount.value > 1 ? 'Пришли' : 'Пришёл')\r\n"
"      : (totalPeopleCount.value > 1 ? 'Вошли' : 'Вошел')\r\n"
"    return `${base} (${totalPeopleCount.value})`\r\n"
"  }\r\n"
"  return `Действие (${totalPeopleCount.value})`\r\n"
"})\r\n"
)
sidebar_r2_new = (
"// [НАДПИСИ] пеший проход — только каноничные варианты: вышел/вышли (выход)\r\n"
"// и вошел/вошли (вход), для резидента и гостя одинаково, с числом людей\r\n"
"const walkingButtonLabel = computed(() => {\r\n"
"  const isExit = isResidentInside.value || isGuestInside.value\r\n"
"  const isEnter = isResidentOutside.value || isGuestOutside.value\r\n"
"\r\n"
"  if (isExit) {\r\n"
"    const base = totalPeopleCount.value > 1 ? 'Вышли' : 'Вышел'\r\n"
"    return `${base} (${totalPeopleCount.value})`\r\n"
"  } else if (isEnter) {\r\n"
"    const base = totalPeopleCount.value > 1 ? 'Вошли' : 'Вошел'\r\n"
"    return `${base} (${totalPeopleCount.value})`\r\n"
"  }\r\n"
"  return `Действие (${totalPeopleCount.value})`\r\n"
"})\r\n"
)

patch(PHYS, [
    (phys_r1_old, phys_r1_new, 'mateAhead взаимная блокировка'),
    (phys_r2_old, phys_r2_new, 'postGateTrack объявление'),
    (phys_r3_old, phys_r3_new, 'postGateTrack очистка при деспавне'),
    (phys_r4_old, phys_r4_new, 'post-gate предохранитель в цикле'),
])
patch(WIDGET, [
    (widget_r1_old, widget_r1_new, 'броня gameLoop'),
    (widget_r2_old, widget_r2_new, 'окно смены при каждом запуске'),
])
patch(SHIFT, [
    (shift_r1_old, shift_r1_new, 'автозакрытие предыдущей смены'),
])
patch(SIDEBAR, [
    (sidebar_r1_old, sidebar_r1_new, 'Выехал/Въехал'),
    (sidebar_r2_old, sidebar_r2_new, 'Вышел/Вошел унификация'),
])

if fails:
    print('ПРОВАЛЫ:')
    for f in fails:
        print(' -', f)
    sys.exit(1)
print('Все замены применены.')
