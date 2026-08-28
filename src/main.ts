import { Engine } from './engine/Engine.js';
import { InputManager } from './engine/InputManager.js';
import { EntityManager } from './engine/EntityManager.js';
import { SceneManager } from './engine/SceneManager.js';
import { RenderSystem } from './engine/RenderSystem.js';
import { AudioSystem } from './audio/AudioSystem.js';

interface Window {
  __cardDriveDrift?: CardDriveDrift;
}

class CardDriveDrift {
  private engine: Engine;
  private input: InputManager;
  private entityMgr: EntityManager;
  private sceneMgr: SceneManager;
  private renderer: RenderSystem;
  private audio: AudioSystem;

  constructor() {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    
    if (!canvas) {
      throw new Error('Canvas element not found');
    }

    this.input = new InputManager();
    this.audio = new AudioSystem();
    
    this.renderer = new RenderSystem(canvas);
    this.sceneMgr = new SceneManager(this.renderer);
    this.entityMgr = new EntityManager();
    
    this.engine = new Engine(
      () => this.update(),
      () => this.render(),
      () => this.handleInput(),
      this.renderer.getCanvas().width,
      this.renderer.getCanvas().height
    );

    window.addEventListener('resize', () => this.onResize());
    
    // Initialize game state
    this.init();
  }

  private init(): void {
    console.log('[CardDriveDrift] Initializing...');
    
    // Resume audio context on first interaction
    this.audio.resume();
    
    // Start engine
    this.engine.start();
    
    console.log('[CardDriveDrift] Ready');
  }

  private update(deltaTime: number): void {
    this.input.update(deltaTime);
    this.entityMgr.update(deltaTime);
    this.sceneMgr.update(deltaTime);
  }

  private render(): void {
    this.renderer.clear();
    this.sceneMgr.render(this.renderer);
    this.entityMgr.render(this.renderer);
  }

  private handleInput(): void {
    this.input.processActions();
  }

  private onResize(): void {
    const canvas = this.renderer.getCanvas();
    const container = canvas.parentElement;
    
    if (container && this.engine) {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      
      this.renderer.setTransform(rect.width, rect.height);
      this.engine.resize(canvas.width, canvas.height);
    }
  }

  public destroy(): void {
    this.engine.stop();
    this.audio.destroy();
  }
}

// Global instance for debugging
let instance: CardDriveDrift | null = null;

window.addEventListener('DOMContentLoaded', () => {
  try {
    instance = new CardDriveDrift();
    (window as Window).__cardDriveDrift = instance;
  } catch (error) {
    console.error('[CardDriveDrift] Initialization failed:', error);
    const errorEl = document.getElementById('error-container');
    if (errorEl) {
      errorEl.innerHTML = `<div style="color: #ff4444; padding: 2rem; text-align: center;">
        <h1>Initialization Error</h1>
        <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>`;
    }
  }
});

export { CardDriveDrift };