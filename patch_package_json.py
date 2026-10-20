# -*- coding: utf-8 -*-
"""
Патчер package.json для Journal KPP — добавляет тестовую инфраструктуру.

Добавляет:
  - скрипты  "test": "vitest run", "test:watch": "vitest"
  - devDeps: vitest ^4.0.1, happy-dom ^18.0.1

Безопасно: каждая вставка проверяется на повторный запуск (идемпотентно).
Запуск из корня проекта:  python patch_package_json.py
"""
import json, sys, os

PATH = 'package.json'

if not os.path.exists(PATH):
    print('[ОШИБКА] package.json не найден — запускайте из корня проекта D:\\journal-kpp')
    sys.exit(1)

raw = open(PATH, 'rb').read().decode('utf-8-sig')
crlf = '\r\n' in raw
NL = '\r\n' if crlf else '\n'

try:
    data = json.loads(raw)
except Exception as e:
    print(f'[ОШИБКА] package.json не читается как JSON: {e}')
    sys.exit(1)

changed = []

# 1. Скрипты test
scripts = data.setdefault('scripts', {})
if 'test' not in scripts:
    # вставляем test сразу после postinstall, если он есть
    if 'postinstall' in scripts:
        scripts_new = {}
        for k, v in scripts.items():
            scripts_new[k] = v
            if k == 'postinstall':
                scripts_new['test'] = 'vitest run'
                scripts_new['test:watch'] = 'vitest'
        data['scripts'] = scripts_new
    else:
        data['scripts'] = {'test': 'vitest run', 'test:watch': 'vitest', **scripts}
    changed.append('скрипты test / test:watch')
else:
    print('[OK] скрипт test уже есть')

# 2. devDependencies
dev = data.setdefault('devDependencies', {})
if 'vitest' not in dev:
    dev['vitest'] = '^4.0.1'
    changed.append('devDependency vitest ^4.0.1')
else:
    print('[OK] vitest уже в devDependencies')
if 'happy-dom' not in dev:
    dev['happy-dom'] = '^18.0.1'
    changed.append('devDependency happy-dom ^18.0.1')
else:
    print('[OK] happy-dom уже в devDependencies')

if not changed:
    print('[ГОТОВО] package.json уже настроен, изменений нет')
    sys.exit(0)

out = json.dumps(data, ensure_ascii=False, indent=2)
if crlf:
    out = out.replace('\n', NL)
    # JSON не должен заканчиваться \r перед EOF
    if out.endswith(NL):
        out = out[:-len(NL)]
out += NL

open(PATH, 'wb').write(out.encode('utf-8'))
print(f'[ГОТОВО] package.json обновлён: {", ".join(changed)}')
print('Далее: pnpm install  ->  pnpm test')
