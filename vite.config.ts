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
    
    // Source map generation for source-level debugging
    sourcemap: true,
    
    // Chunk size warning threshold in KB
    chunkSizeWarningLimit: 1000,
    
    // Rollup options
    rollupOptions: {
      // Manual chunking configuration
      output: {
        // Manual chunks for better code splitting
        manualChunks,
        
        // Asset filename pattern
        assetFileNames: ({ name }) => {
          if (name && name.endsWith('.png')) return 'assets/images/[name]-[hash][extname]';
          if (name && name.endsWith('.svg')) return 'assets/icons/[name]-[hash][extname]';
          if (name && name.endsWith('.json')) return 'assets/data/[name]-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        },
        
        // Entry point configuration
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: '[name]-[hash].js',
        // CSS output
        cssChunkFileNames: '[name]-[hash].css',
      },
      
      // Input files
      input: resolve(__dirname, 'index.html'),
      
      // Preserve module structure
      preserveEntrySignatures: 'allow-extension',
    },
    
    // Code split by route (not used here but good practice)
    codeSplitting: true,
    
    // Inline dynamic imports as small as possible
    inlineDynamicImports: false,
  },
  
  // Development server configuration
  server: {
    // Host binding (0.0.0.0 allows network access)
    host: '0.0.0.0',
    
    // Development server port
    port: 3000,
    
    // Auto-open browser on start
    open: true,
    
    // Proxy configuration for API endpoints
    proxy: {},
    
    // Hot Module Replacement (HMR)
    hmr: {
      enabled: true,
      host: 'localhost',
      protocol: 'ws',
    },
    
    // Watch options for file changes
    watch: {
      usePolling: false,
      interval: 100,
      ignore: ['node_modules/**', 'dist/**'],
    },
    
    // CORS headers
    cors: true,
    
    // Strict content security policy
    strictPort: false,
  },
  
  // Preview server configuration
  preview: {
    // Preview server port
    port: 3000,
    
    // Host binding
    host: '0.0.0.0',
    
    // Open browser automatically
    open: true,
  },
  
  // Define global constants
  define: {
    // Environment detection
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
    __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
  },
  
  // Optimize dependencies pre-bundling
  optimizeDeps: {
    // Dependencies to include in pre-bundle
    include: ['zod', 'canvas-confetti'],
    
    // Exclude unnecessary packages
    exclude: [],
    
    // Force re-bundle on dependency change
    force: false,
  },
  
  // Resolve module aliases
  resolve: {
    // Alias configuration
    alias: {
      '@': resolve(__dirname, 'src'),
      '@engine': resolve(__dirname, 'src/engine'),
      '@physics': resolve(__dirname, 'src/physics'),
      '@entities': resolve(__dirname, 'src/entities'),
      '@audio': resolve(__dirname, 'src/audio'),
      '@systems': resolve(__dirname, 'src/systems'),
    },
    
    // Extensions to resolve implicitly
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
    
    // Conditions for package exports
    mainFields: ['browser', 'module', 'main'],
  },
  
  // CSS configuration
  css: {
    // Preprocessor options
    preprocessorOptions: {},
    
    // PostCSS plugins
    postcss: {},
    
    // Modules configuration
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
  
  // Assets configuration
  assetsInclude: ['**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.svg'],
  
  // Log level (silent, info, warn, error, verbose)
  logLevel: 'info',
  
  // Custom logger
  customLogger: undefined,
  
  // SSR configuration (not using SSR for this game)
  ssr: {
    noExternal: [],
  },
});