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
    
    // Generate source maps for debugging
    sourcemap: true,
    
    // Rollup options for code splitting
    rollupOptions: {
      // Input entry point
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      
      // Output configuration
      output: {
        // Asset naming pattern
        assetFileNames: ({ name }) => {
          const extType = name?.split('.').at(1);
          if (/\.(png|jpe?g|gif|svg|webp)$/i.test(String(name))) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/\.(woff2?|ttf|otf|eot)$/i.test(String(name))) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          if (/\.(mp3|wav|ogg)$/i.test(String(name))) {
            return `assets/audio/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        
        // Chunk naming pattern
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/chunks/[name]-[hash].js',
        cssFileNames: 'css/[name]-[hash].css',
        
        // Manual chunks configuration
        manualChunks,
      },
      
      // Preserve module structure
      preserveEntrySignatures: 'exports-only',
    },
    
    // Code size reporting
    reportCompressedSize: true,
    
    // Chunk size warning threshold (in kB)
    chunkSizeWarningLimit: 500,
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Empty outDir before build
    emptyOutDir: true,
  },
  
  // Development server configuration
  server: {
    // Host binding (accessible from network)
    host: '0.0.0.0',
    
    // Development server port
    port: 3000,
    
    // Open browser automatically
    open: true,
    
    // Force HTTPS in development
    https: false,
    
    // Proxy configuration for API requests
    proxy: {},
    
    // File watching options
    watch: {
      usePolling: false,
      interval: 100,
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
    
    // Server headers
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
    
    // Exclude large dependencies
    exclude: [],
    
    // Force re-bundle on deps change
    force: false,
  },
  
  // Preload settings
  preload: {
    // Enable preloading
    enabled: true,
    
    // Preload strategies
    crossOrigin: 'anonymous',
  },
  
  // CSS processing
  css: {
    // CSS modules configuration
    modules: {
      localsConvention: 'camelCaseOnly',
      generateScopedName: '[name]-[local]-[hash:base64:8]',
    },
    
    // PostCSS plugins
    postcss: {
      plugins: [],
    },
  },
  
  // Define global constants
  define: {
    // Application version
    'import.meta.env.VITE_APP_VERSION': JSON.stringify('1.0.0'),
    
    // Environment detection
    'import.meta.env.PROD': JSON.stringify(process.env.NODE_ENV === 'production'),
    'import.meta.env.DEV': JSON.stringify(process.env.NODE_ENV === 'development'),
  },
  
  // Resolve aliases
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  
  // Plugin configuration space (for future plugins)
  plugins: [],
});