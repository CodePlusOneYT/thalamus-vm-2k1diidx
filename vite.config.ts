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
  
  // Development server configuration
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: false,
    open: false,
    watch: {
      usePolling: false,
    },
    cors: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: undefined,
      clientPort: undefined,
    },
  },
  
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
    
    // Minification
    minify: 'terser',
    
    // Source maps for debugging
    sourcemap: true,
    
    // Terser options for better compression
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production',
        pure_funcs: ['console.log', 'console.info'],
      },
      mangle: true,
      format: {
        comments: false,
      },
    },
    
    // Generate source map
    generateSourceMaps: true,
    
    // Optimize bundle size
    chunkSizeWarningLimit: 500,
    reportCompressedSize: true,
  },
  
  // CSS settings
  css: {
    preprocessorOptions: {
      scss: {},
    },
    modules: {
      generateScopedName: '[name]_[local]_[hash:base64:5]',
    },
  },
  
  // Resolve aliases
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  
  // Define global constants
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    '__APP_VERSION__': JSON.stringify(process.env.npm_package_version || '1.0.0'),
  },
  
  // Optimizations
  optimizeDeps: {
    include: ['zod', 'canvas-confetti'],
    exclude: [],
  },
});