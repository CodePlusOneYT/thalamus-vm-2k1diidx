import { defineConfig } from 'vite';
import { resolve } from 'path';

// Manual chunking strategy: separate vendor dependencies from game modules
const manualChunks = {
  // External libraries that rarely change
  vendor: ['zod', 'canvas-confetti'],
  
  // Engine core - handles game loop, input, entities, scenes
  engine: [
    './src/engine/Engine.ts',
    './src/engine/InputManager.ts',
    './src/engine/EntityManager.ts',
    './src/engine/SceneManager.ts',
  ],
  
  // Physics systems - vehicle physics, collision, drift mechanics
  physics: [
    './src/physics/PhysicsEngine.ts',
    './src/physics/VehiclePhysics.ts',
    './src/physics/CollisionSystem.ts',
    './src/physics/DriftController.ts',
    './src/physics/MathUtils.ts',
  ],
  
  // Game entities - vehicles, tracks, particles, camera
  entities: [
    './src/entities/Entity.ts',
    './src/entities/CardVehicle.ts',
    './src/entities/TrackSegment.ts',
    './src/entities/Particle.ts',
    './src/entities/Camera.ts',
  ],
  
  // Audio system - synthesized SFX for games
  audio: [
    './src/audio/AudioSystem.ts',
    './src/audio/AudioController.ts',
  ],
  
  // Card deck system - collectible cards
  cardDeck: ['./src/systems/CardDeck.ts'],
};

export default defineConfig({
  root: '.',
  publicDir: 'public',
  
  // Development server configuration
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    open: false,
    cors: true,
    hmr: {
      host: 'localhost',
      protocol: 'ws',
      clientPort: 3000,
    },
    watch: {
      usePolling: false,
      interval: 100,
    },
  },
  
  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
        manualChunks,
        preserveEntrySignatures: 'allow-extension',
      },
    },
    target: 'esnext',
    cssTarget: 'esnext',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
        manualChunks,
        inlineDynamicImports: false,
      },
    },
  },
  
  // Resolve path aliases
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  
  // CSS processing
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
      scopeBehavior: 'local',
    },
  },
  
  // Define environment variables at build time
  define: {
    'import.meta.env.PROD': !!process.env.PROD,
    'import.meta.env.DEV': !!!process.env.PROD,
  },
  
  // Optimization hints
  optimizeDeps: {
    include: ['zod', 'canvas-confetti'],
    exclude: ['@types/dom'],
  },
  
  // Experimental features
  experimental: {
    asyncContextLayering: false,
    renderBuiltUrl: undefined,
  },
});