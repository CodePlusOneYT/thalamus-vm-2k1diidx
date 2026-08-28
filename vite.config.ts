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
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    
    // Sourcemap generation for production
    sourcemap: true,
    
    // Code splitting threshold
    chunkSizeWarningLimit: 500,
    
    // Rollup compression options
    rollupOptions: {
      output: {
        manualChunks,
        inlineDynamicImports: true,
      },
    },
  },
  
  // Development server configuration
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: false,
    open: false,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 3000,
      clientPort: 3000,
    },
    watch: {
      usePolling: false,
      interval: 100,
    },
  },
  
  // Source map configuration
  css: {
    devSourcemap: true,
  },
  
  // Resolve aliases for cleaner imports
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
  
  // Optimizer settings
  optimizeDeps: {
    include: ['zod', 'canvas-confetti'],
    exclude: [],
    force: false,
  },
  
  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
});