# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3001`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

---------------------------------------------------------------------------------

Рабочий процесс в обеих системах:

Поработали в Windows:

git add .
git commit -m "Описание изменений"
git push

Поработали в MX Linux:

git add .
git commit -m "Описание изменений"
git push

Чтобы получить изменения в другой системе:

git pull

---------------------------------------------------------------------------------


journal-kpp
├─ .eslintrc.js
├─ app
│  ├─ app.vue
│  ├─ assets
│  │  └─ css
│  │     └─ main.css
│  ├─ components
│  │  ├─ AudioLab.vue
│  │  ├─ database
│  │  │  ├─ AssignVehicleModal.vue
│  │  │  ├─ GeneratorModal.vue
│  │  │  ├─ PersonDetailModal.vue
│  │  │  ├─ PersonFormModal.vue
│  │  │  └─ VehicleFormModal.vue
│  │  ├─ designer
│  │  │  └─ DesignerModal.vue
│  │  ├─ editor
│  │  │  ├─ EditorCanvas.vue
│  │  │  ├─ EditorHeader.vue
│  │  │  ├─ EditorScriptNode.vue
│  │  │  ├─ EditorSidebarLeft.vue
│  │  │  ├─ EditorSidebarRight.vue
│  │  │  ├─ NodeEditorPanel.vue
│  │  │  ├─ ScenarioEditor.vue
│  │  │  └─ TrafficRoad.vue
│  │  ├─ GeneratorControl.vue
│  │  ├─ JournalSidebar.vue
│  │  ├─ JournalTable.vue
│  │  ├─ PanelUI.vue
│  │  ├─ ShiftManager.vue
│  │  ├─ ShiftManagerModals.vue
│  │  ├─ simulator
│  │  │  ├─ PersonAvatar.vue
│  │  │  ├─ PersonDesigner.vue
│  │  │  ├─ SimulationDebug.vue
│  │  │  ├─ SimulatorControls.vue
│  │  │  ├─ SimulatorEvent.vue
│  │  │  ├─ SimulatorScene.vue
│  │  │  └─ sprites
│  │  │     ├─ PersonSprite.vue
│  │  │     └─ VehicleSprite.vue
│  │  ├─ SimulatorSettings.vue
│  │  ├─ SimulatorWidget.vue
│  │  ├─ StatsModal.vue
│  │  └─ ui
│  │     └─ ColorPicker.vue
│  ├─ composables
│  │  ├─ simulator
│  │  │  ├─ useSimulatorAudio.ts
│  │  │  ├─ useSimulatorCore.ts
│  │  │  ├─ useSimulatorPhysics.ts
│  │  │  ├─ useSimulatorRendering.ts
│  │  │  ├─ useSimulatorScripts.ts
│  │  │  ├─ useSimulatorSpawn.ts
│  │  │  └─ useSimulatorUI.ts
│  │  ├─ useAudioEngine.ts
│  │  ├─ useCompanions.ts
│  │  ├─ useConfig.ts
│  │  ├─ useCustomAssets.ts
│  │  ├─ useDatabase.ts
│  │  ├─ useDatabasePage.ts
│  │  ├─ useEditorLogic.ts
│  │  ├─ useFamily.ts
│  │  ├─ useFamilyActions.ts
│  │  ├─ useHistory.ts
│  │  ├─ useJournal.ts
│  │  ├─ useJournalPage.ts
│  │  ├─ usePatronymic.ts
│  │  ├─ usePersonGenerator.ts
│  │  ├─ usePhysics.ts
│  │  ├─ useScenarioRunner.ts
│  │  ├─ useSceneBuilder.ts
│  │  ├─ useScriptInterpreter.ts
│  │  ├─ useSeeder.ts
│  │  ├─ useShift.ts
│  │  ├─ useSimulator.ts
│  │  ├─ useSimulatorData.ts
│  │  ├─ useSimulatorDatabase.ts
│  │  ├─ useSimulatorScaling.ts
│  │  ├─ useSimulatorScene.ts
│  │  ├─ useTextUtils.ts
│  │  └─ useTheme.ts
│  ├─ constants
│  │  ├─ family.ts
│  │  ├─ gateConfig.ts
│  │  └─ library.ts
│  ├─ layouts
│  │  └─ default.vue
│  ├─ pages
│  │  ├─ audio-lab.vue
│  │  ├─ database.vue
│  │  ├─ editor.vue
│  │  ├─ generator.vue
│  │  ├─ index.vue
│  │  ├─ remote-panel.vue
│  │  ├─ reports.vue
│  │  ├─ scenario-editor.vue
│  │  └─ settings.vue
│  ├─ public
│  │  ├─ apple-touch-icon.png
│  │  ├─ favicon.ico
│  │  ├─ pwa-192x192.png
│  │  └─ pwa-512x512.png
│  ├─ services
│  │  └─ audioService.ts
│  ├─ types
│  │  ├─ index.ts
│  │  ├─ scene.ts
│  │  └─ simulator.ts
│  └─ utils
│     ├─ personSvgRenderer.ts
│     ├─ personToSvg.ts
│     ├─ simulatorConstants.ts
│     ├─ simulatorMath.ts
│     └─ simulatorSvg.ts
├─ knip.json
├─ nuxt.config.ts
├─ package-lock.json
├─ package.json
└─ README.md

```