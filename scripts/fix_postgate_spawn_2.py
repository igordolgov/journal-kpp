# -*- coding: utf-8 -*-
# Фикс TS18048: agent.exitPoint опционален — сужение через прямое обращение.
import sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = os.path.join(ROOT, 'app/composables/simulator/useSimulatorPhysics.ts')

old = """            const exitT = (Number.isFinite(agent.exitPoint?.x) && Number.isFinite(agent.exitPoint?.y))
              ? agent.exitPoint
              : agent.target
"""
new = """            const exitT = (agent.exitPoint && Number.isFinite(agent.exitPoint.x) && Number.isFinite(agent.exitPoint.y))
              ? agent.exitPoint
              : agent.target
"""

data = open(F, 'rb').read()
old_b = old.replace('\n', '\r\n').encode('utf-8')
new_b = new.replace('\n', '\r\n').encode('utf-8')
cnt = data.count(old_b)
if cnt != 1:
    print(f"GUARD FAIL: {cnt}"); sys.exit(1)
open(F, 'wb').write(data.replace(old_b, new_b))
check = open(F, 'rb').read()
print('fixed;', check.count(b'\r\n'), 'CRLF /', check.count(b'\n') - check.count(b'\r\n'), 'LF-only')
