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
  
  // Audio systems - sound synthesis and effects
  audio: [
    './src/audio/AudioSystem.ts',
    './src/audio/AudioController.ts',
  ],
};

export default defineConfig({
  // ============================================================================
  // BASE PATH AND ROOT
  // ============================================================================
  base: '/',
  root: process.cwd(),
  
  // ============================================================================
  // BUILD CONFIGURATION
  // ============================================================================
  build: {
    // Target modern browsers for best performance
    target: 'esnext',
    
    // Output directory structure
    outDir: 'dist',
    
    // Enable sourcemaps for production debugging
    sourcemap: true,
    
    // Minification settings using Terser
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
      },
      mangle: {
        reserved: ['requestAnimationFrame', 'cancelAnimationFrame', 'AudioContext'],
      },
      format: {
        comments: false,
      },
    },
    
    // Rollup options for better chunking
    rollupOptions: {
      output: {
        // Manual chunking configuration
        manualChunks,
        
        // Asset handling
        assetFileNames: (chunkInfo) => {
          const extType = chunkInfo.name?.split('.').pop() ?? '';
          if (/\.(png|jpe?g|gif|svg)$/.test(extType)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/\.(woff2?)$/.test(extType)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          if (/\.(mp3|wav)$/.test(extType)) {
            return 'assets/audio/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        
        // Chunk naming strategy
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: '[name]-[hash].js',
        cssEntryFileNames: '[name]-[hash].css',
        cssChunkFileNames: '[name]-[hash].css',
        
        // Preserve module structure
        preserveModulesRoot: './src',
      },
    },
    
    // Code splitting optimization
    codeSplitting: true,
    
    // Limit for inline chunks
    chunkSizeWarningLimit: 500,
    
    // Empty output directory on build
    emptyOutDir: true,
    
    // Build report generation
    reportCompressedSize: true,
  },
  
  // ============================================================================
  // DEVELOPMENT SERVER CONFIGURATION
  // ============================================================================
  server: {
    // Host binding for network access
    host: '0.0.0.0',
    
    // Development server port
    port: 3000,
    
    // Force reload on file changes
    force: false,
    
    // Hot Module Replacement (HMR)
    hmr: {
      overlay: true,
      clientPort: 443,
    },
    
    // WebSocket proxy for HMR
    wsHost: 'localhost',
    
    // Open browser automatically
    open: true,
    
    // CORS handling
    cors: true,
    
    // Strict port checking
    strictPort: false,
    
    // Allowed hosts
    allowedHosts: true,
    
    // Watch files for rebuild
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
  },
  
  // ============================================================================
  // OPTIMIZATION SETTINGS
  // ============================================================================
  optimizeDeps: {
    // Pre-bundle dependencies for faster load times
    include: ['zod', 'canvas-confetti'],
    
    // Exclude heavy dependencies from pre-bundling
    exclude: [],
    
    // Disable preload to prevent conflicts
    noDiscovery: false,
    
    // Keep node_modules symlinks
    keepNodeModulesSymlinks: false,
    
    // Entry point for dependency analysis
    entries: ['./src/main.ts'],
    
    // Enable experimental preload
    force: false,
  },
  
  // ============================================================================
  // ENVIRONMENT VARIABLES
  // ============================================================================
  envPrefix: ['VITE_', 'APP_'],
  
  // ============================================================================
  // RESOLVE ALIASES
  // ============================================================================
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@engine': resolve(__dirname, './src/engine'),
      '@physics': resolve(__dirname, './src/physics'),
      '@entities': resolve(__dirname, './src/entities'),
      '@audio': resolve(__dirname, './src/audio'),
      '@systems': resolve(__dirname, './src/systems'),
    },
  },
  
  // ============================================================================
  // CSS PREPROCESSOR CONFIGURATION
  // ============================================================================
  css: {
    devSourcemap: true,
  },
  
  // ============================================================================
  // PLUGIN EXTENSIONS POINT (placeholder for future plugins)
  // ============================================================================
  // Plugins can be added here:
  // plugins: [
  //   react(),
  //   svgr(),
  //   ...
  // ],
});