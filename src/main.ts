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
  private highScore: number = 0;

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
    const container = document.getElementById('gameContainer');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    
    // Store aspect ratio
    (this.canvas as any).aspectRatio = this.canvas.width / this.canvas.height;
  }

  private setupInputListeners(): void {
    this.input.setupKeyControls();
    
    // Handle start/restart on first key press
    document.addEventListener('keydown', (e) => {
      if (!this.gameStarted && !this.gameOver) {
        this.handleStart(e);
      }
    });
    
    // Mobile touch controls
    this.setupTouchControls();
  }

  private setupTouchControls(): void {
    let touchStartX = 0;
    let touchStartY = 0;
    
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      
      if (!this.gameStarted && !this.gameOver) {
        this.handleStart();
      }
    }, { passive: false });
    
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      
      const deltaX = touchX - touchStartX;
      const deltaY = touchY - touchStartY;
      
      // Update input based on touch movement
      this.input.update({
        left: Math.sign(deltaX) < 0 ? 1 : 0,
        right: Math.sign(deltaX) > 0 ? 1 : 0,
        up: Math.sign(deltaY) < 0 ? 1 : 0,
        down: Math.sign(deltaY) > 0 ? 1 : 0,
      });
    }, { passive: false });
    
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.input.releaseAll();
    });
  }

  private createInitialScene(): void {
    // Clear existing entities
    this.entityMgr.clear();
    
    // Create track
    this.createTrack();
    
    // Create player vehicle
    this.createPlayerVehicle();
    
    // Create camera
    this.createCamera();
  }

  private createTrack(): void {
    const segments: TrackSegment[] = [];
    const segmentCount = 100;
    let currentX = 0;
    let currentY = 300;
    const segmentWidth = 400;
    
    for (let i = 0; i < segmentCount; i++) {
      // Add some variation to height
      if (i > 5 && i < segmentCount - 5) {
        currentY += (Math.random() - 0.5) * 100;
        currentY = Math.max(200, Math.min(500, currentY));
      }
      
      const segment = new TrackSegment(currentX, currentY, segmentWidth);
      segments.push(segment);
      currentX += segmentWidth;
    }
    
    segments.forEach(segment => this.entityMgr.addEntity(segment));
  }

  private createPlayerVehicle(): void {
    this.vehicle = new CardVehicle(100, 200);
    this.entityMgr.addEntity(this.vehicle);
  }

  private createCamera(): void {
    const camera = new Camera(this.canvas.width / 2, this.canvas.height / 2);
    this.entityMgr.addEntity(camera);
  }

  private showStartScreen(): void {
    const uiContainer = document.getElementById('uiContainer');
    if (!uiContainer) return;
    
    uiContainer.innerHTML = `
      <div id="startScreen" class="screen active">
        <h1>🃏 Card Drive & Drift</h1>
        <p>Advanced Physics Racing Game</p>
        <div class="instructions">
          <h3>Controls:</h3>
          <p>⬆️ / W - Accelerate</p>
          <p>⬇️ / S - Brake/Reverse</p>
          <p>⬅️ / A - Steer Left</p>
          <p>➡️ / D - Steer Right</p>
          <p>Space - Handbrake</p>
        </div>
        <button id="startBtn" class="btn-primary">START ENGINE</button>
      </div>
      <div id="highScoreDisplay" class="hidden"></div>
    `;
    
    document.getElementById('startBtn')?.addEventListener('click', () => {
      this.handleStart();
    });
    
    // Load high score
    const storedHighScore = localStorage.getItem('cardDriveDriftHighScore');
    if (storedHighScore) {
      this.highScore = parseFloat(storedHighScore);
      document.getElementById('highScoreDisplay')!.innerHTML = `High Score: ${this.highScore.toFixed(2)}m`;
    }
  }

  private handleStart(event?: KeyboardEvent): void {
    if (this.gameStarted || this.gameOver) return;
    
    this.gameStarted = true;
    this.lastTime = performance.now();
    
    // Hide start screen
    const startScreen = document.getElementById('startScreen');
    if (startScreen) startScreen.classList.remove('active');
    
    // Resume audio context if needed
    this.audio.resume();
    
    // Start game loop
    this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
  }

  private restartGame(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    this.gameOver = false;
    this.gameStarted = false;
    this.score = 0;
    this.distance = 0;
    this.timeElapsed = 0;
    
    this.createInitialScene();
    this.showStartScreen();
  }

  private updateUI(): void {
    const scoreDisplay = document.getElementById('scoreDisplay');
    const speedDisplay = document.getElementById('speedDisplay');
    const driftDisplay = document.getElementById('driftDisplay');
    const distanceDisplay = document.getElementById('distanceDisplay');
    
    if (scoreDisplay) scoreDisplay.textContent = `Score: ${this.score.toFixed(0)}`;
    if (speedDisplay) speedDisplay.textContent = `Speed: ${(this.vehicle?.velocity.x || 0).toFixed(0)} km/h`;
    if (driftDisplay) driftDisplay.textContent = `Drift: ${this.vehicle?.driftScore.toFixed(0)} pts`;
    if (distanceDisplay) distanceDisplay.textContent = `Distance: ${this.distance.toFixed(0)}m`;
  }

  private showGameOverScreen(): void {
    const uiContainer = document.getElementById('uiContainer');
    if (!uiContainer) return;
    
    // Save high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('cardDriveDriftHighScore', this.highScore.toString());
    }
    
    uiContainer.innerHTML = `
      <div id="gameOverScreen" class="screen active">
        <h1>💥 CRASHED!</h1>
        <p class="final-score">Final Score: ${this.score.toFixed(0)}</p>
        <p class="final-distance">Distance: ${this.distance.toFixed(0)}m</p>
        <p class="final-time">Time: ${this.timeElapsed.toFixed(1)}s</p>
        <button id="restartBtn" class="btn-primary">RETRY</button>
        <button id="homeBtn" class="btn-secondary">MAIN MENU</button>
      </div>
    `;
    
    document.getElementById('restartBtn')?.addEventListener('click', () => {
      this.restartGame();
    });
    
    document.getElementById('homeBtn')?.addEventListener('click', () => {
      this.restartGame();
    });
  }

  private gameLoop(timestamp: number): void {
    if (!this.gameStarted) return;
    
    const deltaTime = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    
    // Cap delta time to prevent huge jumps
    const cappedDelta = Math.min(deltaTime, 0.1);
    
    // Update physics
    this.physics.update(cappedDelta);
    
    // Update entities
    this.entityMgr.update(cappedDelta);
    
    // Update game state
    if (this.vehicle) {
      this.distance += Math.abs(this.vehicle.velocity.x) * cappedDelta;
      this.timeElapsed += cappedDelta;
      
      // Calculate score based on distance and drift
      this.score = Math.floor(this.distance * 10 + this.vehicle.driftScore * 0.5);
    }
    
    // Check collision with ground (game over condition)
    if (this.vehicle && this.vehicle.isCrashed()) {
      this.gameOver = true;
      this.audio.playSound('crash');
      this.showGameOverScreen();
      return;
    }
    
    // Update camera
    this.entityMgr.getEntities().forEach(entity => {
      if (entity instanceof Camera) {
        (entity as Camera).update(this.vehicle);
      }
    });
    
    // Render
    this.renderer.render(this.entityMgr.getEntities(), this.vehicle);
    
    // Update UI
    this.updateUI();
    
    // Continue loop
    if (!this.gameOver) {
      this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
    }
  }
}

// Initialize game
const game = new CardDriveDrift();
game.init();

export { CardDriveDrift };