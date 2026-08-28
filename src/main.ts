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
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.start(resolve));
      } else {
        this.start(resolve);
      }
    });
  }

  private start(resolve: () => void): void {
    const width = Math.min(window.innerWidth, window.innerHeight * 1.77);
    const height = Math.min(window.innerHeight, window.innerWidth / 1.77);
    
    this.canvas.width = width;
    this.canvas.height = height;
    
    this.renderer.setResolution(width, height);
    
    this.setupInputHandlers();
    this.createLevel();
    
    this.audio.init();
    
    this.lastTime = performance.now();
    
    resolve();
  }

  private setupInputHandlers(): void {
    this.input.on('keydown', (key: string) => {
      switch (key) {
        case 'ArrowUp':
        case 'KeyW':
          this.vehicle?.applyAcceleration(150);
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.vehicle?.applyBrake(100);
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.vehicle?.turnLeft();
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.vehicle?.turnRight();
          break;
        case 'Space':
          this.vehicle?.jump();
          break;
        case 'KeyR':
          this.restartGame();
          break;
        case 'Escape':
          this.togglePause();
          break;
      }
    });

    this.input.on('keyup', (key: string) => {
      switch (key) {
        case 'ArrowUp':
        case 'KeyW':
          this.vehicle?.releaseAcceleration();
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.vehicle?.releaseBrake();
          break;
        case 'ArrowLeft':
        case 'KeyA':
        case 'ArrowRight':
        case 'KeyD':
          this.vehicle?.stopTurning();
          break;
      }
    });

    // Touch controls for mobile
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    if (x < centerX && y > centerY) {
      this.vehicle?.turnLeft();
    } else if (x > centerX && y > centerY) {
      this.vehicle?.turnRight();
    }
    
    if (y < centerY) {
      this.vehicle?.applyAcceleration(150);
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
  }

  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    this.vehicle?.stopTurning();
    this.vehicle?.releaseAcceleration();
  }

  private createLevel(): void {
    const segments: TrackSegment[] = [];
    let x = 100;
    let y = this.canvas.height - 200;
    
    // Create track segments with varying heights
    for (let i = 0; i < 50; i++) {
      const segmentHeight = 40 + Math.random() * 60;
      const segmentWidth = 200 + Math.random() * 100;
      
      segments.push(new TrackSegment(x, y, segmentWidth, segmentHeight));
      
      x += segmentWidth + 50 + Math.random() * 50;
      y = Math.max(200, Math.min(this.canvas.height - 150, y + (Math.random() - 0.5) * 100));
    }
    
    this.sceneMgr.addTrackSegments(segments);
    
    // Create player vehicle
    this.vehicle = new CardVehicle(this.canvas.width / 2, this.canvas.height - 300);
    this.entityMgr.addEntity(this.vehicle);
    
    // Create particles
    for (let i = 0; i < 20; i++) {
      this.entityMgr.addEntity(new Particle(
        Math.random() * this.canvas.width,
        Math.random() * this.canvas.height,
        10 + Math.random() * 20,
        Math.random() * 2 + 1
      ));
    }
    
    // Create camera
    const camera = new Camera();
    this.entityMgr.addEntity(camera);
  }

  private restartGame(): void {
    this.entityMgr.clearEntities();
    this.sceneMgr.clearTrackSegments();
    this.createLevel();
    this.lastTime = performance.now();
  }

  private togglePause(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    } else {
      this.lastTime = performance.now();
      this.animationId = requestAnimationFrame(this.gameLoop);
    }
  }

  private gameLoop(timestamp: number): void {
    if (this.animationId === null) return;
    
    const deltaTime = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    
    // Cap delta time to prevent physics explosions
    const cappedDelta = Math.min(deltaTime, 0.05);
    
    this.engine.update(cappedDelta);
    this.renderer.render();
    
    this.animationId = requestAnimationFrame(this.gameLoop);
  }

  public getEngine(): Engine {
    return this.engine;
  }

  public getInput(): InputManager {
    return this.input;
  }

  public getAudio(): AudioSystem {
    return this.audio;
  }

  public getRenderer(): RenderSystem {
    return this.renderer;
  }
}

// Start the game
const cardDriveDrift = new CardDriveDrift();
window.__cardDriveDrift = cardDriveDrift;

cardDriveDrift.init().then(() => {
  console.log('Card Drive & Drift initialized');
}).catch((error) => {
  console.error('Failed to initialize:', error);
});