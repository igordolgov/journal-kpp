// tests/stubs/useAudioEngine.ts
// Заглушка аудиодвижка для юнит-тестов: звук в логике спавна/физики
// не участвует, важна только форма API.

export const useAudioEngine = () => ({
  init: () => {},
  playUI: () => {},
  createPool: () => {},
  playFromPool: () => {},
  setMasterVolume: () => {},
  disposePool: () => {},
  stopPool: () => {},
  updateVolume: () => true,
  resetPool: () => {},
  updateEngineVolume: () => true,
  setEnginePitch: () => {},
  ctx: () => null,
})
