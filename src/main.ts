import { Engine } from './engine/Engine.js';
import { InputManager } from './engine/InputManager.js';
import { EntityManager } from './engine/EntityManager.js';
import { SceneManager } from './engine/SceneManager.js';
import { RenderSystem } from './engine/RenderSystem.js';
import { AudioSystem } from './audio/AudioSystem.js';
import { CardVehicle } from './entities/CardVehicle.js';
import { TrackSegment } from './entities/TrackSegment.js';
import { Particle } from './entities/Particle.js';
import { Camera } from './entities/Camera.js';
import { SceneType } from './engine/SceneManager.js';

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
  private lastTime: number = 0;
  private animationId: number | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gameState: 'menu' | 'playing' | 'paused' | 'gameover' = 'menu';

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    // Initialize systems
    this.input = new InputManager();
    this.audio = new AudioSystem();
    this.renderer = new RenderSystem(this.canvas, this.ctx);
    this.entityMgr = new EntityManager();
    this.sceneMgr = new SceneManager(this.entityMgr);
    this.engine = new Engine(
      this.input,
      this.audio,
      this.renderer,
      this.entityMgr,
      this.sceneMgr
    );
    
    // Bind methods
    this.init = this.init.bind(this);
    this.gameLoop = this.gameLoop.bind(this);
    this.handleResize = this.handleResize.bind(this);
    
    window.__cardDriveDrift = this;
  }

  init(): void {
    // Setup canvas dimensions
    this.resizeCanvas();
    
    // Setup input handlers
    this.input.setup();
    
    // Setup resize handler
    window.addEventListener('resize', this.handleResize);
    
    // Initial scene setup
    this.setupMenuScene();
    
    // Start game loop
    this.lastTime = performance.now();
    this.startGameLoop();
    
    console.log('Card Drive & Drift initialized successfully');
  }

  private setupMenuScene(): void {
    this.sceneMgr.setScene(SceneType.MENU);
    
    // Add menu background elements
    for (let i = 0; i < 50; i++) {
      const particle = new Particle(
        Math.random() * this.canvas.width,
        Math.random() * this.canvas.height,
        Math.random() * 2 + 1,
        Math.random() * 0.5 + 0.2,
        Math.random() * 0.3 + 0.1,
        '#ffffff',
        false
      );
      this.entityMgr.addEntity(particle);
    }
  }

  private startGameLevel(): void {
    this.gameState = 'playing';
    this.sceneMgr.setScene(SceneType.LEVEL_1);
    
    // Create player vehicle
    const vehicle = new CardVehicle(
      100,
      400,
      80,
      40,
      this.engine.physics,
      this.engine.audio
    );
    this.entityMgr.addEntity(vehicle);
    
    // Add camera
    const camera = new Camera(
      vehicle,
      this.canvas.width / 2,
      this.canvas.height / 2
    );
    this.entityMgr.addEntity(camera);
    
    // Generate track segments
    this.generateTrack();
    
    // Play music
    this.audio.playMusic();
  }

  private generateTrack(): void {
    let x = 0;
    let y = 400;
    
    // Starting platform
    for (let i = 0; i < 10; i++) {
      const segment = new TrackSegment(x, y, 100, 20, '#3a3a5c');
      this.entityMgr.addEntity(segment);
      x += 100;
    }
    
    // Generate track with variations
    for (let i = 0; i < 50; i++) {
      const segmentWidth = Math.random() * 100 + 80;
      const heightChange = (Math.random() - 0.5) * 60;
      y = Math.max(200, Math.min(600, y + heightChange));
      
      const segment = new TrackSegment(x, y, segmentWidth, 20, '#3a3a5c');
      this.entityMgr.addEntity(segment);
      
      // Random obstacles
      if (Math.random() > 0.7) {
        const obstacleY = y - 50;
        const obstacle = new TrackSegment(x + 30, obstacleY, 40, 10, '#8b0000');
        this.entityMgr.addEntity(obstacle);
      }
      
      // Random coins
      if (Math.random() > 0.6) {
        const coinX = x + segmentWidth / 2;
        const coinY = y - 40;
        const coin = new TrackSegment(coinX, coinY, 20, 20, '#ffd700', true);
        this.entityMgr.addEntity(coin);
      }
      
      x += segmentWidth + 20;
    }
  }

  private gameLoop(currentTime: number): void {
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    
    // Cap delta time to prevent physics issues
    const cappedDelta = Math.min(deltaTime, 0.1);
    
    // Update based on game state
    switch (this.gameState) {
      case 'menu':
        this.updateMenu(cappedDelta);
        break;
      case 'playing':
        this.updatePlaying(cappedDelta);
        break;
      case 'paused':
        this.updatePaused(cappedDelta);
        break;
      case 'gameover':
        this.updateGameOver(cappedDelta);
        break;
    }
    
    // Render everything
    this.render();
    
    // Continue loop
    this.animationId = requestAnimationFrame(this.gameLoop);
  }

  private updateMenu(deltaTime: number): void {
    // Menu logic - just render particles and wait for input
  }

  private updatePlaying(deltaTime: number): void {
    this.engine.update(deltaTime);
  }

  private updatePaused(deltaTime: number): void {
    // Pause logic - don't update physics
  }

  private updateGameOver(deltaTime: number): void {
    // Game over logic - show results
  }

  private render(): void {
    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Render entities
    this.renderer.render(this.entityMgr.getEntities());
  }

  private handleResize(): void {
    this.resizeCanvas();
  }

  private resizeCanvas(): void {
    const container = document.getElementById('gameContainer');
    if (container) {
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
    } else {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  }

  private startGameLoop(): void {
    this.animationId = requestAnimationFrame(this.gameLoop);
  }

  public stopGameLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public startGame(): void {
    this.startGameLevel();
  }

  public pauseGame(): void {
    if (this.gameState === 'playing') {
      this.gameState = 'paused';
    }
  }

  public resumeGame(): void {
    if (this.gameState === 'paused') {
      this.gameState = 'playing';
    }
  }

  public restartGame(): void {
    this.stopGameLoop();
    this.entityMgr.clearEntities();
    this.startGameLevel();
  }

  public quitToMenu(): void {
    this.stopGameLoop();
    this.entityMgr.clearEntities();
    this.gameState = 'menu';
    this.setupMenuScene();
    this.startGameLoop();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const game = new CardDriveDrift();
    game.init();
  });
} else {
  const game = new CardDriveDrift();
  game.init();
}