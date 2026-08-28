/**
 * Main Game Entry Point
 * Initializes all game systems and starts the game loop
 */
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
  private uiOverlay: HTMLElement | null = null;
  private startScreen: HTMLElement | null = null;
  private gameOverScreen: HTMLElement | null = null;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error(`Canvas element with id "${canvasId}" not found`);
    }
    
    // Set canvas dimensions
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    
    this.ctx = this.canvas.getContext('2d')!;
    if (!this.ctx) {
      throw new Error('Failed to get 2D context');
    }

    // Initialize systems
    this.engine = new Engine(this.canvas);
    this.input = new InputManager();
    this.entityMgr = new EntityManager();
    this.sceneMgr = new SceneManager();
    this.renderer = new RenderSystem(this.ctx, this.canvas);
    this.audio = new AudioSystem();
    this.physics = new PhysicsEngine();

    // Setup event listeners
    this.setupEventListeners();
    
    // Create UI overlay
    this.createUIOverlay();
    
    // Start game
    this.startGame();
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', () => this.handleResize());
    document.addEventListener('keydown', (e: KeyboardEvent) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e: KeyboardEvent) => this.handleKeyUp(e));
    
    // Touch support for mobile
    this.canvas.addEventListener('touchstart', (e: TouchEvent) => this.handleTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e: TouchEvent) => this.handleTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend', (e: TouchEvent) => this.handleTouchEnd(e), { passive: false });
  }

  private handleResize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.renderer.setCanvasSize(rect.width, rect.height);
  }

  private createUIOverlay(): void {
    // Check if UI already exists
    const existingUI = document.querySelector('.game-ui-overlay');
    if (existingUI) return;

    // Create container
    this.uiOverlay = document.createElement('div');
    this.uiOverlay.className = 'game-ui-overlay';
    this.uiOverlay.innerHTML = `
      <div class="hud">
        <div class="hud-item">
          <span class="label">Score</span>
          <span class="value" id="score-display">0</span>
        </div>
        <div class="hud-item">
          <span class="label">Distance</span>
          <span class="value" id="distance-display">0m</span>
        </div>
        <div class="hud-item">
          <span class="label">Speed</span>
          <span class="value" id="speed-display">0 km/h</span>
        </div>
        <div class="hud-item">
          <span class="label">Drift</span>
          <span class="value" id="drift-display">0x</span>
        </div>
      </div>
      
      <div class="overlay-screen start-screen" id="start-screen">
        <h1>Card Drive & Drift</h1>
        <p class="subtitle">Advanced Physics Racing Experience</p>
        <div class="controls-info">
          <div><strong>WASD / Arrows</strong> - Drive</div>
          <div><strong>Space</strong> - Brake</div>
          <div><strong>Shift</strong> - Handbrake / Drift</div>
        </div>
        <button class="btn btn-primary" id="start-btn">Start Game</button>
      </div>
      
      <div class="overlay-screen game-over-screen hidden" id="game-over-screen">
        <h2>Game Over</h2>
        <div class="stats">
          <div class="stat"><span class="label">Final Score:</span> <span class="value" id="final-score">0</span></div>
          <div class="stat"><span class="label">Total Distance:</span> <span class="value" id="final-distance">0m</span></div>
          <div class="stat"><span class="label">Max Speed:</span> <span class="value" id="max-speed">0 km/h</span></div>
        </div>
        <button class="btn btn-primary" id="restart-btn">Play Again</button>
      </div>
    `;

    document.body.appendChild(this.uiOverlay);

    // Bind buttons
    const startBtn = this.uiOverlay.querySelector('#start-btn') as HTMLButtonElement;
    const restartBtn = this.uiOverlay.querySelector('#restart-btn') as HTMLButtonElement;
    
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startGame());
    }
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.restartGame());
    }

    this.startScreen = this.uiOverlay.querySelector('.start-screen') as HTMLElement;
    this.gameOverScreen = this.uiOverlay.querySelector('.game-over-screen') as HTMLElement;
  }

  private updateHUD(): void {
    const scoreDisplay = this.uiOverlay?.querySelector('#score-display');
    const distanceDisplay = this.uiOverlay?.querySelector('#distance-display');
    const speedDisplay = this.uiOverlay?.querySelector('#speed-display');
    const driftDisplay = this.uiOverlay?.querySelector('#drift-display');

    if (scoreDisplay) scoreDisplay.textContent = Math.floor(this.score).toString();
    if (distanceDisplay) distanceDisplay.textContent = `${Math.floor(this.distance)}m`;
    if (speedDisplay && this.vehicle) {
      const speedKmh = Math.round(this.vehicle.velocity.x * 3.6);
      speedDisplay.textContent = `${speedKmh} km/h`;
    }
    if (driftDisplay && this.vehicle) {
      driftDisplay.textContent = `${this.vehicle.driftMultiplier.toFixed(1)}x`;
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    this.input.handleKeyDown(e);
    
    // Prevent default for game keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Shift'].includes(e.key)) {
      e.preventDefault();
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.input.handleKeyUp(e);
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (!this.gameStarted) return;
    
    const touch = e.touches[0];
    const canvasRect = this.canvas.getBoundingClientRect();
    const x = touch.clientX - canvasRect.left;
    const y = touch.clientY - canvasRect.top;
    
    // Simple touch controls: left side = brake, right side = accelerate
    if (x < canvasRect.width / 2) {
      this.input.pressKey('ArrowLeft');
    } else {
      this.input.pressKey('ArrowRight');
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
  }

  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    this.input.releaseAllKeys();
  }

  private startGame(): void {
    if (this.gameStarted) return;
    
    this.gameStarted = true;
    this.gameOver = false;
    this.score = 0;
    this.distance = 0;
    this.timeElapsed = 0;
    
    // Hide start screen
    if (this.startScreen) {
      this.startScreen.classList.add('hidden');
    }
    
    // Resume audio context on user gesture
    this.audio.resume();
    
    // Initialize level
    this.initLevel();
    
    // Start game loop
    this.lastTime = performance.now();
    this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
  }

  private initLevel(): void {
    // Clear existing entities
    this.entityMgr.clear();
    
    // Create player vehicle
    const startX = 100;
    const startY = 400;
    
    this.vehicle = new CardVehicle(startX, startY);
    this.vehicle.name = 'player';
    this.entityMgr.add(this.vehicle);
    
    // Generate track segments
    const segmentWidth = 200;
    const numSegments = 50;
    
    let currentX = 0;
    let currentY = 400;
    let slope = 0;
    
    for (let i = 0; i < numSegments; i++) {
      // Add variety to track
      const variation = Math.sin(i * 0.5) * 50 + Math.cos(i * 0.3) * 30;
      const difficulty = Math.min(i / numSegments, 1);
      
      currentY += slope + variation;
      currentY = Math.max(200, Math.min(600, currentY));
      
      const segment = new TrackSegment(currentX, currentY);
      segment.name = `segment-${i}`;
      segment.difficulty = difficulty;
      this.entityMgr.add(segment);
      
      // Add obstacles based on difficulty
      if (difficulty > 0.3 && Math.random() > 0.7) {
        const obstacleType = Math.random() > 0.5 ? 'barrier' : 'spike';
        const obstacleHeight = obstacleType === 'barrier' ? 80 : 40;
        const obstacleX = currentX + segmentWidth / 2;
        const obstacleY = currentY - obstacleHeight;
        
        const obstacle = new Entity(obstacleX, obstacleY);
        obstacle.name = `obstacle-${i}`;
        obstacle.type = obstacleType;
        obstacle.width = obstacleType === 'barrier' ? 60 : 30;
        obstacle.height = obstacleHeight;
        obstacle.color = obstacleType === 'barrier' ? '#ff6b6b' : '#ffd93d';
        this.entityMgr.add(obstacle);
      }
      
      // Add coins based on difficulty
      if (difficulty > 0.2 && Math.random() > 0.6) {
        const coin = new Particle(currentX + segmentWidth / 2, currentY - 60);
        coin.name = `coin-${i}`;
        coin.type = 'coin';
        coin.width = 20;
        coin.height = 20;
        this.entityMgr.add(coin);
      }
      
      currentX += segmentWidth;
      slope = (Math.random() - 0.5) * 0.1;
    }
    
    // Create camera
    this.camera = new Camera(0, 0);
  }

  private gameLoop(timestamp: number): void {
    if (!this.gameStarted || this.gameOver) return;
    
    const deltaTime = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    
    // Cap delta time to prevent huge jumps
    const cappedDelta = Math.min(deltaTime, 0.1);
    
    // Update game state
    this.update(cappedDelta);
    
    // Render
    this.render();
    
    // Continue loop
    this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
  }

  private update(deltaTime: number): void {
    if (!this.vehicle) return;
    
    // Update vehicle physics
    this.physics.updateVehicle(this.vehicle, this.input, deltaTime);
    
    // Apply gravity
    this.physics.applyGravity(this.vehicle, deltaTime);
    
    // Update position
    this.vehicle.position.add(this.vehicle.velocity.mul(deltaTime));
    
    // Update collision detection
    this.physics.checkCollisions(this.vehicle, this.entityMgr.getAll());
    
    // Update camera
    if (this.camera) {
      this.camera.follow(this.vehicle, this.canvas.width, this.canvas.height);
    }
    
    // Update particles
    this.entityMgr.updateParticles(deltaTime);
    
    // Calculate score and distance
    this.distance += Math.abs(this.vehicle.velocity.x) * deltaTime;
    this.score += Math.abs(this.vehicle.velocity.x) * deltaTime * 0.1;
    
    // Add drift bonus
    if (this.vehicle.isDrifting) {
      this.score += 5 * deltaTime;
    }
    
    // Update HUD
    this.updateHUD();
    
    // Check for game over conditions
    this.checkGameOver();
  }

  private render(): void {
    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Apply camera transform
    this.ctx.save();
    if (this.camera) {
      this.ctx.translate(-this.camera.x, -this.camera.y);
    }
    
    // Draw background parallax
    this.drawBackground();
    
    // Draw entities
    for (const entity of this.entityMgr.getAll()) {
      if (entity instanceof TrackSegment) {
        this.renderer.drawTrackSegment(entity);
      } else if (entity instanceof CardVehicle) {
        this.renderer.drawCardVehicle(entity);
      } else if (entity instanceof Particle) {
        this.renderer.drawParticle(entity);
      } else {
        this.renderer.drawEntity(entity);
      }
    }
    
    this.ctx.restore();
    
    // Draw VFX
    this.drawVFX();
  }

  private drawBackground(): void {
    // Simple parallax stars
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 50; i++) {
      const x = ((i * 137) % this.canvas.width + this.camera?.x || 0) % this.canvas.width;
      const y = (i * 241) % this.canvas.height;
      const size = (i % 3) + 1;
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawVFX(): void {
    // Screen shake on impact
    if (this.vehicle?.impactVelocity && this.vehicle.impactVelocity > 5) {
      const shakeAmount = Math.min(this.vehicle.impactVelocity * 0.5, 20);
      const shakeX = (Math.random() - 0.5) * shakeAmount;
      const shakeY = (Math.random() - 0.5) * shakeAmount;
      this.ctx.translate(shakeX, shakeY);
    }
    
    // Draw particle effects
    for (const entity of this.entityMgr.getAll()) {
      if (entity instanceof Particle && entity.active) {
        this.renderer.drawParticle(entity);
      }
    }
  }

  private checkGameOver(): void {
    if (!this.vehicle) return;
    
    // Check if vehicle fell off track
    if (this.vehicle.position.y > 800 || this.vehicle.position.y < -200) {
      this.endGame();
      return;
    }
    
    // Check collision damage
    if (this.vehicle.health <= 0) {
      this.endGame();
      return;
    }
  }

  private endGame(): void {
    this.gameOver = true;
    this.gameStarted = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    // Show game over screen
    if (this.gameOverScreen) {
      this.gameOverScreen.classList.remove('hidden');
      
      const finalScore = this.uiOverlay?.querySelector('#final-score');
      const finalDistance = this.uiOverlay?.querySelector('#final-distance');
      const maxSpeed = this.uiOverlay?.querySelector('#max-speed');
      
      if (finalScore) finalScore.textContent = Math.floor(this.score).toString();
      if (finalDistance) finalDistance.textContent = `${Math.floor(this.distance)}m`;
      if (maxSpeed && this.vehicle) {
        const maxSpeedKmh = Math.round(Math.max(...Array.from({length: 100}, (_, i) => 
          this.vehicle!.velocity.x * 3.6 * (i / 100)
        )) * 3.6);
        maxSpeed.textContent = `${maxSpeedKmh} km/h`;
      }
    }
    
    // Play game over sound
    this.audio.playGameOver();
  }

  private restartGame(): void {
    this.startGame();
  }

  public destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.entityMgr.clear();
    this.input.destroy();
  }
}

// Export for global access
export { CardDriveDrift };

// Initialize when DOM is ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const game = new CardDriveDrift('game-canvas');
    (window as any).__cardDriveDrift = game;
  });
}