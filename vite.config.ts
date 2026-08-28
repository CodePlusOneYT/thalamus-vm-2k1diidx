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
  // External libraries that rarely change and can be cached separately
  vendor: ['zod', 'canvas-confetti'],
  
  // Engine core - handles game loop, rendering, and system orchestration
  engine: [
    './src/engine/Engine.ts',
    './src/engine/InputManager.ts',
    './src/engine/EntityManager.ts',
    './src/engine/SceneManager.ts',
    './src/engine/RenderSystem.ts'
  ],
  
  // Physics subsystem - vehicle dynamics, collision detection, drift mechanics
  physics: [
    './src/physics/PhysicsEngine.ts',
    './src/physics/VehiclePhysics.ts',
    './src/physics/CollisionSystem.ts',
    './src/physics/DriftController.ts',
    './src/physics/MathUtils.ts'
  ],
  
  // Entity components - player vehicles, particles, track elements
  entities: [
    './src/entities/Entity.ts',
    './src/entities/CardVehicle.ts',
    './src/entities/TrackSegment.ts',
    './src/entities/Particle.ts',
    './src/entities/Camera.ts'
  ],
  
  // Audio subsystem - sound synthesis, music management, SFX effects
  audio: [
    './src/audio/AudioSystem.ts',
    './src/audio/AudioController.ts'
  ],
  
  // Game systems - card deck logic, scoring, power-ups
  systems: [
    './src/systems/CardDeck.ts'
  ]
};

export default defineConfig({
  // Project root directory
  root: '.',
  
  // Public base path for assets
  base: '/',
  
  // Output directory for production builds
  outDir: 'dist',
  
  // Clean dist folder before build
  cleanDist: true,
  
  // Source map generation settings
  build: {
    sourcemap: true,
    
    // Target browser compatibility
    target: 'esnext',
    
    // Minification settings with terser
    minify: 'terser',
    
    // Terser compression options for production
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: false,
        pure_funcs: [],
        passes: 1,
        warnings: false,
      },
      mangle: {
        reserved: [],
        keep_fnames: true, // Keep function names for debugging
      },
      format: {
        comments: false,
      },
    },
    
    // Rollup bundle configuration
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      
      output: {
        // Chunk naming pattern
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        
        // Asset naming pattern
        assetFileNames: (chunkInfo) => {
          const name = chunkInfo.name;
          if (/\.png$|\.jpg$|\.svg$/.test(name)) {
            return 'assets/images/[name][extname]';
          }
          if (/\.css$/.test(name)) {
            return 'assets/styles/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        
        // Manual chunking
        manualChunks,
        
        // Inline small assets (under 8KB) as data URIs
        inlineDynamicImports: true,
        
        // Preserve module structure for better debugging
        preserveEntrySignatures: 'exports-only',
      },
    },
    
    // Build performance optimization
    chunkSizeWarningLimit: 500,
    
    // CSS code splitting
    cssCodeSplit: true,
  },
  
  // Development server configuration
  server: {
    // Host binding for network access
    host: '0.0.0.0',
    
    // Port configuration
    port: 3000,
    
    // Auto-open browser on startup
    open: true,
    
    // Hot Module Replacement (HMR) settings
    hmr: {
      enabled: true,
      timeout: 30000,
      overlay: true,
      clientPort: 3000,
      path: '/__hmr',
    },
    
    // Proxy configuration for API calls
    proxy: {},
    
    // File watching options
    watch: {
      usePolling: false,
      interval: 100,
      ignore: ['node_modules/**', 'dist/**'],
    },
    
    // Strict port usage
    strictPort: true,
    
    // CORS headers
    cors: true,
    
    // Allowed origins
    allowedHosts: ['localhost', '127.0.0.1'],
  },
  
  // Resolve alias configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '#types': resolve(__dirname, 'src/types'),
      '#utils': resolve(__dirname, 'src/utils'),
      '#entities': resolve(__dirname, 'src/entities'),
      '#engine': resolve(__dirname, 'src/engine'),
      '#physics': resolve(__dirname, 'src/physics'),
      '#audio': resolve(__dirname, 'src/audio'),
      '#systems': resolve(__dirname, 'src/systems'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  
  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: ['zod', 'canvas-confetti'],
    exclude: [],
    force: false,
  },
  
  // CSS processing configuration
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
      scopeBehavior: 'local',
    },
    preprocessorOptions: {},
  },
  
  // Define global constants for environment detection
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'import.meta.env.DEV': JSON.stringify(process.env.NODE_ENV !== 'production'),
    'import.meta.env.PROD': JSON.stringify(process.env.NODE_ENV === 'production'),
  },
  
  // Plugins extension point
  plugins: [],
});