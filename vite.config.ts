import { defineConfig } from 'vite';
import { resolve } from 'path';

// ============================================================================
// CARD DRIVE & DRIFT - VITE BUILD CONFIGURATION
// ============================================================================
// Production-optimized bundler settings with manual chunking strategy
// Separates vendor dependencies from game modules for optimal caching and
// progressive loading in the racing game application
// ============================================================================

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
  
  // Audio systems - sound synthesis and audio control
  audio: [
    './src/audio/AudioSystem.ts',
    './src/audio/AudioController.ts',
  ],
  
  // Render system
  render: ['./src/engine/RenderSystem.ts'],
};

export default defineConfig({
  // Base path for assets
  base: '/',
  
  // Root directory
  root: '.',
  
  // Output directory
  outDir: 'dist',
  
  // Clean output directory before build
  cleanDist: true,
  
  // Build settings
  build: {
    // Target browsers
    target: 'ES2022',
    
    // Minification with Terser
    minify: 'terser',
    
    // Terser options for production optimization
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging
        drop_debugger: false,
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    
    // Sourcemap generation for both dev and build
    sourcemap: true,
    
    // Code splitting threshold
    chunkSizeWarningLimit: 500,
    
    // Rollup rollupOptions for chunking
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // Chunking strategy
        manualChunks: manualChunks,
        
        // Asset filename pattern
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.svg')) {
            return 'assets/icons/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        
        // JS filename pattern
        entryFileNames: 'assets/js/[name]-[hash].js',
        
        // Chunk filename pattern
        chunkFileNames: 'assets/js/[name]-[hash].js',
        
        // CSS filename pattern
        assetDirs: 'assets',
      },
    },
  },
  
  // Development server settings
  server: {
    // Host binding for network access
    host: '0.0.0.0',
    
    // Dev server port
    port: 3000,
    
    // Force reload on changes
    force: true,
    
    // Watch files for reload
    watch: {
      usePolling: false,
      interval: 100,
    },
    
    // Open browser automatically
    open: false,
    
    // Proxy settings for API calls
    proxy: {},
    
    // CORS headers
    cors: true,
  },
  
  // Preview server settings
  preview: {
    host: '0.0.0.0',
    port: 4173,
    open: false,
  },
  
  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: ['zod', 'canvas-confetti'],
    exclude: [],
    entries: ['./src/main.ts'],
  },
  
  // Resolve aliases
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  
  // CSS settings
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
      scopeBehaviour: 'local',
    },
  },
  
  // Define global constants
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  
  // Log level
  logLevel: 'info',
  
  // Clear console on rerun
  clearScreen: true,
});