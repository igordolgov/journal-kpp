# -*- coding: utf-8 -*-
# [ФИКС-ДЁРГАНИЕ] is-paused c гистерезисом.
# Проблема: класс is-paused (пауза CSS-анимаций рук/ног/корпуса человека)
# вычислялся в шаблоне как velocity < 0.1 без гистерезиса. Контроллер
# «стой/иди» в очереди у прохода (0 <-> 0.8*leaderSpeed) гоняет скорость
# через порог 0.1 туда-сюда — класс мигает несколько раз в секунду, анимации
# замирают/возобновляются посреди цикла = видимое «подёргивание» людей
# при проходе через калитку.
# Фикс: флаг el.isPaused считает физика (пауза < 0.1, возобновление > 1.5,
# в полосе — без изменений), шаблон читает готовый флаг.
# CRLF-дисциплина: патч байтами, guard count==1 на каждую замену.

import sys

def patch(path, replacements):
    with open(path, 'rb') as f:
        data = f.read()
    for i, (old, new) in enumerate(replacements):
        cnt = data.count(old)
        if cnt != 1:
            print(f"FAIL {path} replacement #{i}: count={cnt} (ожидался 1)")
            sys.exit(1)
        data = data.replace(old, new)
    with open(path, 'wb') as f:
        f.write(data)
    print(f"OK {path}: {len(replacements)} замен(ы)")

def lines(text, eol):
    # strip('\n') убирает пустые края triple-quote: паттерн = чистые строки
    # без граничных EOL, замена встраивается между существующими строками
    return eol.join(s.encode('utf-8') for s in text.strip('\n').split('\n'))

CRLF = b'\r\n'
LF = b'\n'

# ---------- 1. useSimulatorPhysics.ts (CRLF) ----------
old1 = lines("""
    for (const agent of sorted) {
      const el = agent.element
""", CRLF)
new1 = lines("""
    for (const agent of sorted) {
      const el = agent.element
      // [ФИКС-ДЁРГАНИЕ] флаг is-paused с гистерезисом для анимации ходьбы.
      // Раньше шаблон вычислял его как velocity < 0.1: контроллер «стой/иди»
      // в очереди у прохода (0 <-> 0.8*leaderSpeed) гоняет скорость через
      // порог 0.1 туда-сюда, класс мигает, и CSS-анимации рук/ног/корпуса
      // замирают и возобновляются посреди цикла — видимое «подёргивание»
      // людей при проходе через калитку.
      // Пауза ниже 0.1, возобновление только выше 1.5; в полосе между
      // порогами флаг НЕ меняется. Считается на каждом кадре для всех
      // состояний, поэтому стоящие агенты тоже получают паузу.
      if ((el.velocity || 0) < 0.1) el.isPaused = true
      else if ((el.velocity || 0) > 1.5) el.isPaused = false
""", CRLF)

# ---------- 2. SimulatorWidget.vue (CRLF) ----------
old2 = lines("""            :class="{ 'is-paused': (el.velocity || 0) < 0.1, 'is-exit': el.direction === 'exit' }"
""", CRLF)
new2 = lines("""            :class="{ 'is-paused': el.isPaused ?? ((el.velocity || 0) < 0.1), 'is-exit': el.direction === 'exit' }"
""", CRLF)

# ---------- 3. types/simulator.ts (LF!) ----------
old3 = lines("""
  velocity?: number
  zIndex?: number
""", LF)
new3 = lines("""
  velocity?: number
  // [ФИКС-ДЁРГАНИЕ] считается физикой с гистерезисом (пауза < 0.1, пуск > 1.5)
  isPaused?: boolean
  zIndex?: number
""", LF)

patch('app/composables/simulator/useSimulatorPhysics.ts', [(old1, new1)])
patch('app/components/SimulatorWidget.vue', [(old2, new2)])
patch('app/types/simulator.ts', [(old3, new3)])
print("ALL PATCHES APPLIED")
