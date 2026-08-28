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
  
  // Clean output directory on build
  cleanDir: true,
  
  // Sourcemap generation
  build: {
    sourcemap: true,
    
    // Minification with terser
    minify: 'terser',
    
    // Terser compression options
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: false,
        pure_funcs: [],
      },
      mangle: true,
      format: {
        comments: false,
      },
    },
    
    // Chunking strategy
    rollupOptions: {
      input: './index.html',
      output: {
        // Named chunks for better caching
        chunkFileNames: 'assets/chunks/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
      
      // Manual chunking
      preserveEntrySignatures: 'allow-extension',
    },
    
    // Target browsers
    target: 'es2022',
    
    // Assets inline threshold (base64 for small files)
    assetsInlineLimit: 1000,
    
    // Code splitting
    splitChunks: true,
    
    // Rollup plugins integration
    reportCompressedSize: true,
    bundleStats: true,
  },
  
  // Development server configuration
  server: {
    // Port
    port: 3000,
    
    // Host binding
    host: '0.0.0.0',
    
    // Open browser automatically
    open: true,
    
    // Hot module replacement
    hmr: {
      overlay: true,
      clientPort: 3000,
    },
    
    // Watch options
    watch: {
      usePolling: false,
      interval: 100,
      deepWatch: true,
    },
    
    // Proxy configuration (if needed)
    proxy: {},
    
    // Strict port mode
    strictPort: true,
    
    // Cors headers
    cors: true,
  },
  
  // CSS configuration
  css: {
    // Preprocessor options
    preprocessorOptions: {
      scss: {
        additionalData: '',
      },
      less: {
        additionalData: '',
      },
      stylus: {
        additionalData: '',
      },
    },
    
    // PostCSS plugins
    postcss: {
      plugins: [],
    },
    
    // Modules localIdentName
    modules: {
      generateScopedName: '[local]--[hash:base64:5]',
    },
  },
  
  // Resolve aliases
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@engine': resolve(__dirname, './src/engine'),
      '@physics': resolve(__dirname, './src/physics'),
      '@entities': resolve(__dirname, './src/entities'),
      '@audio': resolve(__dirname, './src/audio'),
      '@systems': resolve(__dirname, './src/systems'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  
  // Define global constants
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify('1.0.0'),
    'import.meta.env.VITE_APP_NAME': JSON.stringify('Card Drive & Drift'),
  },
  
  // Preview server configuration
  preview: {
    port: 3000,
    host: '0.0.0.0',
    open: false,
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['zod', 'canvas-confetti'],
    exclude: [],
    force: false,
  },
});