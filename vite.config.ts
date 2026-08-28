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
    // Rollup options
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // Chunking strategy
        manualChunks,
        
        // Asset handling
        assetFileName: () => '[name]-[hash][extname]',
        
        // Chunk naming
        chunkFileNames: 'chunks/[name]-[hash].js',
        
        // Entry point naming
        entryFileNames: 'entry-[name]-[hash].js',
        
        // Inline chunk size threshold
        inlineDynamicImports: false,
      },
    },
    
    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: [],
      },
      mangle: true,
      format: {
        comments: false,
      },
    },
    
    // Source map generation
    sourcemap: true,
    
    // Target browser compatibility
    target: 'ES2022',
    
    // Assets inlining
    assetsInlineLimit: 4096,
  },
  
  // Development server settings
  server: {
    // Port configuration
    port: 3000,
    
    // Host binding (allows external access)
    host: '0.0.0.0',
    
    // Enable hot module replacement
    hmr: {
      enabled: true,
      overlay: true,
    },
    
    // Watch changes
    watch: {
      usePolling: false,
      interval: 100,
    },
    
    // CORS headers
    cors: true,
    
    // Strict port usage
    strictPort: false,
  },
  
  // CSS settings
  css: {
    // Preprocessor options
    preprocessorOptions: {},
    
    // Dynamic imports
    dynamicImportVars: {
      warnOnError: true,
      exclude: [],
    },
  },
  
  // Resolve aliases
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  
  // Define environment variables
  define: {
    'import.meta.env.DEV': JSON.stringify(process.env.NODE_ENV === 'development'),
    'import.meta.env.PROD': JSON.stringify(process.env.NODE_ENV === 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  
  // Optimizations
  optimizeDeps: {
    include: ['zod', 'canvas-confetti'],
    exclude: [],
    force: false,
  },
  
  // Log level
  logLevel: 'info',
});