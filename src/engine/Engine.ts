/**
 * Core Game Engine - Fixed timestep game loop with accumulator
 * Provides start/stop/pause functionality and frame scheduling
 */

export type EngineConfig = {
  /** Target frames per second */
  targetFPS: number;
  /** Maximum delta time per frame (clamp) in seconds */
  maxDeltaTime: number;
  /** Fixed timestep for physics updates in seconds */
  fixedTimeStep: number;
  /** Maximum number of physics steps per frame */
  maxPhysicsSteps: number;
  /** Whether to auto-start the engine */
  autoStart: boolean;
  /** Canvas element selector or element */
  canvas: string | HTMLCanvasElement;
  /** Canvas width (if creating new) */
  width?: number;
  /** Canvas height (if creating new) */
  height?: number;
  /** Background color */
  backgroundColor?: string;
};

export type EngineState = 'stopped' | 'running' | 'paused';

export type FrameCallback = (deltaTime: number, fixedDeltaTime: number) => void;

const DEFAULT_CONFIG: EngineConfig = {
  targetFPS: 60,
  maxDeltaTime: 0.1,
  fixedTimeStep: 1 / 60,
  maxPhysicsSteps: 10,
  autoStart: true,
  canvas: '#game-canvas',
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
};

export class Engine {
  private config: EngineConfig;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: EngineState = 'stopped';
  private lastTime: number = 0;
  private accumulator: number = 0;
  private frameId: number | null = null;
  private frameCallbacks: Set<FrameCallback> = new Set();
  private fixedFrameCallbacks: Set<FrameCallback> = new Set();
  private startTime: number = 0;
  private totalFrames: number = 0;
  private fps: number = 0;
  private fpsUpdateTimer: number = 0;
  private frameCount: number = 0;

  constructor(config: Partial<EngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.canvas = this.initializeCanvas();
    this.ctx = this.canvas.getContext('2d')!;
    this.setupCanvas();
    
    if (this.config.autoStart) {
      this.start();
    }
  }

  private initializeCanvas(): HTMLCanvasElement {
    const canvasSelector = this.config.canvas;
    let canvas: HTMLCanvasElement;

    if (typeof canvasSelector === 'string') {
      const element = document.querySelector(canvasSelector);
      if (element instanceof HTMLCanvasElement) {
        canvas = element;
      } else {
        canvas = document.createElement('canvas');
        canvas.id = canvasSelector.replace('#', '');
        document.body.appendChild(canvas);
      }
    } else {
      canvas = canvasSelector;
    }

    return canvas;
  }

  private setupCanvas(): void {
    const { width, height, backgroundColor } = this.config;
    
    // Set canvas size
    this.canvas.width = width || 1280;
    this.canvas.height = height || 720;
    
    // Ensure canvas fits screen
    this.canvas.style.display = 'block';
    this.canvas.style.margin = '0 auto';
    
    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor((width || 1280) * dpr);
    this.canvas.height = Math.floor((height || 720) * dpr);
    this.canvas.style.width = `${width || 1280}px`;
    this.canvas.style.height = `${height || 720}px`;
    
    // Clear canvas with background color
    this.ctx.fillStyle = backgroundColor || '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Add resize listener
    window.addEventListener('resize', () => this.handleResize());
  }

  private handleResize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    
    this.ctx.scale(dpr, dpr);
  }

  public start(): void {
    if (this.state !== 'stopped') return;
    
    this.state = 'running';
    this.startTime = performance.now();
    this.lastTime = performance.now();
    this.accumulator = 0;
    
    this.loop(this.lastTime);
  }

  public stop(): void {
    this.state = 'stopped';
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  public pause(): void {
    if (this.state === 'running') {
      this.state = 'paused';
      if (this.frameId !== null) {
        cancelAnimationFrame(this.frameId);
        this.frameId = null;
      }
    }
  }

  public resume(): void {
    if (this.state === 'paused') {
      this.state = 'running';
      this.lastTime = performance.now();
      this.loop(this.lastTime);
    }
  }

  private loop(currentTime: number): void {
    if (this.state !== 'running') return;
    
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, this.config.maxDeltaTime);
    this.lastTime = currentTime;
    this.accumulator += deltaTime;
    
    // Update FPS counter
    this.fpsUpdateTimer += deltaTime;
    this.frameCount++;
    if (this.fpsUpdateTimer >= 1) {
      this.fps = Math.round(this.frameCount / this.fpsUpdateTimer);
      this.frameCount = 0;
      this.fpsUpdateTimer = 0;
    }
    
    // Fixed timestep physics updates
    while (this.accumulator >= this.config.fixedTimeStep && 
           this.totalFrames < this.config.maxPhysicsSteps) {
      this.update(this.config.fixedTimeStep);
      this.accumulator -= this.config.fixedTimeStep;
      this.totalFrames++;
    }
    
    // Render
    this.render(deltaTime + this.accumulator);
    
    // Continue loop
    this.frameId = requestAnimationFrame((time) => this.loop(time));
  }

  private update(fixedDeltaTime: number): void {
    for (const callback of this.fixedFrameCallbacks) {
      try {
        callback(fixedDeltaTime, fixedDeltaTime);
      } catch (error) {
        console.error('Fixed frame callback error:', error);
      }
    }
  }

  private render(deltaTime: number): void {
    for (const callback of this.frameCallbacks) {
      try {
        callback(deltaTime, this.config.fixedTimeStep);
      } catch (error) {
        console.error('Render callback error:', error);
      }
    }
  }

  public addFrameCallback(callback: FrameCallback): void {
    this.frameCallbacks.add(callback);
  }

  public removeFrameCallback(callback: FrameCallback): void {
    this.frameCallbacks.delete(callback);
  }

  public addFixedFrameCallback(callback: FrameCallback): void {
    this.fixedFrameCallbacks.add(callback);
  }

  public removeFixedFrameCallback(callback: FrameCallback): void {
    this.fixedFrameCallbacks.delete(callback);
  }

  public getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public getState(): EngineState {
    return this.state;
  }

  public getFPS(): number {
    return this.fps;
  }

  public getTotalFrames(): number {
    return this.totalFrames;
  }

  public clear(): void {
    const { backgroundColor } = this.config;
    this.ctx.fillStyle = backgroundColor || '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public reset(): void {
    this.stop();
    this.clear();
    this.accumulator = 0;
    this.totalFrames = 0;
    this.fps = 0;
    this.fpsUpdateTimer = 0;
    this.frameCount = 0;
  }
}

// Singleton instance export
let engineInstance: Engine | null = null;

export function getEngine(): Engine {
  if (!engineInstance) {
    engineInstance = new Engine({
      targetFPS: 60,
      maxDeltaTime: 0.1,
      fixedTimeStep: 1 / 60,
      maxPhysicsSteps: 10,
      autoStart: false,
      canvas: '#game-canvas',
      width: 1280,
      height: 720,
      backgroundColor: '#1a1a2e',
    });
  }
  return engineInstance;
}

export function createEngine(config: Partial<EngineConfig> = {}): Engine {
  engineInstance = new Engine(config);
  return engineInstance;
}

export function destroyEngine(): void {
  if (engineInstance) {
    engineInstance.stop();
    engineInstance = null;
  }
}