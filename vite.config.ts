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
        drop_console: false,
        drop_debugger: false,
        pure_funcs: [],
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Generate manifest for service worker
    manifest: true,
    
    // Chunk size warning limit (in KB)
    chunkSizeWarningLimit: 1000,
    
    // Log build statistics
    reportCompressedSize: true,
  },
  
  // Development server configuration
  server: {
    // Host binding
    host: '0.0.0.0',
    
    // Port
    port: 3000,
    
    // Open browser on start
    open: false,
    
    // Hot module replacement
    hmr: {
      host: 'localhost',
      protocol: 'ws',
      port: undefined,
      path: '/__vite_ws__',
    },
    
    // Watch files changes
    watch: {
      usePolling: false,
      interval: 1000,
      binaryInterval: 1000,
    },
    
    // Proxy configurations
    proxy: {},
    
    // Strict port mode
    strictPort: false,
    
    // CORS configuration
    cors: true,
    
    // Allowed origins
    allowedHosts: true,
    
    // File watching options
    fs: {
      allow: ['..'],
      strict: true,
    },
    
    // WebSocket server
    ws: {
      host: 'localhost',
    },
    
    // Header configuration
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  
  // Preview server configuration
  preview: {
    // Host binding
    host: '0.0.0.0',
    
    // Port
    port: 3000,
    
    // Open browser on start
    open: false,
    
    // Strict port mode
    strictPort: false,
    
    // CORS configuration
    cors: true,
  },
  
  // Resolve aliases
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '#': resolve(__dirname, 'public'),
    },
  },
  
  // CSS preprocessor settings
  css: {
    // Preprocessor options
    preprocessorOptions: {
      scss: {
        additionalData: '',
        silenceDeprecations: [],
      },
      less: {
        javascriptEnabled: true,
      },
      stylus: {},
    },
    
    // PostCSS plugins
    postcss: {
      plugins: [],
    },
    
    // Modules
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
  },
  
  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __ENVIRONMENT__: JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  
  // Optimize dependencies
  optimizeDeps: {
    // Include dependencies to pre-bundle
    include: ['zod', 'canvas-confetti'],
    
    // Exclude dependencies
    exclude: [],
    
    // Entries to pre-bundle
    entries: [],
    
    // Force re-bundle when deps change
    force: false,
    
    // Hold dependencies in memory
    holdUntilCrawlEnd: true,
    
    // Depth of dependency discovery
    depth: 10,
    
    // ESBuild options
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      target: 'esnext',
      supported: {
        dynamicImport: true,
      },
    },
  },
  
  // Worker configuration
  worker: {
    format: 'es',
    plugins: () => [],
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  
  // SSR configuration
  ssr: {
    // External packages
    noExternal: [],
    
    // External patterns
    external: [],
    
    // Dep optimization
    optimizeDeps: {
      include: [],
      exclude: [],
    },
  },
  
  // Environment variables loading
  envDir: '.',
  envPrefix: ['VITE_', 'CARD_', 'GAME_'],
  
  // Experimental features
  experimental: {
    // Async import conditions
    asyncContext: true,
    
    // Import meta glob
    importMetaGlob: true,
    
    // Inline styles
    inlineStylesCondition: '',
    
    // CSS imports
    cssLazyCompilation: false,
    
    // Web assembly support
    webAssembly: false,
    
    // Module preloading
    modulePreload: {
      polyfill: true,
    },
    
    // Preserve symlinks
    preserveSymlinks: false,
  },
  
  // Custom plugin hooks
  plugins: [],
  
  // Deps version check
  logLevel: 'info',
  
  // Log file
  logFile: '.vite/build.log',
  
  // Clear console on restart
  clearScreen: true,
  
  // Force config reload
  configFile: undefined,
  
  // Config file check
  configFileCheck: true,
  
  // Cache directory
  cacheDir: '.vite',
  
  // Timeouts
  buildTimeout: 30000,
  
  // Deps timeout
  depsCacheDir: '.vite/deps-cache',
});