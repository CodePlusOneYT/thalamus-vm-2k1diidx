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
  // Base path for the application
  base: '/',
  
  // Root directory for source files
  root: process.cwd(),
  
  // Build configuration
  build: {
    // Target browser compatibility
    target: 'es2022',
    
    // Output directory
    outDir: 'dist',
    
    // Source map generation for production debugging
    sourcemap: true,
    
    // Minification settings using terser
    minify: 'terser',
    
    // Terser minification options
    terserOptions: {
      compress: {
        drop_console: false, // Keep console.log for debugging
        drop_debugger: true,
        pure_funcs: ['console.debug'],
        passes: 2,
      },
      mangle: {
        eval: true,
        toplevel: true,
        keep_fnames: false,
        keep_classnames: false,
      },
      format: {
        comments: false,
      },
    },
    
    // Rollup options for bundling
    rollupOptions: {
      // Input entry point
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      
      // Manual chunk splitting strategy
      output: {
        // Manual chunking configuration
        manualChunks,
        
        // Asset naming pattern
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          
          if (name.endsWith('.woff') || name.endsWith('.woff2')) {
            return 'assets/fonts/[name]-[hash][extname]';
          } else if (name.endsWith('.svg') || name.endsWith('.png') || name.endsWith('.jpg')) {
            return 'assets/images/[name]-[hash][extname]';
          } else if (name.endsWith('.js')) {
            return 'assets/js/[name]-[hash].js';
          } else if (name.endsWith('.css')) {
            return 'assets/css/[name]-[hash].css';
          }
          
          return 'assets/[name]-[hash][extname]';
        },
        
        // Chunk naming pattern
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        
        // Inline small assets as data URLs
        inlineDynamicImports: false,
        
        // Generate a manifest.json file
        preserveEntrySignatures: 'allow-extension',
      },
    },
    
    // Code splitting settings
    codeSplitting: true,
    
    // Module preloading
    modulePreload: {
      polyfill: true,
    },
    
    // CSS handling
    cssCodeSplit: true,
    
    // Empty chunks cleanup
    emptyOutDir: true,
    
    // Manifest generation
    manifest: true,
    
    // Rollup watch mode disabled for production builds
    watch: null,
    
    // Chunks limit per bundle
    chunkSizeWarningLimit: 1000,
    
    // Sourcemap for bundled output
    sourcemapIgnoreList: (relativeSourcePath) => {
      return relativeSourcePath.includes('node_modules');
    },
  },
  
  // Development server configuration
  server: {
    // Host binding for network access
    host: '0.0.0.0',
    
    // Development server port
    port: 3000,
    
    // Auto-open browser on start
    open: false,
    
    // Proxy configuration for API requests
    proxy: {},
    
    // HMR (Hot Module Replacement) configuration
    hmr: {
      // Enable hot module replacement
      enabled: true,
      
      // Client host (for custom setups)
      host: undefined,
      
      // Protocol timeout
      protocolTimeout: 30000,
      
      // Overlay configuration
      overlay: {
        errors: true,
        runtimeErrors: true,
      },
    },
    
    // File watching configuration
    watch: {
      // Use polling instead of native file watchers
      usePolling: false,
      
      // Interval for polling checks
      interval: 1000,
      
      // Ignore directories
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    },
    
    // CORS handling
    cors: true,
    
    // Strict port usage
    strictPort: false,
    
    // Allowed hosts
    allowedHosts: [],
    
    // Header injection
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block',
    },
  },
  
  // Preview server configuration
  preview: {
    // Preview server host
    host: '0.0.0.0',
    
    // Preview server port
    port: 3000,
    
    // Open browser automatically
    open: false,
    
    // Proxy configuration
    proxy: {},
    
    // Strict port usage
    strictPort: false,
    
    // Headers for security
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block',
    },
  },
  
  // Optimization settings
  optimizeDeps: {
    // Dependencies to exclude from optimization
    exclude: [],
    
    // Include specific dependencies
    include: ['zod', 'canvas-confetti'],
    
    // Force full resolution of dependencies
    force: false,
    
    // Hold until SSR entry
    holdUntilCsrEnd: true,
    
    // Entry points to scan
    entries: ['./src/main.ts'],
    
    // Discovery paths
    discover: true,
    
    // Max number of files to cache
    maxParallelFileOps: 50,
  },
  
  // Resolver aliases for cleaner imports
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@engine': resolve(__dirname, 'src/engine'),
      '@physics': resolve(__dirname, 'src/physics'),
      '@entities': resolve(__dirname, 'src/entities'),
      '@audio': resolve(__dirname, 'src/audio'),
      '@systems': resolve(__dirname, 'src/systems'),
    },
  },
  
  // Environment variables
  envPrefix: 'VITE_',
  
  // CSS configuration
  css: {
    // Preprocessor options
    preprocessorOptions: {},
    
    // PostCSS plugins
    postcss: {},
    
    // Modules configuration
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[name]__[local]--[hash:base64:5]',
    },
  },
  
  // Define global constants
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    __APP_VERSION__: JSON.stringify('1.0.0'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __BUILD_TIMESTAMP__: JSON.stringify(Date.now()),
  },
  
  // Log level
  logLevel: 'info',
  
  // Clear console on restart
  clearScreen: true,
  
  // Custom environment variables
  envDir: process.cwd(),
  
  // Cache directory
  cacheDir: 'node_modules/.vite',
  
  // Timezone override
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});