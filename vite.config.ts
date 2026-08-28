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
    // Host for network access
    host: '0.0.0.0',
    
    // Port configuration
    port: parseInt(process.env.VITE_PORT || '3000'),
    
    // Open browser on start
    open: false,
    
    // Proxy configurations
    proxy: {},
    
    // Hot Module Replacement (HMR)
    hmr: {
      enabled: true,
      clientPort: parseInt(process.env.VITE_PORT || '3000'),
    },
    
    // File watching
    watch: {
      usePolling: false,
      interval: 100,
    },
    
    // Strict port checking
    strictPort: false,
    
    // CORS headers
    cors: true,
    
    // Allowed origins
    allowedHosts: ['localhost', '127.0.0.1'],
  },
  
  // Optimization settings
  optimizeDeps: {
    include: ['zod', 'canvas-confetti'],
    exclude: [],
    force: false,
  },
  
  // Define environment variables for client-side usage
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'import.meta.env.DEV': JSON.stringify(process.env.NODE_ENV !== 'production'),
    'import.meta.env.PROD': JSON.stringify(process.env.NODE_ENV === 'production'),
  },
  
  // TypeScript configuration override
  esbuild: {
    // Keep JSX for potential future React components
    jsx: 'preserve',
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    // Loader for additional file types
    loader: {
      '.json': 'jsx',
    },
  },
  
  // CSS processing
  css: {
    // Preprocessor options
    preprocessorOptions: {
      scss: {
        // Additional data for SCSS files
        additionalData: '',
      },
    },
    // PostCSS plugins
    postcss: {
      plugins: [],
    },
    // Modules configuration
    modules: {
      localsConvention: 'camelCase',
    },
  },
  
  // Resolve aliases
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
  
  // Plugin array for extensions
  plugins: [],
  
  // Log level
  logLevel: 'info',
});