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
      },
    },
    
    // Target browsers
    target: 'ES2022',
    
    // Minification
    minify: 'terser',
    
    // Source maps for debugging
    sourcemap: true,
    
    // Terser options for better compression
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production',
        pure_funcs: process.env.NODE_ENV === 'production' ? ['console.log', 'console.warn'] : [],
      },
      mangle: true,
      format: {
        comments: false,
      },
    },
    
    // Code splitting
    codeSplitting: true,
    
    // Inline CSS into JS when small
    cssCodeSplit: true,
    
    // Chunk size warning limit (in KB)
    chunkSizeWarningLimit: 500,
    
    // Rollup bundle config
    lib: false,
  },
  
  // Development server settings
  server: {
    // Host for external access
    host: '0.0.0.0',
    
    // Port for development
    port: 3000,
    
    // Open browser automatically
    open: true,
    
    // HMR settings
    hmr: {
      // Heartbeat interval
      heartbeat: 10000,
      
      // Timeout for connection
      timeout: 30000,
      
      // Overlay errors in browser
      overlay: true,
    },
    
    // Proxy settings for API requests
    proxy: {},
    
    // Hot reload optimization
    watch: {
      // Use polling for file watching
      usePolling: false,
      
      // Interval for polling
      interval: 1000,
      
      // Ignore certain files/directories
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
    
    // CORS configuration
    cors: true,
    
    // Strict port usage
    strictPort: false,
    
    // Allow local network access
    allowedHosts: true,
    
    // Security headers for dev server
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    },
  },
  
  // Optimization settings
  optimizeDeps: {
    // Include dependencies to pre-bundle
    include: ['zod', 'canvas-confetti'],
    
    // Exclude from pre-bundling
    exclude: [],
    
    // Force re-bundle on changes
    force: false,
  },
  
  // CSS processing
  css: {
    // Preprocessor options
    preprocessorOptions: {},
    
    // PostCSS plugins
    postcss: {},
    
    // Modules configuration
    modules: {
      // Generate class names
      classNameStrategy: 'local',
    },
  },
  
  // Environment variables prefix
  envPrefix: 'VITE_',
});