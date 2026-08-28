/**
 * Card Drive & Drift - Main Entry Point
 * Advanced Physics Racing Game with Procedural Art
 */

import { Engine } from './engine/Engine.js';
import { InputManager } from './engine/InputManager.js';
import { EntityManager } from './engine/EntityManager.js';
import { SceneManager } from './engine/SceneManager.js';
import { PhysicsEngine } from './physics/PhysicsEngine.js';
import { CollisionSystem } from './physics/CollisionSystem.js';
import { DriftController } from './physics/DriftController.js';
import { AudioController } from './audio/AudioController.js';
import { RenderSystem } from './engine/RenderSystem.js';
import { Entity } from './entities/Entity.js';
import { CardVehicle } from './entities/CardVehicle.js';
import { TrackSegment } from './entities/TrackSegment.js';
import { Particle } from './entities/Particle.js';
import { Camera } from './entities/Camera.js';
import { Vector2 } from './physics/MathUtils.js';
import { CardDeck } from './systems/CardDeck.js';

// Game configuration constants
const CONFIG = {
  FPS: 60,
  FIXED_TIME_STEP: 1 / 60,
  MAX_FRAME_CAP: 1 / 30,
  GRAVITY: new Vector2(0, 980), // pixels per second squared
  FRICTION: 0.98,
  AIR_RESISTANCE: 0.95,
};

// Game state enumeration
enum GameState {
  MENU,
  PLAYING,
  PAUSED,
  GAME_OVER,
  VICTORY,
}

class CardDriveGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: Engine;
  private inputManager: InputManager;
  private entityManager: EntityManager;
  private sceneManager: SceneManager;
  private physicsEngine: PhysicsEngine;
  private collisionSystem: CollisionSystem;
  private driftController: DriftController;
  private audioController: AudioController;
  private renderSystem: RenderSystem;
  private cardDeck: CardDeck;
  
  // Game state
  private gameState: GameState = GameState.MENU;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private deltaTime: number = 0;
  
  // Player and camera
  private player: CardVehicle | null = null;
  private camera: Camera | null = null;
  
  // Track segments
  private trackSegments: TrackSegment[] = [];
  private particles: Particle[] = [];
  
  // Score and stats
  private score: number = 0;
  private distanceTraveled: number = 0;
  private maxDistance: number = 0;
  private lapCount: number = 0;
  private totalTime: number = 0;
  
  // Timing for difficulty scaling
  private timeScale: number = 1.0;
  private startTime: number = 0;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error('Canvas element not found');
    }
    
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Could not get 2D context');
    }

    this.init();
  }

  private init(): void {
    // Initialize systems
    this.engine = new Engine();
    this.inputManager = new InputManager();
    this.entityManager = new EntityManager();
    this.sceneManager = new SceneManager();
    this.physicsEngine = new PhysicsEngine();
    this.collisionSystem = new CollisionSystem(this);
    this.driftController = new DriftController();
    this.audioController = new AudioController();
    this.renderSystem = new RenderSystem(this);
    this.cardDeck = new CardDeck();

    // Resize canvas to window size
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Setup input handlers
    this.setupInputHandlers();

    // Initialize audio (will resume on first interaction)
    this.audioController.init();

    // Show initial menu
    this.showMenu();
  }

  private resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    this.ctx.scale(dpr, dpr);
    
    // Update canvas CSS size
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  private setupInputHandlers(): void {
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    document.addEventListener('keyup', (e) => {
      this.handleKeyUp(e);
    });

    // Touch controls for mobile
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleTouchStart(e.touches[0]);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.handleTouchMove(e.touches[0]);
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.handleTouchEnd();
    });

    // Mouse controls
    this.canvas.addEventListener('mousedown', (e) => {
      this.handleMouseDown(e);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      this.handleMouseMove(e);
    });

    this.canvas.addEventListener('mouseup', (e) => {
      this.handleMouseUp();
    });

    // Click to start/resume
    this.canvas.addEventListener('click', () => {
      if (this.gameState === GameState.MENU || 
          this.gameState === GameState.GAME_OVER || 
          this.gameState === GameState.VICTORY) {
        this.startGame();
      } else if (this.gameState === GameState.PAUSED) {
        this.resumeGame();
      }
    });
  }

  private handleKeyDown(e: KeyboardEvent): void {
    this.inputManager.onKeyDown(e.key, e.code);
    
    switch (e.code) {
      case 'KeyP':
        this.togglePause();
        break;
      case 'Escape':
        if (this.gameState === GameState.PLAYING) {
          this.pauseGame();
        }
        break;
      case 'KeyR':
        if (this.gameState === GameState.GAME_OVER || this.gameState === GameState.VICTORY) {
          this.restartGame();
        }
        break;
      case 'Space':
        if (this.gameState === GameState.MENU) {
          this.startGame();
        }
        break;
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.inputManager.onKeyUp(e.key, e.code);
  }

  private handleTouchStart(touch: Touch): void {
    // Touch controls - tap left/right side for steering
    const rect = this.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const width = rect.width;
    
    if (x < width / 2) {
      this.inputManager.onKeyDown('ArrowLeft', 'ArrowLeft');
    } else {
      this.inputManager.onKeyDown('ArrowRight', 'ArrowRight');
    }
  }

  private handleTouchMove(touch: Touch): void {
    // Continuous touch movement for steering
    const rect = this.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const width = rect.width;
    
    if (x < width / 2) {
      this.inputManager.onKeyDown('ArrowLeft', 'ArrowLeft');
    } else {
      this.inputManager.onKeyDown('ArrowRight', 'ArrowRight');
    }
  }

  private handleTouchEnd(): void {
    this.inputManager.onKeyUp('ArrowLeft', 'ArrowLeft');
    this.inputManager.onKeyUp('ArrowRight', 'ArrowRight');
  }

  private handleMouseDown(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    
    if (x < width / 2) {
      this.inputManager.onKeyDown('ArrowLeft', 'ArrowLeft');
    } else {
      this.inputManager.onKeyDown('ArrowRight', 'ArrowRight');
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    // Optional: mouse follow for steering
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    
    if (x < width / 2 && !this.inputManager.isKeyDown('ArrowLeft')) {
      this.inputManager.onKeyDown('ArrowLeft', 'ArrowLeft');
    } else if (x >= width / 2 && !this.inputManager.isKeyDown('ArrowRight')) {
      this.inputManager.onKeyDown('ArrowRight', 'ArrowRight');
    }
  }

  private handleMouseUp(): void {
    this.inputManager.onKeyUp('ArrowLeft', 'ArrowLeft');
    this.inputManager.onKeyUp('ArrowRight', 'ArrowRight');
  }

  private showMenu(): void {
    this.gameState = GameState.MENU;
    this.renderSystem.clearScreen('#0a0a1a');
    this.renderSystem.drawMenu();
  }

  private startGame(): void {
    this.audioController.playMusic('menu');
    this.resetGame();
    this.gameState = GameState.PLAYING;
    this.startTime = performance.now();
    
    // Create player vehicle
    this.createPlayer();
    
    // Generate track
    this.generateTrack();
    
    // Create camera
    this.createCamera();
    
    // Resume audio context
    this.audioController.resume();
  }

  private resetGame(): void {
    this.score = 0;
    this.distanceTraveled = 0;
    this.maxDistance = 0;
    this.lapCount = 0;
    this.totalTime = 0;
    this.timeScale = 1.0;
    
    // Clear entities
    this.entityManager.clear();
    this.trackSegments = [];
    this.particles = [];
    
    // Reset physics
    this.physicsEngine.reset();
  }

  private restartGame(): void {
    this.resetGame();
    this.createPlayer();
    this.generateTrack();
    this.createCamera();
    this.gameState = GameState.PLAYING;
    this.startTime = performance.now();
    this.audioController.playSound('restart');
  }

  private createPlayer(): void {
    const spawnX = 100;
    const spawnY = this.canvas.clientHeight / 2;
    
    this.player = new CardVehicle(
      spawnX,
      spawnY,
      new Vector2(0, 0),
      0,
      30, // radius
      40, // width
      60, // height
      this
    );
    
    this.player.setVelocity(new Vector2(200, 0));
    this.player.setRotation(Math.PI / 2);
    
    this.entityManager.add(this.player);
  }

  private generateTrack(): void {
    const segmentWidth = 150;
    const totalSegments = 100;
    let currentX = 0;
    let currentY = this.canvas.clientHeight / 2;
    let direction = 1; // 1 for right, -1 for left
    
    for (let i = 0; i < totalSegments; i++) {
      // Add some randomness to segment height
      const heightVariation = Math.sin(i * 0.5) * 100;
      currentY += heightVariation * 0.5;
      
      // Keep within bounds
      currentY = Math.max(50, Math.min(this.canvas.clientHeight - 50, currentY));
      
      // Create track segment
      const segment = new TrackSegment(
        currentX,
        currentY,
        segmentWidth,
        20, // thickness
        i,
        this
      );
      
      this.trackSegments.push(segment);
      this.entityManager.add(segment);
      
      currentX += segmentWidth * direction;
      
      // Occasionally change direction
      if (Math.random() < 0.1) {
        direction *= -1;
      }
    }
  }

  private createCamera(): void {
    if (!this.player) return;
    
    this.camera = new Camera(
      this.player.position.x - this.canvas.clientWidth / 2,
      this.player.position.y - this.canvas.clientHeight / 2,
      this.canvas.clientWidth,
      this.canvas.clientHeight,
      this
    );
  }

  private pauseGame(): void {
    if (this.gameState !== GameState.PLAYING) return;
    
    this.gameState = GameState.PAUSED;
    this.audioController.pauseMusic();
    this.audioController.playSound('pause');
  }

  private resumeGame(): void {
    if (this.gameState !== GameState.PAUSED) return;
    
    this.gameState = GameState.PLAYING;
    this.audioController.resumeMusic();
    this.startTime = performance.now() - this.totalTime;
  }

  private togglePause(): void {
    if (this.gameState === GameState.PLAYING) {
      this.pauseGame();
    } else if (this.gameState === GameState.PAUSED) {
      this.resumeGame();
    }
  }

  private gameOver(): void {
    this.gameState = GameState.GAME_OVER;
    this.audioController.playSound('crash');
    this.audioController.stopMusic();
    this.renderSystem.drawGameOver(this.score, this.distanceTraveled);
  }

  private victory(): void {
    this.gameState = GameState.VICTORY;
    this.audioController.playSound('win');
    this.audioController.stopMusic();
    this.renderSystem.drawVictory(this.score, this.distanceTraveled, this.lapCount);
  }

  private update(deltaTime: number): void {
    // Update time tracking
    this.totalTime = performance.now() - this.startTime;
    
    // Apply time scale for difficulty
    deltaTime *= this.timeScale;
    
    // Update physics
    this.physicsEngine.update(deltaTime);
    
    // Update collision system
    this.collisionSystem.update(deltaTime);
    
    // Update drift controller
    this.driftController.update(deltaTime);
    
    // Update entities
    this.entityManager.update(deltaTime);
    
    // Update camera
    if (this.camera && this.player) {
      this.camera.update(deltaTime);
    }
    
    // Update particles
    this.updateParticles(deltaTime);
    
    // Update score based on distance
    if (this.player) {
      const currentDistance = Math.abs(this.player.position.x);
      const distanceDelta = currentDistance - this.distanceTraveled;
      
      if (distanceDelta > 0) {
        this.distanceTraveled = currentDistance;
        this.score += Math.floor(distanceDelta / 10);
        
        // Increase difficulty over time
        this.timeScale = 1.0 + (this.distanceTraveled / 10000) * 0.5;
      }
    }
    
    // Check game over conditions
    this.checkGameOver();
    this.checkVictory();
  }

  private updateParticles(deltaTime: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(deltaTime);
      
      if (this.particles[i].isDead()) {
        this.particles.splice(i, 1);
      }
    }
  }

  private checkGameOver(): void {
    if (!this.player) return;
    
    // Check if player fell off the track
    if (this.player.position.y > this.canvas.clientHeight + 100) {
      this.gameOver();
    }
    
    // Check if player crashed into obstacles
    if (this.player.health <= 0) {
      this.gameOver();
    }
  }

  private checkVictory(): void {
    // Victory condition: reach certain distance
    const victoryDistance = 5000;
    
    if (this.distanceTraveled >= victoryDistance) {
      this.victory();
    }
  }

  private render(): void {
    // Clear screen
    this.renderSystem.clearScreen('#0a0a1a');
    
    // Draw background
    this.renderSystem.drawBackground();
    
    // Draw track segments
    this.renderSystem.drawTrackSegments(this.trackSegments);
    
    // Draw particles
    this.renderSystem.drawParticles(this.particles);
    
    // Draw entities
    this.entityManager.render(this.ctx, this.camera);
    
    // Draw UI overlay
    this.renderSystem.drawUI(this.score, this.distanceTraveled, this.totalTime, this.gameState);
    
    // Draw debug info (toggle with key D)
    if (this.inputManager.isKeyDown('KeyD')) {
      this.renderSystem.drawDebugInfo(this.physicsEngine, this.player);
    }
  }

  private gameLoop(timestamp: number): void {
    if (this.lastTime === 0) {
      this.lastTime = timestamp;
    }
    
    const frameTime = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    
    // Cap frame time to prevent huge jumps
    const cappedFrameTime = Math.min(frameTime, CONFIG.MAX_FRAME_CAP);
    
    // Update accumulator
    this.accumulator += cappedFrameTime;
    
    // Fixed timestep updates
    while (this.accumulator >= CONFIG.FIXED_TIME_STEP) {
      this.deltaTime = CONFIG.FIXED_TIME_STEP;
      
      if (this.gameState === GameState.PLAYING) {
        this.update(this.deltaTime);
      }
      
      this.accumulator -= CONFIG.FIXED_TIME_STEP;
    }
    
    // Render at variable rate
    this.render();
    
    // Request next frame
    requestAnimationFrame((ts) => this.gameLoop(ts));
  }

  public start(): void {
    // Start game loop
    requestAnimationFrame((ts) => this.gameLoop(ts));
    
    // Log initialization
    console.log('Card Drive & Drift initialized successfully');
    console.log('Controls: Arrow keys or WASD to drive');
    console.log('Press P or ESC to pause');
    console.log('Press R to restart after game over');
    console.log('Goal: Reach 5000 distance units to win!');
  }
}

// Initialize game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const game = new CardDriveGame();
    game.start();
  });
} else {
  const game = new CardDriveGame();
  game.start();
}

export { CardDriveGame };