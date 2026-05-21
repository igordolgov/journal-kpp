
import type { DefineComponent, SlotsType } from 'vue'
type IslandComponent<T> = DefineComponent<{}, {refresh: () => Promise<void>}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, SlotsType<{ fallback: { error: unknown } }>> & T

type HydrationStrategies = {
  hydrateOnVisible?: IntersectionObserverInit | true
  hydrateOnIdle?: number | true
  hydrateOnInteraction?: keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap> | true
  hydrateOnMediaQuery?: string
  hydrateAfter?: number
  hydrateWhen?: boolean
  hydrateNever?: true
}
type LazyComponent<T> = DefineComponent<HydrationStrategies, {}, {}, {}, {}, {}, {}, { hydrated: () => void }> & T

interface _GlobalComponents {
  AudioLab: typeof import("../../app/components/AudioLab.vue")['default']
  GeneratorControl: typeof import("../../app/components/GeneratorControl.vue")['default']
  JournalSidebar: typeof import("../../app/components/JournalSidebar.vue")['default']
  JournalTable: typeof import("../../app/components/JournalTable.vue")['default']
  PanelUI: typeof import("../../app/components/PanelUI.vue")['default']
  ShiftManager: typeof import("../../app/components/ShiftManager.vue")['default']
  ShiftManagerModals: typeof import("../../app/components/ShiftManagerModals.vue")['default']
  SimulatorSettings: typeof import("../../app/components/SimulatorSettings.vue")['default']
  SimulatorWidget: typeof import("../../app/components/SimulatorWidget.vue")['default']
  StatsModal: typeof import("../../app/components/StatsModal.vue")['default']
  DatabaseAssignVehicleModal: typeof import("../../app/components/database/AssignVehicleModal.vue")['default']
  DatabaseGeneratorModal: typeof import("../../app/components/database/GeneratorModal.vue")['default']
  DatabasePersonDetailModal: typeof import("../../app/components/database/PersonDetailModal.vue")['default']
  DatabasePersonFormModal: typeof import("../../app/components/database/PersonFormModal.vue")['default']
  DatabaseVehicleFormModal: typeof import("../../app/components/database/VehicleFormModal.vue")['default']
  DesignerModal: typeof import("../../app/components/designer/DesignerModal.vue")['default']
  EditorCanvas: typeof import("../../app/components/editor/EditorCanvas.vue")['default']
  EditorHeader: typeof import("../../app/components/editor/EditorHeader.vue")['default']
  EditorScriptNode: typeof import("../../app/components/editor/EditorScriptNode.vue")['default']
  EditorSidebarLeft: typeof import("../../app/components/editor/EditorSidebarLeft.vue")['default']
  EditorSidebarRight: typeof import("../../app/components/editor/EditorSidebarRight.vue")['default']
  EditorNodeEditorPanel: typeof import("../../app/components/editor/NodeEditorPanel.vue")['default']
  EditorScenarioEditor: typeof import("../../app/components/editor/ScenarioEditor.vue")['default']
  EditorTrafficRoad: typeof import("../../app/components/editor/TrafficRoad.vue")['default']
  SimulatorPersonAvatar: typeof import("../../app/components/simulator/PersonAvatar.vue")['default']
  SimulatorPersonDesigner: typeof import("../../app/components/simulator/PersonDesigner.vue")['default']
  SimulatorSimulationDebug: typeof import("../../app/components/simulator/SimulationDebug.vue")['default']
  SimulatorControls: typeof import("../../app/components/simulator/SimulatorControls.vue")['default']
  SimulatorEvent: typeof import("../../app/components/simulator/SimulatorEvent.vue")['default']
  SimulatorScene: typeof import("../../app/components/simulator/SimulatorScene.vue")['default']
  SimulatorSpritesPersonSprite: typeof import("../../app/components/simulator/sprites/PersonSprite.vue")['default']
  SimulatorSpritesVehicleSprite: typeof import("../../app/components/simulator/sprites/VehicleSprite.vue")['default']
  UiColorPicker: typeof import("../../app/components/ui/ColorPicker.vue")['default']
  NuxtWelcome: typeof import("../../node_modules/nuxt/dist/app/components/welcome.vue")['default']
  NuxtLayout: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-layout")['default']
  NuxtErrorBoundary: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']
  ClientOnly: typeof import("../../node_modules/nuxt/dist/app/components/client-only")['default']
  DevOnly: typeof import("../../node_modules/nuxt/dist/app/components/dev-only")['default']
  ServerPlaceholder: typeof import("../../node_modules/nuxt/dist/app/components/server-placeholder")['default']
  NuxtLink: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-link")['default']
  NuxtLoadingIndicator: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']
  NuxtTime: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']
  NuxtRouteAnnouncer: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']
  NuxtAnnouncer: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-announcer")['default']
  NuxtImg: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']
  NuxtPicture: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']
  GSAPTransition: typeof import("../../node_modules/v-gsap-nuxt/dist/runtime/components/GSAPTransition.vue")['default']
  NuxtPage: typeof import("../../node_modules/nuxt/dist/pages/runtime/page")['default']
  NoScript: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['NoScript']
  Link: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Link']
  Base: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Base']
  Title: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Title']
  Meta: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Meta']
  Style: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Style']
  Head: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Head']
  Html: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Html']
  Body: typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Body']
  NuxtIsland: typeof import("../../node_modules/nuxt/dist/app/components/nuxt-island")['default']
  LazyAudioLab: LazyComponent<typeof import("../../app/components/AudioLab.vue")['default']>
  LazyGeneratorControl: LazyComponent<typeof import("../../app/components/GeneratorControl.vue")['default']>
  LazyJournalSidebar: LazyComponent<typeof import("../../app/components/JournalSidebar.vue")['default']>
  LazyJournalTable: LazyComponent<typeof import("../../app/components/JournalTable.vue")['default']>
  LazyPanelUI: LazyComponent<typeof import("../../app/components/PanelUI.vue")['default']>
  LazyShiftManager: LazyComponent<typeof import("../../app/components/ShiftManager.vue")['default']>
  LazyShiftManagerModals: LazyComponent<typeof import("../../app/components/ShiftManagerModals.vue")['default']>
  LazySimulatorSettings: LazyComponent<typeof import("../../app/components/SimulatorSettings.vue")['default']>
  LazySimulatorWidget: LazyComponent<typeof import("../../app/components/SimulatorWidget.vue")['default']>
  LazyStatsModal: LazyComponent<typeof import("../../app/components/StatsModal.vue")['default']>
  LazyDatabaseAssignVehicleModal: LazyComponent<typeof import("../../app/components/database/AssignVehicleModal.vue")['default']>
  LazyDatabaseGeneratorModal: LazyComponent<typeof import("../../app/components/database/GeneratorModal.vue")['default']>
  LazyDatabasePersonDetailModal: LazyComponent<typeof import("../../app/components/database/PersonDetailModal.vue")['default']>
  LazyDatabasePersonFormModal: LazyComponent<typeof import("../../app/components/database/PersonFormModal.vue")['default']>
  LazyDatabaseVehicleFormModal: LazyComponent<typeof import("../../app/components/database/VehicleFormModal.vue")['default']>
  LazyDesignerModal: LazyComponent<typeof import("../../app/components/designer/DesignerModal.vue")['default']>
  LazyEditorCanvas: LazyComponent<typeof import("../../app/components/editor/EditorCanvas.vue")['default']>
  LazyEditorHeader: LazyComponent<typeof import("../../app/components/editor/EditorHeader.vue")['default']>
  LazyEditorScriptNode: LazyComponent<typeof import("../../app/components/editor/EditorScriptNode.vue")['default']>
  LazyEditorSidebarLeft: LazyComponent<typeof import("../../app/components/editor/EditorSidebarLeft.vue")['default']>
  LazyEditorSidebarRight: LazyComponent<typeof import("../../app/components/editor/EditorSidebarRight.vue")['default']>
  LazyEditorNodeEditorPanel: LazyComponent<typeof import("../../app/components/editor/NodeEditorPanel.vue")['default']>
  LazyEditorScenarioEditor: LazyComponent<typeof import("../../app/components/editor/ScenarioEditor.vue")['default']>
  LazyEditorTrafficRoad: LazyComponent<typeof import("../../app/components/editor/TrafficRoad.vue")['default']>
  LazySimulatorPersonAvatar: LazyComponent<typeof import("../../app/components/simulator/PersonAvatar.vue")['default']>
  LazySimulatorPersonDesigner: LazyComponent<typeof import("../../app/components/simulator/PersonDesigner.vue")['default']>
  LazySimulatorSimulationDebug: LazyComponent<typeof import("../../app/components/simulator/SimulationDebug.vue")['default']>
  LazySimulatorControls: LazyComponent<typeof import("../../app/components/simulator/SimulatorControls.vue")['default']>
  LazySimulatorEvent: LazyComponent<typeof import("../../app/components/simulator/SimulatorEvent.vue")['default']>
  LazySimulatorScene: LazyComponent<typeof import("../../app/components/simulator/SimulatorScene.vue")['default']>
  LazySimulatorSpritesPersonSprite: LazyComponent<typeof import("../../app/components/simulator/sprites/PersonSprite.vue")['default']>
  LazySimulatorSpritesVehicleSprite: LazyComponent<typeof import("../../app/components/simulator/sprites/VehicleSprite.vue")['default']>
  LazyUiColorPicker: LazyComponent<typeof import("../../app/components/ui/ColorPicker.vue")['default']>
  LazyNuxtWelcome: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/welcome.vue")['default']>
  LazyNuxtLayout: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-layout")['default']>
  LazyNuxtErrorBoundary: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']>
  LazyClientOnly: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/client-only")['default']>
  LazyDevOnly: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/dev-only")['default']>
  LazyServerPlaceholder: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/server-placeholder")['default']>
  LazyNuxtLink: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-link")['default']>
  LazyNuxtLoadingIndicator: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']>
  LazyNuxtTime: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']>
  LazyNuxtRouteAnnouncer: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']>
  LazyNuxtAnnouncer: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-announcer")['default']>
  LazyNuxtImg: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']>
  LazyNuxtPicture: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']>
  LazyGSAPTransition: LazyComponent<typeof import("../../node_modules/v-gsap-nuxt/dist/runtime/components/GSAPTransition.vue")['default']>
  LazyNuxtPage: LazyComponent<typeof import("../../node_modules/nuxt/dist/pages/runtime/page")['default']>
  LazyNoScript: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['NoScript']>
  LazyLink: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Link']>
  LazyBase: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Base']>
  LazyTitle: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Title']>
  LazyMeta: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Meta']>
  LazyStyle: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Style']>
  LazyHead: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Head']>
  LazyHtml: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Html']>
  LazyBody: LazyComponent<typeof import("../../node_modules/nuxt/dist/head/runtime/components")['Body']>
  LazyNuxtIsland: LazyComponent<typeof import("../../node_modules/nuxt/dist/app/components/nuxt-island")['default']>
}

declare module 'vue' {
  export interface GlobalComponents extends _GlobalComponents { }
}

export {}
