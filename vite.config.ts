import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          engine: ['src/engine/Engine.ts', 'src/engine/InputManager.ts', 'src/engine/EntityManager.ts', 'src/engine/SceneManager.ts'],
          physics: ['src/physics/PhysicsEngine.ts', 'src/physics/VehiclePhysics.ts', 'src/physics/CollisionSystem.ts', 'src/physics/DriftController.ts'],
          entities: ['src/entities/Entity.ts', 'src/entities/CardVehicle.ts', 'src/entities/TrackSegment.ts', 'src/entities/Particle.ts', 'src/entities/Camera.ts'],
          cards: ['src/cards/Card.ts', 'src/cards/CardCollection.ts', 'src/cards/CardUpgrade.ts', 'src/cards/CardRenderer.ts'],
          tracks: ['src/tracks/TrackGenerator.ts', 'src/tracks/TrackRenderer.ts', 'src/tracks/CheckpointSystem.ts'],
          audio: ['src/audio/AudioEngine.ts', 'src/audio/EngineSound.ts', 'src/audio/TireSqueal.ts', 'src/audio/ImpactSound.ts'],
          ui: ['src/ui/HUD.ts', 'src/ui/Garage.ts', 'src/ui/Menus.ts', 'src/ui/Settings.ts'],
          modes: ['src/modes/TimeAttack.ts', 'src/modes/DriftChallenge.ts', 'src/modes/Career.ts', 'src/modes/FreeRoam.ts'],
          save: ['src/save/SaveManager.ts', 'src/save/SettingsManager.ts'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    open: true,
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
  },
  esbuild: {
    target: 'ES2022',
    treeShaking: true,
  },
});