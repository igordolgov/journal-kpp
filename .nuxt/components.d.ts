
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


export const AudioLab: typeof import("../app/components/AudioLab.vue")['default']
export const GeneratorControl: typeof import("../app/components/GeneratorControl.vue")['default']
export const JournalSidebar: typeof import("../app/components/JournalSidebar.vue")['default']
export const JournalTable: typeof import("../app/components/JournalTable.vue")['default']
export const PanelUI: typeof import("../app/components/PanelUI.vue")['default']
export const ShiftManager: typeof import("../app/components/ShiftManager.vue")['default']
export const ShiftManagerModals: typeof import("../app/components/ShiftManagerModals.vue")['default']
export const SimulatorSettings: typeof import("../app/components/SimulatorSettings.vue")['default']
export const SimulatorWidget: typeof import("../app/components/SimulatorWidget.vue")['default']
export const StatsModal: typeof import("../app/components/StatsModal.vue")['default']
export const DatabaseAssignVehicleModal: typeof import("../app/components/database/AssignVehicleModal.vue")['default']
export const DatabaseGeneratorModal: typeof import("../app/components/database/GeneratorModal.vue")['default']
export const DatabasePersonDetailModal: typeof import("../app/components/database/PersonDetailModal.vue")['default']
export const DatabasePersonFormModal: typeof import("../app/components/database/PersonFormModal.vue")['default']
export const DatabaseVehicleFormModal: typeof import("../app/components/database/VehicleFormModal.vue")['default']
export const DesignerModal: typeof import("../app/components/designer/DesignerModal.vue")['default']
export const EditorCanvas: typeof import("../app/components/editor/EditorCanvas.vue")['default']
export const EditorHeader: typeof import("../app/components/editor/EditorHeader.vue")['default']
export const EditorScriptNode: typeof import("../app/components/editor/EditorScriptNode.vue")['default']
export const EditorSidebarLeft: typeof import("../app/components/editor/EditorSidebarLeft.vue")['default']
export const EditorSidebarRight: typeof import("../app/components/editor/EditorSidebarRight.vue")['default']
export const EditorNodeEditorPanel: typeof import("../app/components/editor/NodeEditorPanel.vue")['default']
export const EditorScenarioEditor: typeof import("../app/components/editor/ScenarioEditor.vue")['default']
export const EditorTrafficRoad: typeof import("../app/components/editor/TrafficRoad.vue")['default']
export const SimulatorPersonAvatar: typeof import("../app/components/simulator/PersonAvatar.vue")['default']
export const SimulatorPersonDesigner: typeof import("../app/components/simulator/PersonDesigner.vue")['default']
export const SimulatorSimulationDebug: typeof import("../app/components/simulator/SimulationDebug.vue")['default']
export const SimulatorControls: typeof import("../app/components/simulator/SimulatorControls.vue")['default']
export const SimulatorEvent: typeof import("../app/components/simulator/SimulatorEvent.vue")['default']
export const SimulatorScene: typeof import("../app/components/simulator/SimulatorScene.vue")['default']
export const SimulatorSpritesPersonSprite: typeof import("../app/components/simulator/sprites/PersonSprite.vue")['default']
export const SimulatorSpritesVehicleSprite: typeof import("../app/components/simulator/sprites/VehicleSprite.vue")['default']
export const UiColorPicker: typeof import("../app/components/ui/ColorPicker.vue")['default']
export const NuxtWelcome: typeof import("../node_modules/nuxt/dist/app/components/welcome.vue")['default']
export const NuxtLayout: typeof import("../node_modules/nuxt/dist/app/components/nuxt-layout")['default']
export const NuxtErrorBoundary: typeof import("../node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']
export const ClientOnly: typeof import("../node_modules/nuxt/dist/app/components/client-only")['default']
export const DevOnly: typeof import("../node_modules/nuxt/dist/app/components/dev-only")['default']
export const ServerPlaceholder: typeof import("../node_modules/nuxt/dist/app/components/server-placeholder")['default']
export const NuxtLink: typeof import("../node_modules/nuxt/dist/app/components/nuxt-link")['default']
export const NuxtLoadingIndicator: typeof import("../node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']
export const NuxtTime: typeof import("../node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']
export const NuxtRouteAnnouncer: typeof import("../node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']
export const NuxtAnnouncer: typeof import("../node_modules/nuxt/dist/app/components/nuxt-announcer")['default']
export const NuxtImg: typeof import("../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']
export const NuxtPicture: typeof import("../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']
export const GSAPTransition: typeof import("../node_modules/v-gsap-nuxt/dist/runtime/components/GSAPTransition.vue")['default']
export const NuxtPage: typeof import("../node_modules/nuxt/dist/pages/runtime/page")['default']
export const NoScript: typeof import("../node_modules/nuxt/dist/head/runtime/components")['NoScript']
export const Link: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Link']
export const Base: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Base']
export const Title: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Title']
export const Meta: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Meta']
export const Style: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Style']
export const Head: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Head']
export const Html: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Html']
export const Body: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Body']
export const NuxtIsland: typeof import("../node_modules/nuxt/dist/app/components/nuxt-island")['default']
export const LazyAudioLab: LazyComponent<typeof import("../app/components/AudioLab.vue")['default']>
export const LazyGeneratorControl: LazyComponent<typeof import("../app/components/GeneratorControl.vue")['default']>
export const LazyJournalSidebar: LazyComponent<typeof import("../app/components/JournalSidebar.vue")['default']>
export const LazyJournalTable: LazyComponent<typeof import("../app/components/JournalTable.vue")['default']>
export const LazyPanelUI: LazyComponent<typeof import("../app/components/PanelUI.vue")['default']>
export const LazyShiftManager: LazyComponent<typeof import("../app/components/ShiftManager.vue")['default']>
export const LazyShiftManagerModals: LazyComponent<typeof import("../app/components/ShiftManagerModals.vue")['default']>
export const LazySimulatorSettings: LazyComponent<typeof import("../app/components/SimulatorSettings.vue")['default']>
export const LazySimulatorWidget: LazyComponent<typeof import("../app/components/SimulatorWidget.vue")['default']>
export const LazyStatsModal: LazyComponent<typeof import("../app/components/StatsModal.vue")['default']>
export const LazyDatabaseAssignVehicleModal: LazyComponent<typeof import("../app/components/database/AssignVehicleModal.vue")['default']>
export const LazyDatabaseGeneratorModal: LazyComponent<typeof import("../app/components/database/GeneratorModal.vue")['default']>
export const LazyDatabasePersonDetailModal: LazyComponent<typeof import("../app/components/database/PersonDetailModal.vue")['default']>
export const LazyDatabasePersonFormModal: LazyComponent<typeof import("../app/components/database/PersonFormModal.vue")['default']>
export const LazyDatabaseVehicleFormModal: LazyComponent<typeof import("../app/components/database/VehicleFormModal.vue")['default']>
export const LazyDesignerModal: LazyComponent<typeof import("../app/components/designer/DesignerModal.vue")['default']>
export const LazyEditorCanvas: LazyComponent<typeof import("../app/components/editor/EditorCanvas.vue")['default']>
export const LazyEditorHeader: LazyComponent<typeof import("../app/components/editor/EditorHeader.vue")['default']>
export const LazyEditorScriptNode: LazyComponent<typeof import("../app/components/editor/EditorScriptNode.vue")['default']>
export const LazyEditorSidebarLeft: LazyComponent<typeof import("../app/components/editor/EditorSidebarLeft.vue")['default']>
export const LazyEditorSidebarRight: LazyComponent<typeof import("../app/components/editor/EditorSidebarRight.vue")['default']>
export const LazyEditorNodeEditorPanel: LazyComponent<typeof import("../app/components/editor/NodeEditorPanel.vue")['default']>
export const LazyEditorScenarioEditor: LazyComponent<typeof import("../app/components/editor/ScenarioEditor.vue")['default']>
export const LazyEditorTrafficRoad: LazyComponent<typeof import("../app/components/editor/TrafficRoad.vue")['default']>
export const LazySimulatorPersonAvatar: LazyComponent<typeof import("../app/components/simulator/PersonAvatar.vue")['default']>
export const LazySimulatorPersonDesigner: LazyComponent<typeof import("../app/components/simulator/PersonDesigner.vue")['default']>
export const LazySimulatorSimulationDebug: LazyComponent<typeof import("../app/components/simulator/SimulationDebug.vue")['default']>
export const LazySimulatorControls: LazyComponent<typeof import("../app/components/simulator/SimulatorControls.vue")['default']>
export const LazySimulatorEvent: LazyComponent<typeof import("../app/components/simulator/SimulatorEvent.vue")['default']>
export const LazySimulatorScene: LazyComponent<typeof import("../app/components/simulator/SimulatorScene.vue")['default']>
export const LazySimulatorSpritesPersonSprite: LazyComponent<typeof import("../app/components/simulator/sprites/PersonSprite.vue")['default']>
export const LazySimulatorSpritesVehicleSprite: LazyComponent<typeof import("../app/components/simulator/sprites/VehicleSprite.vue")['default']>
export const LazyUiColorPicker: LazyComponent<typeof import("../app/components/ui/ColorPicker.vue")['default']>
export const LazyNuxtWelcome: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/welcome.vue")['default']>
export const LazyNuxtLayout: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-layout")['default']>
export const LazyNuxtErrorBoundary: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']>
export const LazyClientOnly: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/client-only")['default']>
export const LazyDevOnly: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/dev-only")['default']>
export const LazyServerPlaceholder: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/server-placeholder")['default']>
export const LazyNuxtLink: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-link")['default']>
export const LazyNuxtLoadingIndicator: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']>
export const LazyNuxtTime: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']>
export const LazyNuxtRouteAnnouncer: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']>
export const LazyNuxtAnnouncer: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-announcer")['default']>
export const LazyNuxtImg: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']>
export const LazyNuxtPicture: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']>
export const LazyGSAPTransition: LazyComponent<typeof import("../node_modules/v-gsap-nuxt/dist/runtime/components/GSAPTransition.vue")['default']>
export const LazyNuxtPage: LazyComponent<typeof import("../node_modules/nuxt/dist/pages/runtime/page")['default']>
export const LazyNoScript: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['NoScript']>
export const LazyLink: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Link']>
export const LazyBase: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Base']>
export const LazyTitle: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Title']>
export const LazyMeta: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Meta']>
export const LazyStyle: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Style']>
export const LazyHead: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Head']>
export const LazyHtml: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Html']>
export const LazyBody: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Body']>
export const LazyNuxtIsland: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-island")['default']>

export const componentNames: string[]
