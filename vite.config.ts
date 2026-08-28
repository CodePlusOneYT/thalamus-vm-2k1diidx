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
  
  // Audio systems
  audio: [
    './src/audio/AudioSystem.ts',
    './src/audio/AudioController.ts',
  ],
};

export default defineConfig({
  // ============================================================================
  // BUILD SETTINGS
  // ============================================================================
  build: {
    // Generate source maps for debugging production builds
    sourcemap: true,
    
    // Minify with Terser - optimized for modern browsers
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: false,
        passes: 2,
      },
      format: {
        comments: false,
        ascii_only: true,
      },
      mangle: {
        eval: false,
        toplevel: false,
      },
    },
    
    // Rollup options for advanced bundling
    rollupOptions: {
      // Manual chunking for better code splitting
      output: {
        // Custom chunk naming pattern
        chunkFileNames: 'assets/chunks/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          
          if (/\.png$|\.jpg$|\.jpeg$|\.gif$|\.svg$|\.ico$/.test(name)) {
            return 'assets/images/[name][extname]';
          }
          if (/\.woff2?$|\.ttf$|\.otf$/.test(name)) {
            return 'assets/fonts/[name][extname]';
          }
          return 'assets/[name][extname]';
        },
      },
      
      // Define manual chunks explicitly
      manualChunks,
      
      // Optimize bundle size
      inlineDynamicImports: false,
    },
    
    // Target environment - ES2022 for modern browsers
    target: 'es2022',
    
    // Out directory for production build
    outDir: 'dist',
    
    // Clean output directory before build
    clean: true,
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Minimum chunk size warning threshold
    minChunkSize: 500,
  },
  
  // ============================================================================
  // DEVELOPMENT SERVER SETTINGS
  // ============================================================================
  server: {
    // Host on all network interfaces for remote access
    host: '0.0.0.0',
    
    // Development server port
    port: 3000,
    
    // Auto-open browser when dev server starts
    open: true,
    
    // Watch mode - reload on file changes
    watch: {
      // File patterns to watch
      include: ['src/**/*'],
      // Use polling for Docker environments
      usePolling: process.env.DOCKER === 'true',
      // Interval between checks (ms)
      interval: 100,
    },
    
    // Proxy configuration for API requests
    proxy: {},
    
    // Server headers
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    },
  },
  
  // ============================================================================
  // SOURCE MAP CONFIGURATION
  // ============================================================================
  // Generate source maps for both development and production
  // This enables stack traces and debugging in production builds
  build: {
    sourcemap: true,
  },
  
  // ============================================================================
  // RESOLVE ALIASES
  // ============================================================================
  resolve: {
    // Path aliases for cleaner imports
    alias: {
      '@': resolve(__dirname, './src'),
      '@engine': resolve(__dirname, './src/engine'),
      '@physics': resolve(__dirname, './src/physics'),
      '@entities': resolve(__dirname, './src/entities'),
      '@audio': resolve(__dirname, './src/audio'),
      '@systems': resolve(__dirname, './src/systems'),
    },
    
    // Extensions to resolve without specifying
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  
  // ============================================================================
  // PRE-LOADING & PERFORMANCE
  // ============================================================================
  optimizeDeps: {
    // Pre-bundle dependencies for faster initial load
    include: ['zod', 'canvas-confetti'],
    
    // Exclude heavy dependencies from pre-bundling
    exclude: [],
    
    // Enable experimental preload
    force: false,
  },
  
  // ============================================================================
  // ENVIRONMENT VARIABLES
  // ============================================================================
  envPrefix: ['VITE_', 'APP_'],
  
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