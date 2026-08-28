import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  
  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'terser',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
        manualChunks: {
          vendor: ['zod'],
          engine: [
            'src/engine/Engine.ts',
            'src/engine/InputManager.ts',
            'src/engine/EntityManager.ts',
            'src/engine/SceneManager.ts',
          ],
          physics: [
            'src/physics/PhysicsEngine.ts',
            'src/physics/VehiclePhysics.ts',
            'src/physics/CollisionSystem.ts',
            'src/physics/DriftController.ts',
            'src/physics/MathUtils.ts',
          ],
          entities: [
            'src/entities/Entity.ts',
            'src/entities/CardVehicle.ts',
            'src/entities/TrackSegment.ts',
            'src/entities/Particle.ts',
            'src/entities/Camera.ts',
          ],
          audio: [
            'src/audio/AudioSystem.ts',
            'src/audio/AudioController.ts',
          ],
          systems: [
            'src/systems/CardDeck.ts',
          ],
        },
      },
    },
    terserOptions: {
      compress: {
        drop_console: !process.env.VITE_DEBUG_MODE || process.env.VITE_DEBUG_MODE === 'false',
        drop_debugger: true,
        passes: 2,
        pure_funcs: ['console.log', 'console.debug', 'console.trace'],
      },
      mangle: {
        reserved: ['$super', '$this'],
      },
      format: {
        comments: false,
      },
    },
    target: 'esnext',
    cssTarget: 'esnext',
    chunkSizeWarningLimit: 500,
  },
  
  // Development server configuration
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.VITE_PORT || '3000', 10),
    strictPort: true,
    proxy: {},
    watch: {
      usePolling: false,
    },
  },
  
  // CSS handling
  css: {
    modules: {
      generateScopedName: '[local]-[hash:base64:5]',
    },
  },
  
  // Resolve aliases
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  
  // Preload files
  preload: true,
  
  // Base URL
  base: '/',
});