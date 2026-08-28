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
    this.entityMgr.render(this.renderer.getCanvasContext());
    this.sceneMgr.render(this.renderer.getCanvasContext());
  }

  private handleInput(): void {
    this.input.update();
  }

  private onResize(): void {
    const canvas = this.renderer.getCanvas();
    const container = canvas.parentElement;
    
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      
      // Update viewport
      this.renderer.setViewport(canvas.width, canvas.height);
    }
  }
}

// Entry point
document.addEventListener('DOMContentLoaded', () => {
  try {
    const game = new CardDriveDrift();
    window.__cardDriveDrift = game;
    console.log('[CardDriveDrift] Game initialized successfully');
  } catch (error) {
    console.error('[CardDriveDrift] Failed to initialize:', error);
  }
});