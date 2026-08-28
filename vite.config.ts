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
        assetFileNames: ({ name }) => {
          if (name?.endsWith('.svg')) return 'assets/favicon/[name]-[hash].[ext]';
          if (name?.endsWith('.png')) return 'assets/icons/[name]-[hash].[ext]';
          return 'assets/[name]-[hash].[ext]';
        },
        
        // JS chunks
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    
    // Target browsers
    target: 'ES2022',
    
    // Minification with Terser
    minify: 'terser',
    
    // Terser options for production optimization
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug'],
        passes: 2,
      },
      format: {
        comments: false,
      },
    },
    
    // Sourcemap generation for production debugging
    sourcemap: true,
    
    // Code splitting size warning threshold (in kB)
    chunkSizeWarningLimit: 500,
    
    // Rollup bundle report for analysis
    reportCompressedSize: true,
  },
  
  // Development server configuration
  server: {
    // Host binding for network access
    host: '0.0.0.0',
    
    // Dev server port
    port: 3000,
    
    // Open browser automatically
    open: true,
    
    // Proxy configuration
    proxy: {},
    
    // Hot Module Replacement (HMR)
    hmr: {
      // HMR WebSocket connection timeout
      timeout: 30000,
      
      // Force reload instead of update on errors
      force: false,
    },
    
    // File watching options
    watch: {
      // Use polling for filesystem watching
      usePolling: false,
      
      // Interval for polling
      interval: 1000,
    },
    
    // Strict port mode
    strictPort: false,
    
    // Cors headers
    cors: true,
  },
  
  // Source map configuration for development
  esbuild: {
    // Preserve line numbers in source maps
    keepNames: true,
    
    // Sourcemap inline for debugging
    sourcemap: true,
  },
  
  // Optimize dependencies caching
  optimizeDeps: {
    // Include dependencies to pre-bundle
    include: ['zod', 'canvas-confetti'],
    
    // Exclude large dependencies
    exclude: [],
    
    // Disable dependency discovery
    disabled: false,
  },
  
  // Define global constants
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version || '1.0.0'),
    'import.meta.env.VITE_APP_NAME': JSON.stringify('Card Drive & Drift'),
  },
  
  // CSS processing
  css: {
    // Preprocessor options
    preprocessorOptions: {},
    
    // PostCSS plugins
    postcss: {},
    
    // Modules configuration
    modules: {
      localsConvention: 'camelCase',
    },
  },
});