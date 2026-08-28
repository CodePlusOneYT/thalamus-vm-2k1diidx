import { Engine } from './engine/Engine.js';
import { InputManager } from './engine/InputManager.js';
import { EntityManager } from './engine/EntityManager.js';
import { SceneManager } from './engine/SceneManager.js';
import { RenderSystem } from './engine/RenderSystem.js';
import { AudioSystem } from './audio/AudioSystem.js';
import { VehiclePhysics } from './physics/VehiclePhysics.js';
import { DriftController } from './physics/DriftController.js';
import { CollisionSystem } from './physics/CollisionSystem.js';
import { PhysicsEngine } from './physics/PhysicsEngine.js';
import { Entity } from './entities/Entity.js';
import { CardVehicle } from './entities/CardVehicle.js';
import { TrackSegment } from './entities/TrackSegment.js';
import { Particle } from './entities/Particle.js';
import { Camera } from './entities/Camera.js';

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
  private physics: PhysicsEngine;
  private vehicle: CardVehicle | null = null;
  private lastTime: number = 0;
  private animationId: number | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private score: number = 0;
  private distance: number = 0;
  private timeElapsed: number = 0;
  private gameOver: boolean = false;
  private gameStarted: boolean = false;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    // Initialize systems
    this.input = new InputManager();
    this.audio = new AudioSystem();
    this.physics = new PhysicsEngine();
    this.renderer = new RenderSystem(this.canvas, this.ctx);
    this.entityMgr = new EntityManager();
    this.sceneMgr = new SceneManager(this.entityMgr);
    this.engine = new Engine(this.input, this.physics, this.renderer, this.entityMgr, this.sceneMgr);
    
    // Bind methods
    this.init = this.init.bind(this);
    this.gameLoop = this.gameLoop.bind(this);
    this.handleStart = this.handleStart.bind(this);
    this.restartGame = this.restartGame.bind(this);
  }

  async init(): Promise<void> {
    return new Promise((resolve) => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.start(resolve));
      } else {
        this.start(resolve);
      }
    });
  }

  private start(resolve: () => void): void {
    // Setup canvas
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    // Setup input listeners
    this.setupInputListeners();
    
    // Create initial scene
    this.createInitialScene();
    
    // Register global reference for debugging
    (window as unknown as Window).__cardDriveDrift = this;
    
    // Show start screen
    this.showStartScreen();
    
    resolve();
  }

  private resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    this.ctx.scale(dpr, dpr);
  }

  private setupInputListeners(): void {
    // Keyboard events
    document.addEventListener('keydown', (e: KeyboardEvent) => this.input.onKeyDown(e));
    document.addEventListener('keyup', (e: KeyboardEvent) => this.input.onKeyUp(e));
    
    // Touch events for mobile
    this.canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      this.gameStarted = true;
      this.audio.resume();
      this.handleStart();
    }, { passive: false });
    
    this.canvas.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.input.touchX = touch.clientX;
      this.input.touchY = touch.clientY;
      this.input.isTouching = true;
    }, { passive: false });
    
    this.canvas.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault();
      this.input.isTouching = false;
    });
    
    // Mouse events for desktop
    this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
      this.gameStarted = true;
      this.audio.resume();
      this.handleStart();
    });
    
    this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.input.mouseX = e.clientX - rect.left;
      this.input.mouseY = e.clientY - rect.top;
    });
    
    this.canvas.addEventListener('mouseup', () => {
      this.input.isMousePressed = false;
    });
  }

  private createInitialScene(): void {
    // Clear entities
    this.entityMgr.clearAll();
    
    // Create camera
    const camera = new Camera(800, 600);
    this.entityMgr.add(camera);
    
    // Create track segments
    this.generateTrackSegments();
    
    // Create player vehicle
    this.vehicle = new CardVehicle(100, 400);
    this.entityMgr.add(this.vehicle);
    
    // Create particles system
    for (let i = 0; i < 50; i++) {
      this.entityMgr.add(new Particle(0, 0));
    }
    
    this.score = 0;
    this.distance = 0;
    this.timeElapsed = 0;
    this.gameOver = false;
  }

  private generateTrackSegments(): void {
    let x = 0;
    let y = 400;
    
    for (let i = 0; i < 200; i++) {
      const segmentWidth = 100 + Math.random() * 100;
      const segmentHeight = 30 + Math.random() * 40;
      
      // Add variation to height
      if (i > 0 && i % 10 !== 0) {
        y += (Math.random() - 0.5) * 80;
        y = Math.max(200, Math.min(500, y));
      }
      
      const segment = new TrackSegment(x, y, segmentWidth, segmentHeight);
      this.entityMgr.add(segment);
      x += segmentWidth;
    }
  }

  private showStartScreen(): void {
    const centerX = this.canvas.width / (window.devicePixelRatio || 1) / 2;
    const centerY = this.canvas.height / (window.devicePixelRatio || 1) / 2;
    
    this.renderer.drawText('CARD DRIVE & DRIFT', centerX, centerY - 100, 48, '#ffffff');
    this.renderer.drawText('Press any key or tap to start', centerX, centerY, 24, '#ffffff');
    this.renderer.drawText('Arrow keys/WASD to drive', centerX, centerY + 40, 18, '#cccccc');
    this.renderer.drawText('Space/Shift to boost', centerX, centerY + 70, 18, '#cccccc');
  }

  private handleStart(): void {
    if (!this.gameStarted) {
      this.gameStarted = true;
      this.audio.playMusic();
      
      // Hide start screen
      const uiDiv = document.getElementById('uiOverlay') as HTMLDivElement;
      if (uiDiv) {
        uiDiv.style.display = 'none';
      }
      
      // Start game loop if not running
      if (!this.animationId) {
        this.lastTime = performance.now();
        this.animationId = requestAnimationFrame(this.gameLoop);
      }
    }
  }

  private gameLoop(currentTime: number): void {
    if (!this.gameStarted) {
      this.animationId = requestAnimationFrame(this.gameLoop);
      return;
    }
    
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    
    // Cap delta time to prevent huge jumps
    const cappedDelta = Math.min(deltaTime, 0.1);
    
    // Update game state
    this.update(cappedDelta);
    
    // Render
    this.render();
    
    // Continue loop
    this.animationId = requestAnimationFrame(this.gameLoop);
  }

  private update(deltaTime: number): void {
    if (this.gameOver) return;
    
    // Update time
    this.timeElapsed += deltaTime;
    
    // Update vehicle
    if (this.vehicle) {
      this.vehicle.update(deltaTime, this.input);
      
      // Update score based on distance traveled
      this.distance = this.vehicle.position.x;
      this.score = Math.floor(this.distance / 10);
      
      // Check collision with ground
      if (this.vehicle.position.y > 600) {
        this.triggerGameOver();
      }
      
      // Update camera to follow vehicle
      const camera = this.entityMgr.getEntitiesByType(Camera)[0] as Camera;
      if (camera) {
        camera.targetX = this.vehicle.position.x;
      }
    }
    
    // Update all entities
    const entities = this.entityMgr.getAll();
    for (const entity of entities) {
      if (entity instanceof Particle) {
        entity.update(deltaTime);
      }
    }
  }

  private render(): void {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);
    
    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, width, height);
    
    // Get camera
    const cameras = this.entityMgr.getEntitiesByType(Camera);
    const camera = cameras.length > 0 ? cameras[0] as Camera : null;
    
    // Save context for camera transform
    this.ctx.save();
    if (camera) {
      this.ctx.translate(-camera.x, -camera.y);
    }
    
    // Render all non-camera entities
    const entities = this.entityMgr.getAll();
    for (const entity of entities) {
      if (!(entity instanceof Camera)) {
        this.renderer.renderEntity(entity);
      }
    }
    
    // Restore context
    this.ctx.restore();
    
    // Render UI overlay
    this.renderUI(width, height);
  }

  private renderUI(width: number, height: number): void {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(10, 10, 200, 100);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 16px Arial';
    this.ctx.fillText(`Score: ${this.score}`, 20, 35);
    this.ctx.fillText(`Distance: ${Math.floor(this.distance)}m`, 20, 60);
    this.ctx.fillText(`Time: ${this.formatTime(this.timeElapsed)}`, 20, 85);
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  private triggerGameOver(): void {
    this.gameOver = true;
    this.audio.playSound('crash');
    
    // Show game over screen
    const uiDiv = document.getElementById('uiOverlay') as HTMLDivElement;
    if (uiDiv) {
      uiDiv.innerHTML = `
        <div class="game-over-screen">
          <h1>GAME OVER</h1>
          <p class="final-score">Score: ${this.score}</p>
          <p class="final-distance">Distance: ${Math.floor(this.distance)}m</p>
          <p class="final-time">Time: ${this.formatTime(this.timeElapsed)}</p>
          <button onclick="__cardDriveDrift.restartGame()">Play Again</button>
        </div>
      `;
      uiDiv.style.display = 'flex';
    }
  }

  restartGame(): void {
    this.createInitialScene();
    
    const uiDiv = document.getElementById('uiOverlay') as HTMLDivElement;
    if (uiDiv) {
      uiDiv.style.display = 'none';
    }
    
    this.gameStarted = true;
    this.lastTime = performance.now();
  }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const game = new CardDriveDrift();
  game.init().catch(console.error);
});