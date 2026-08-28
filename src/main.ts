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
    this.handleResize = this.handleResize.bind(this);
    this.handleStart = this.handleStart.bind(this);
    this.handleRestart = this.handleRestart.bind(this);
    this.handleTouch = this.handleTouch.bind(this);
    
    // Setup event listeners
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('keydown', this.input.onKeyDown.bind(this.input));
    document.addEventListener('keyup', this.input.onKeyUp.bind(this.input));
    this.canvas.addEventListener('mousedown', this.handleTouch);
    this.canvas.addEventListener('touchstart', this.handleTouch);
    
    // UI Elements
    this.uiOverlay = document.getElementById('uiOverlay');
    this.startScreen = document.getElementById('startScreen');
    this.gameOverScreen = document.getElementById('gameOverScreen');
    
    // Initial resize
    this.handleResize();
    
    // Store reference for debugging
    (window as any).__cardDriveDrift = this;
    
    console.log('[CardDriveDrift] Initialized successfully');
  }

  init(): void {
    // Create initial entities
    this.createPlayer();
    this.generateTrack(50);
    this.createParticles(10);
    
    // Start engine
    this.engine.start();
    this.gameStarted = true;
    this.lastTime = performance.now();
    
    if (this.startScreen) {
      this.startScreen.style.display = 'none';
    }
    
    console.log('[CardDriveDrift] Game initialized');
  }

  createPlayer(): void {
    const player = new CardVehicle(100, 300, {
      width: 60,
      height: 40,
      color: '#ff6b6b',
      maxSpeed: 800,
      acceleration: 400,
      friction: 0.95,
      driftFactor: 0.85
    });
    
    player.setPosition(100, 300);
    this.entityMgr.addEntity(player);
    this.vehicle = player;
  }

  generateTrack(segmentCount: number): void {
    let x = 0;
    let y = 300;
    
    for (let i = 0; i < segmentCount; i++) {
      const width = 200 + Math.random() * 300;
      const height = 40 + Math.random() * 60;
      
      const segment = new TrackSegment(x, y, width, height);
      this.entityMgr.addEntity(segment);
      
      // Random gap between segments
      const gap = 50 + Math.random() * 100;
      x += width + gap;
      
      // Random height variation
      y += (Math.random() - 0.5) * 200;
      y = Math.max(100, Math.min(window.innerHeight - 150, y));
    }
    
    // Add finish line
    const finishLine = new TrackSegment(x, y - 100, 400, 100, { color: '#4ecdc4' });
    finishLine.isFinishLine = true;
    this.entityMgr.addEntity(finishLine);
  }

  createParticles(count: number): void {
    for (let i = 0; i < count; i++) {
      const particle = new Particle(
        Math.random() * window.innerWidth,
        Math.random() * window.innerHeight,
        {
          size: 2 + Math.random() * 3,
          speedX: (Math.random() - 0.5) * 2,
          speedY: (Math.random() - 0.5) * 2,
          color: `hsla(${Math.random() * 360}, 70%, 60%, ${0.3 + Math.random() * 0.4})`,
          life: 100 + Math.random() * 100
        }
      );
      this.entityMgr.addEntity(particle);
    }
  }

  gameLoop(currentTime: number): void {
    if (!this.gameStarted || this.gameOver) return;
    
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    
    // Update game state
    this.timeElapsed += deltaTime;
    
    // Update entities
    this.engine.update(deltaTime);
    
    // Check win condition
    if (this.vehicle && this.vehicle.position.x > 8000) {
      this.endGame(true);
    }
    
    // Check lose condition (fell off track)
    if (this.vehicle && this.vehicle.position.y > window.innerHeight + 200) {
      this.endGame(false);
    }
    
    // Update score based on distance
    if (this.vehicle) {
      const currentDistance = this.vehicle.position.x;
      this.distance = currentDistance;
      this.score = Math.floor(currentDistance / 100);
      
      // Update UI
      this.updateUI();
    }
    
    // Render frame
    this.renderer.render(this.timeElapsed, this.input);
    
    // Continue loop
    this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
  }

  updateUI(): void {
    if (!this.uiOverlay) return;
    
    const scoreEl = this.uiOverlay.querySelector('.score') as HTMLElement;
    const distanceEl = this.uiOverlay.querySelector('.distance') as HTMLElement;
    const timeEl = this.uiOverlay.querySelector('.time') as HTMLElement;
    
    if (scoreEl) scoreEl.textContent = `Score: ${this.score}`;
    if (distanceEl) distanceEl.textContent = `${Math.floor(this.distance)}m`;
    if (timeEl) timeEl.textContent = `${this.timeElapsed.toFixed(1)}s`;
  }

  endGame(victory: boolean): void {
    this.gameOver = true;
    this.gameStarted = false;
    
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    
    if (this.gameOverScreen) {
      const resultEl = this.gameOverScreen.querySelector('.result') as HTMLElement;
      const finalScoreEl = this.gameOverScreen.querySelector('.final-score') as HTMLElement;
      const restartBtn = this.gameOverScreen.querySelector('.restart-btn') as HTMLElement;
      
      if (resultEl) {
        resultEl.textContent = victory ? '🏆 VICTORY!' : '💥 GAME OVER';
        resultEl.className = `result ${victory ? 'victory' : 'defeat'}`;
      }
      
      if (finalScoreEl) {
        finalScoreEl.textContent = `Final Score: ${this.score}`;
      }
      
      if (restartBtn) {
        restartBtn.onclick = this.handleRestart;
        restartBtn.style.display = 'block';
      }
      
      this.gameOverScreen.style.display = 'flex';
    }
    
    if (victory) {
      this.audio.playWinSound();
    } else {
      this.audio.playLoseSound();
    }
  }

  handleStart(): void {
    if (this.startScreen) {
      this.startScreen.style.display = 'none';
    }
    this.init();
  }

  handleRestart(): void {
    // Reset game state
    this.score = 0;
    this.distance = 0;
    this.timeElapsed = 0;
    this.gameOver = false;
    this.gameStarted = false;
    
    // Clear entities
    this.entityMgr.clearEntities();
    
    // Reinitialize
    this.createPlayer();
    this.generateTrack(50);
    this.createParticles(10);
    
    // Hide game over screen
    if (this.gameOverScreen) {
      this.gameOverScreen.style.display = 'none';
    }
    
    // Restart
    this.lastTime = performance.now();
    this.engine.start();
    this.gameLoop(performance.now());
  }

  handleTouch(e: MouseEvent | TouchEvent): void {
    if (!this.gameStarted || !this.vehicle) return;
    
    // Prevent default touch behavior
    if (e instanceof TouchEvent) {
      e.preventDefault();
    }
    
    // Apply boost on click/tap
    this.vehicle.applyBoost();
    this.audio.playBoostSound();
  }

  handleResize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.renderer.setSize(this.canvas.width, this.canvas.height);
  }

  destroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    this.engine.stop();
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('keydown', this.input.onKeyDown.bind(this.input));
    document.removeEventListener('keyup', this.input.onKeyUp.bind(this.input));
    this.canvas.removeEventListener('mousedown', this.handleTouch);
    this.canvas.removeEventListener('touchstart', this.handleTouch);
    
    console.log('[CardDriveDrift] Destroyed');
  }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const game = new CardDriveDrift();
  
  // Start button handler
  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    startBtn.addEventListener('click', () => game.handleStart());
  }
  
  // Touch handler for mobile
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  if (canvas) {
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      game.handleTouch(e);
    }, { passive: false });
  }
});

export { CardDriveDrift };