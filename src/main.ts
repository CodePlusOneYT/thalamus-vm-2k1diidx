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
          this.vehicle?.applyAcceleration(-80);
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.vehicle?.steerLeft();
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.vehicle?.steerRight();
          break;
        case 'Space':
          this.vehicle?.brake();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.vehicle?.boost();
          break;
        case 'KeyR':
          this.restartLevel();
          break;
      }
    });

    this.input.on('keyup', (key: string) => {
      switch (key) {
        case 'ArrowUp':
        case 'KeyW':
        case 'ArrowDown':
        case 'KeyS':
          this.vehicle?.releaseThrottle();
          break;
        case 'ArrowLeft':
        case 'KeyA':
        case 'ArrowRight':
        case 'KeyD':
          this.vehicle?.centerSteering();
          break;
        case 'Space':
          this.vehicle?.releaseBrake();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.vehicle?.releaseBoost();
          break;
      }
    });

    this.input.on('mousedown', () => {
      this.vehicle?.brake();
    });

    this.input.on('mouseup', () => {
      this.vehicle?.releaseBrake();
    });

    this.input.on('touchstart', () => {
      this.vehicle?.brake();
    });

    this.input.on('touchend', () => {
      this.vehicle?.releaseBrake();
    });

    window.addEventListener('resize', () => {
      const width = Math.min(window.innerWidth, window.innerHeight * 1.77);
      const height = Math.min(window.innerHeight, window.innerWidth / 1.77);
      
      this.canvas.width = width;
      this.canvas.height = height;
      this.renderer.setResolution(width, height);
    });
  }

  private createLevel(): void {
    this.vehicle = new CardVehicle(100, 300, this.physics);
    this.entityMgr.addEntity(this.vehicle);

    const startX = 100;
    const startY = 350;
    const segmentWidth = 400;
    const segmentHeight = 60;
    
    let y = startY;
    for (let i = 0; i < 50; i++) {
      const track = new TrackSegment(startX + (i * segmentWidth), y, segmentWidth, segmentHeight);
      this.entityMgr.addEntity(track);
      
      const noise = Math.sin(i * 0.5) * 30 + Math.cos(i * 0.3) * 20;
      y += noise;
      
      if (i % 8 === 0 && i > 0) {
        const gapY = y - 150 - Math.abs(noise);
        const gapTrack = new TrackSegment(startX + (i * segmentWidth), gapY, segmentWidth, segmentHeight);
        this.entityMgr.addEntity(gapTrack);
        
        const coinY = gapY - 50;
        const coin = new Particle(startX + (i * segmentWidth) + segmentWidth / 2, coinY, 'coin');
        this.entityMgr.addEntity(coin);
      }
      
      if (i % 15 === 0 && i > 0) {
        const obstacleY = y - 100;
        const obstacle = new Particle(startX + (i * segmentWidth) + segmentWidth / 2, obstacleY, 'obstacle');
        this.entityMgr.addEntity(obstacle);
      }
    }
    
    const finishLine = new TrackSegment(startX + (50 * segmentWidth), y, segmentWidth, segmentHeight, true);
    this.entityMgr.addEntity(finishLine);
    
    const camera = new Camera(this.canvas.width, this.canvas.height);
    this.entityMgr.addEntity(camera);
    
    this.sceneMgr.setCurrentScene('race');
  }

  private restartLevel(): void {
    this.entityMgr.clear();
    this.createLevel();
  }

  private gameLoop(currentTime: number): void {
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;
    
    this.update(deltaTime);
    this.render();
    
    this.animationId = requestAnimationFrame(this.gameLoop);
  }

  private update(deltaTime: number): void {
    this.input.update(deltaTime);
    this.physics.update(deltaTime);
    this.engine.update(deltaTime);
    
    const entities = this.entityMgr.getEntities();
    entities.forEach(entity => {
      entity.update(deltaTime);
    });
    
    if (this.vehicle && this.physics) {
      this.physics.applyToEntity(this.vehicle);
    }
    
    const camera = this.entityMgr.getEntityByType<Camera>('Camera');
    if (camera && this.vehicle) {
      camera.updateTarget(this.vehicle);
    }
    
    if (this.vehicle?.isFinished()) {
      this.audio.playSound('win');
      setTimeout(() => {
        alert('Level Complete! Press R to restart.');
        this.restartLevel();
      }, 1000);
    }
  }

  private render(): void {
    this.renderer.clear();
    
    const entities = this.entityMgr.getEntities();
    const sortedEntities = [...entities].sort((a, b) => a.zIndex - b.zIndex);
    
    sortedEntities.forEach(entity => {
      entity.render(this.renderer.context);
    });
    
    this.renderer.renderUI();
  }

  startGame(): void {
    this.animationId = requestAnimationFrame(this.gameLoop);
  }

  stopGame(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  getAudio(): AudioSystem {
    return this.audio;
  }
}

const app = new CardDriveDrift();
window.__cardDriveDrift = app;

app.init().then(() => {
  app.startGame();
});