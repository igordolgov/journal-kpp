// app/utils/geometry.ts
// Назначение: геометрические утилиты (проверка точки в полигоне).
export function isPointInPolygon(
  px: number,
  py: number,
  polygon: { x: number; y: number }[]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    // [ИСПРАВЛЕНО] noUncheckedIndexedAccess: явная проверка индексов
    // (тот же паттерн, что в useSimulatorAudio.isPointInPolygon)
    const pi = polygon[i]
    const pj = polygon[j]
    if (!pi || !pj) continue
    const xi = pi.x, yi = pi.y;
    const xj = pj.x, yj = pj.y;
    const intersect = ((yi > py) != (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}