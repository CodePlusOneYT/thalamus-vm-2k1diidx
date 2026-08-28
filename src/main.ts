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
  }

  async init(): Promise<void> {
    return new Promise((resolve) => {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.startGame(), { once: true });
      } else {
        this.startGame();
      }
      
      // Resize handler
      window.addEventListener('resize', () => this.handleResize());
      
      // Pause/resume on visibility change
      document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
      
      resolve();
    });
  }

  startGame(): void {
    // Initialize game state
    this.setupLevel();
    this.setupInputHandlers();
    
    // Start game loop
    this.lastTime = performance.now();
    this.animationId = requestAnimationFrame(this.gameLoop);
    
    // Resume audio context on first interaction
    this.audio.resume();
    
    console.log('[Card Drive & Drift] Game initialized successfully');
  }

  setupLevel(): void {
    // Create track segments
    const trackLength = 5000;
    const segmentWidth = 300;
    const segmentCount = Math.ceil(trackLength / segmentWidth);
    
    for (let i = 0; i < segmentCount; i++) {
      const x = i * segmentWidth;
      const y = 400 + Math.sin(i * 0.5) * 100;
      
      // Randomly add obstacles every 5-10 segments
      const hasObstacle = i > 5 && i % 7 === 0;
      const hasCoin = i > 3 && i % 4 === 0;
      
      const segment = new TrackSegment(x, y, segmentWidth, 60, hasObstacle, hasCoin);
      this.entityMgr.addEntity(segment);
    }
    
    // Create player vehicle
    this.vehicle = new CardVehicle(100, 350);
    this.entityMgr.addEntity(this.vehicle);
    
    // Set up camera
    const camera = new Camera();
    this.entityMgr.addEntity(camera);
    
    // Add initial particles
    for (let i = 0; i < 10; i++) {
      const particle = new Particle(
        Math.random() * 800,
        Math.random() * 600,
        Math.random() * 2 + 1,
        '#ffffff'
      );
      this.entityMgr.addEntity(particle);
    }
    
    // Update physics system with collision handler
    this.physics.setCollisionHandler((entity: Entity, other: Entity) => {
      if (entity instanceof CardVehicle && other instanceof TrackSegment) {
        this.audio.playSound('collision');
        
        // Apply drift effect
        if (this.vehicle) {
          this.vehicle.applyDriftEffect(0.1);
        }
      }
    });
  }

  setupInputHandlers(): void {
    this.input.onKeyDown('KeyW', () => {
      if (this.vehicle) {
        this.vehicle.accelerate(0.5);
      }
    });
    
    this.input.onKeyUp('KeyW', () => {
      if (this.vehicle) {
        this.vehicle.decelerate(0.3);
      }
    });
    
    this.input.onKeyDown('KeyS', () => {
      if (this.vehicle) {
        this.vehicle.brake(-0.3);
      }
    });
    
    this.input.onKeyUp('KeyS', () => {
      if (this.vehicle) {
        this.vehicle.releaseBrake();
      }
    });
    
    this.input.onKeyDown('KeyA', () => {
      if (this.vehicle) {
        this.vehicle.turnLeft(0.03);
      }
    });
    
    this.input.onKeyUp('KeyA', () => {
      if (this.vehicle) {
        this.vehicle.releaseTurnLeft();
      }
    });
    
    this.input.onKeyDown('KeyD', () => {
      if (this.vehicle) {
        this.vehicle.turnRight(0.03);
      }
    });
    
    this.input.onKeyUp('KeyD', () => {
      if (this.vehicle) {
        this.vehicle.releaseTurnRight();
      }
    });
    
    // Space bar for boost
    this.input.onKeyDown('Space', () => {
      if (this.vehicle && !this.vehicle.isBoosting) {
        this.vehicle.activateBoost();
        this.audio.playSound('boost');
      }
    });
    
    this.input.onKeyUp('Space', () => {
      if (this.vehicle) {
        this.vehicle.deactivateBoost();
      }
    });
    
    // Touch controls for mobile
    this.setupTouchControls();
  }

  setupTouchControls(): void {
    const canvas = this.canvas;
    let touchStartX = 0;
    let touchStartY = 0;
    
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      
      // Tap on left side = turn left
      if (touch.clientX < canvas.width / 3) {
        this.input.simulateKeyDown('KeyA');
      }
      // Tap on right side = turn right
      else if (touch.clientX > canvas.width * 2 / 3) {
        this.input.simulateKeyDown('KeyD');
      }
      // Tap in middle = accelerate
      else {
        this.input.simulateKeyDown('KeyW');
      }
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.input.simulateKeyUp('KeyA');
      this.input.simulateKeyUp('KeyD');
      this.input.simulateKeyUp('KeyW');
    }, { passive: false });
    
    // Swipe detection for continuous movement
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      
      if (Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          this.input.simulateKeyDown('KeyD');
        } else {
          this.input.simulateKeyDown('KeyA');
        }
      }
      
      if (Math.abs(deltaY) > 50) {
        if (deltaY > 0) {
          this.input.simulateKeyUp('KeyA');
          this.input.simulateKeyUp('KeyD');
        } else {
          this.input.simulateKeyUp('KeyW');
        }
      }
    }, { passive: false });
  }

  handleResize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.renderer.setDimensions(window.innerWidth, window.innerHeight);
  }

  handleVisibilityChange(): void {
    if (document.hidden) {
      if (this.animationId !== null) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    } else {
      this.lastTime = performance.now();
      this.animationId = requestAnimationFrame(this.gameLoop);
    }
  }

  gameLoop(currentTime: number): void {
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;
    
    // Update physics
    this.physics.update(deltaTime);
    
    // Update entities
    this.entityMgr.update(deltaTime);
    
    // Update camera
    if (this.vehicle) {
      const camera = this.entityMgr.getEntityByType(Camera)[0] as Camera | undefined;
      if (camera) {
        camera.follow(this.vehicle);
      }
    }
    
    // Update scene
    this.sceneMgr.update(deltaTime);
    
    // Render everything
    this.render();
    
    // Continue loop
    this.animationId = requestAnimationFrame(this.gameLoop);
  }

  render(): void {
    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw background gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f3460');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw all entities
    this.entityMgr.draw(this.ctx);
    
    // Draw UI overlay
    this.drawUI();
  }

  drawUI(): void {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 16px Arial';
    
    // Speed display
    if (this.vehicle) {
      const speed = Math.round(this.vehicle.velocity.mag() * 10);
      this.ctx.fillText(`Speed: ${speed} km/h`, 20, 30);
      
      // Drift score
      const driftScore = this.vehicle.driftScore;
      if (driftScore > 0) {
        this.ctx.fillStyle = '#ffdd00';
        this.ctx.fillText(`Drift Score: ${driftScore}`, 20, 50);
      }
      
      // Boost meter
      this.drawBoostMeter();
    }
    
    // Instructions
    this.ctx.fillStyle = '#cccccc';
    this.ctx.font = '14px Arial';
    this.ctx.fillText('WASD/Arrows: Drive | Space: Boost', 20, this.canvas.height - 30);
  }

  drawBoostMeter(): void {
    if (!this.vehicle) return;
    
    const meterWidth = 150;
    const meterHeight = 15;
    const meterX = this.canvas.width - meterWidth - 20;
    const meterY = 20;
    
    // Background
    this.ctx.fillStyle = '#333333';
    this.ctx.fillRect(meterX, meterY, meterWidth, meterHeight);
    
    // Fill
    const fillPercent = this.vehicle.boostCharge / this.vehicle.maxBoost;
    const fillColor = fillPercent > 0.7 ? '#00ff00' : fillPercent > 0.3 ? '#ffff00' : '#ff0000';
    this.ctx.fillStyle = fillColor;
    this.ctx.fillRect(meterX, meterY, meterWidth * fillPercent, meterHeight);
    
    // Border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(meterX, meterY, meterWidth, meterHeight);
    
    // Text
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '12px Arial';
    this.ctx.fillText('BOOST', meterX + 10, meterY + 12);
  }

  shutdown(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    this.input.cleanup();
    console.log('[Card Drive & Drift] Game shut down');
  }
}

// Export for testing and global access
declare global {
  interface Window {
    __cardDriveDrift?: CardDriveDrift;
  }
}

// Create and initialize game instance
const game = new CardDriveDrift();
window.__cardDriveDrift = game;

game.init().catch(console.error);

export { CardDriveDrift };