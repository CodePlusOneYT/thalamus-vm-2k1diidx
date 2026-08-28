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
  
  // Game entities - vehicles, tracks, particle effects, camera
  entities: [
    './src/entities/Entity.ts',
    './src/entities/CardVehicle.ts',
    './src/entities/TrackSegment.ts',
    './src/entities/Particle.ts',
    './src/entities/Camera.ts',
  ],
  
  // Audio systems - synthesized sound effects and music
  audio: [
    './src/audio/AudioSystem.ts',
    './src/audio/AudioController.ts',
  ],
  
  // Card deck system - collectible card mechanics
  cardDeck: ['./src/systems/CardDeck.ts'],
};

export default defineConfig({
  // ============================================================================
  // PROJECT ROOT AND BASE PATHS
  // ============================================================================
  root: '.',
  base: '/',
  
  // Output directory for production build
  outDir: 'dist',
  
  // Clean output directory before build for fresh compilation
  cleanDist: true,
  
  // ============================================================================
  // SOURCE MAP GENERATION
  // ============================================================================
  // Enable source maps for both dev and production builds
  // Dev: full inline source maps for debugging
  // Prod: external .map files for better performance
  build: {
    sourcemap: true,
    
    // Rollup options for production bundle optimization
    rollupOptions: {
      // Entry points for multi-page app structure
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      
      // Output configuration for optimized bundles
      output: {
        // Manual chunking for better code splitting and caching
        manualChunks,
        
        // Asset file naming pattern
        assetFileNames: ({ name }) => {
          if (name && /\.(woff|woff2|eot|ttf|otf)$/.test(name)) {
            return 'assets/fonts/[name][extname]';
          }
          if (name && /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(name)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (name && /\.css$/.test(name)) {
            return 'assets/styles/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        
        // Chunk file naming pattern
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        
        // Inline small assets as data URIs
        inlineDynamicImports: false,
        
        // Preserve module structure for better tree-shaking
        preserveModules: false,
      },
    },
    
    // Minification settings using Terser
    minify: 'terser',
    
    // Terser minification options
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.warn', 'console.error'],
        passes: 2,
      },
      mangle: {
        safari10: true,
        reserved: ['CardDriveDrift', 'Engine', 'PhysicsEngine', 'AudioSystem'],
      },
      format: {
        comments: false,
      },
    },
    
    // Target browsers for compatibility
    target: 'es2022',
    
    // Module preloading configuration
    modulePreload: {
      polyfill: false,
    },
    
    // Report size for analysis
    reportCompressedSize: true,
    
    // Chunk size warning threshold (in kB)
    chunkSizeWarningLimit: 1000,
    
    // CSS code splitting
    cssCodeSplit: true,
  },
  
  // ============================================================================
  // DEVELOPMENT SERVER CONFIGURATION
  // ============================================================================
  server: {
    // Host binding for network access (Docker/container support)
    host: '0.0.0.0',
    
    // Development server port
    port: 3000,
    
    // Force reload on file changes
    force: true,
    
    // Hot Module Replacement (HMR) configuration
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: undefined, // Auto-detect
      timeout: 30000,
      overlay: true,
    },
    
    // Watch mode for file changes
    watch: {
      usePolling: false,
      interval: 100,
      binaryInterval: 100,
    },
    
    // Proxy configuration for API requests
    proxy: {},
    
    // Open browser on startup
    open: false,
    
    // Strict port checking
    strictPort: true,
    
    // Access from local network
    allowedHosts: true,
  },
  
  // ============================================================================
  // PREVIEW SERVER CONFIGURATION
  // ============================================================================
  preview: {
    // Preview server port
    port: 3000,
    
    // Host binding
    host: '0.0.0.0',
    
    // Open browser on preview
    open: false,
  },
  
  // ============================================================================
  // RESOLVE ALIASES
  // ============================================================================
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@engine': resolve(__dirname, 'src/engine'),
      '@physics': resolve(__dirname, 'src/physics'),
      '@entities': resolve(__dirname, 'src/entities'),
      '@audio': resolve(__dirname, 'src/audio'),
      '@systems': resolve(__dirname, 'src/systems'),
    },
    
    // Extensions to resolve
    extensions: ['.ts', '.js', '.tsx', '.jsx', '.json'],
  },
  
  // ============================================================================
  // OPTIMIZATION SETTINGS
  // ============================================================================
  optimizeDeps: {
    // Dependencies to pre-bundle
    include: ['zod', 'canvas-confetti'],
    
    // Exclude large dependencies from pre-bundling
    exclude: [],
    
    // Strength of dependency discovery
    force: false,
    
    // Esbuild loader for specific file types
    esbuildOptions: {
      // Define global constants
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      },
    },
  },
  
  // ============================================================================
  // CSS PROCESSING
  // ============================================================================
  css: {
    // CSS module configuration
    modules: {
      localsConvention: 'camelCaseOnly',
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
    
    // PostCSS configuration
    postcss: {
      plugins: [
        // You can add postcss plugins here if needed
      ],
    },
  },
  
  // ============================================================================
  // ENVIRONMENT VARIABLES
  // ============================================================================
  envPrefix: ['VITE_', 'CARD_'],
  
  // ============================================================================
  // LOGGING AND DEBUGGING
  // ============================================================================
  logLevel: 'info',
  
  // Suppress warnings
  clearScreen: true,
});