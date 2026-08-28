import { defineConfig } from 'vite';
import { resolve } from 'path';

// ============================================================================
// CARD DRIVE & DRIFT - VITE BUILD CONFIGURATION
// ============================================================================
// Production-optimized bundler settings with manual chunking strategy
// Separates vendor dependencies from game modules for optimal caching and
// progressive loading in the racing game application
// ============================================================================

/**
 * Manual chunking strategy for optimal code splitting
 * - vendor: External libraries (rarely change, cache-friendly)
 * - engine: Core engine systems (stable, shared across builds)
 * - physics: Physics calculations (heavy computation, separate bundle)
 * - entities: Game entity definitions (frequently updated during development)
 */
const manualChunks = {
  // External libraries that rarely change and can be cached separately
  vendor: ['zod', 'canvas-confetti'],
  
  // Engine core - handles game loop, input, scene management
  engine: [
    './src/engine/Engine.ts',
    './src/engine/InputManager.ts',
    './src/engine/EntityManager.ts',
    './src/engine/SceneManager.ts',
    './src/engine/RenderSystem.ts'
  ],
  
  // Physics systems - vehicle dynamics, collision detection, drift mechanics
  physics: [
    './src/physics/PhysicsEngine.ts',
    './src/physics/VehiclePhysics.ts',
    './src/physics/CollisionSystem.ts',
    './src/physics/DriftController.ts',
    './src/physics/MathUtils.ts'
  ],
  
  // Entity components - cards, vehicles, particles, tracks
  entities: [
    './src/entities/Entity.ts',
    './src/entities/CardVehicle.ts',
    './src/entities/TrackSegment.ts',
    './src/entities/Particle.ts',
    './src/entities/Camera.ts'
  ],
  
  // Audio systems - sound synthesis and playback
  audio: [
    './src/audio/AudioSystem.ts',
    './src/audio/AudioController.ts'
  ],
  
  // Game systems - card deck logic
  systems: [
    './src/systems/CardDeck.ts'
  ]
};

/**
 * Asset file naming strategy
 * Keeps assets organized by type for better browser caching
 */
function assetFileNames(chunkInfo) {
  const name = chunkInfo.name || '';
  if (name.includes('entity')) return 'assets/[name]-[hash].png';
  if (name.includes('track')) return 'assets/[name]-[hash].png';
  if (name.includes('particle')) return 'assets/[name]-[hash].png';
  return 'assets/[name]-[hash].[ext]';
}

// ============================================================================
// TERSER MINIFICATION CONFIGURATION
// ============================================================================
const terserOptions = {
  compress: {
    drop_console: false,      // Keep console.log for debugging in prod
    drop_debugger: true,      // Remove debugger statements
    pure_funcs: [],           // Functions safe to remove
    passes: 2                 // Multiple optimization passes
  },
  mangle: {
    toplevel: true,           // Mangle top-level names
    eval: false,              // Don't mangle eval() variables
    safari10: true            // Safari 10+ compatibility
  },
  format: {
    comments: false,          // Strip all comments
    beautify: false           // Minified output
  }
};

export default defineConfig({
  // Project root directory
  root: '.',
  
  // Base path for all assets
  base: '/',
  
  // Output directory for production build
  outDir: './dist',
  
  // Clean dist folder before each build
  cleanDist: true,
  
  // Source map generation for production debugging
  build: {
    sourcemap: true,          // Generate source maps for both dev and build
    
    // Rollup bundler options
    rollupOptions: {
      // Entry points configuration
      input: {
        main: resolve(__dirname, 'index.html'),
        engine: resolve(__dirname, 'src/main.ts')
      },
      
      // Output configuration with manual chunking
      output: {
        manualChunks,
        
        // Asset file naming pattern
        assetFileNames: assetFileNames,
        
        // Chunk naming patterns
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        
        // CSS output pattern
        cssChunkFileNames: 'css/[name]-[hash].css',
        
        // Inline small assets as data URIs (under 8KB)
        inlineDynamicImports: false,
        
        // Preserve module structure for better tree-shaking
        preserveEntrySignatures: 'exports-only'
      }
    },
    
    // Minification settings
    minify: 'terser',
    
    // Terser-specific options
    terserOptions,
    
    // Target browsers for compatibility
    target: 'esnext',
    
    // Optimize bundle size
    chunkSizeWarningLimit: 500,
    
    // Rollup plugins integration
    rollupPluginInjectPolyfills: true
  },
  
  // Development server configuration
  server: {
    // Host binding (allows external access)
    host: '0.0.0.0',
    
    // Development server port
    port: 3000,
    
    // Open browser automatically on start
    open: true,
    
    // Force reload on file changes
    force: true,
    
    // Hot Module Replacement (HMR) settings
    hmr: {
      enabled: true,
      timeout: 30000,
      overlay: true
    },
    
    // Proxy configuration for API calls
    proxy: {},
    
    // Strict port usage
    strictPort: false,
    
    // Allowed hosts whitelist
    allowedHosts: [
      '.local',
      '.localhost',
      '127.0.0.1',
      '::1'
    ],
    
    // WebSocket server settings
    wsHost: 'localhost',
    
    // File watching interval
    watch: {
      interval: 100,
      usePolling: true
    }
  },
  
  // Pre-transform optimizations
  optimizeDeps: {
    include: ['zod', 'canvas-confetti'],
    exclude: [],
    force: false
  },
  
  // CSS processing configuration
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
      scopeBehaviour: 'local',
      generateScopedName: '[name]__[local]--[hash:base64:5]'
    },
    preprocessorOptions: {}
  },
  
  // Define global constants
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    '__APP_VERSION__': JSON.stringify('1.0.0'),
    '__BUILD_DATE__': JSON.stringify(new Date().toISOString())
  },
  
  // Resolve alias paths
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '#constants': resolve(__dirname, 'src/constants'),
      '#types': resolve(__dirname, 'src/types'),
      '#utils': resolve(__dirname, 'src/utils')
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
  },
  
  // Plugins array for additional functionality
  plugins: []
});