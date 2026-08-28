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
  private driftController: DriftController;
  private collisionSystem: CollisionSystem;
  private camera: Camera;
  private player: CardVehicle | null = null;
  private track: TrackSegment[] = [];
  private particles: Particle[] = [];
  private score: number = 0;
  private speed: number = 0;
  private maxSpeed: number = 15;
  private time: number = 0;
  private gameState: 'menu' | 'playing' | 'gameover' = 'menu';
  private lastTime: number = 0;

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
    this.physics = new PhysicsEngine();
    this.driftController = new DriftController();
    this.collisionSystem = new CollisionSystem();
    this.camera = new Camera();

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
    const resumeAudio = () => {
      this.audio.resume();
      document.removeEventListener('click', resumeAudio);
      document.removeEventListener('keydown', resumeAudio);
    };
    document.addEventListener('click', resumeAudio);
    document.addEventListener('keydown', resumeAudio);

    // Setup initial track
    this.setupTrack();
    
    // Create player vehicle
    this.player = new CardVehicle(100, 300);
    this.player.setVelocity(0, 0);
    this.player.setMaxSpeed(this.maxSpeed);
    
    this.entityMgr.addEntity(this.player);
    
    // Start engine loop
    this.engine.start();
    this.lastTime = performance.now();
    
    console.log('[CardDriveDrift] Ready!');
  }

  private setupTrack(): void {
    // Generate track segments
    const segmentWidth = 200;
    const segmentCount = 50;
    let currentY = 0;
    
    for (let i = 0; i < segmentCount; i++) {
      const heightVariation = Math.sin(i * 0.3) * 50;
      const widthVariation = Math.cos(i * 0.2) * 80;
      
      const segment = new TrackSegment(
        currentY - widthVariation / 2,
        currentY + heightVariation,
        segmentWidth,
        100 + i * 2,
        i % 5 === 0 ? 'straight' : 'curve'
      );
      
      this.track.push(segment);
      this.entityMgr.addEntity(segment);
      
      currentY += 150;
    }
  }

  private update(deltaTime: number): void {
    this.time += deltaTime;
    
    if (this.gameState !== 'playing') return;
    
    // Update player
    if (this.player) {
      const physicsResult = this.physics.update(this.player, deltaTime, this.track);
      
      if (physicsResult.onGround) {
        this.speed = Math.min(this.speed + physicsResult.acceleration * deltaTime, this.maxSpeed);
        this.player.setVelocity(this.speed * deltaTime, physicsResult.velocity.y);
        
        // Apply drift
        this.driftController.update(this.player, deltaTime);
        
        // Spawn dust particles when moving fast
        if (this.speed > 5 && Math.random() < 0.3) {
          this.spawnParticle(this.player.x - 20, this.player.y + 20, 'dust');
        }
      } else {
        this.speed *= 0.98; // Air resistance
      }
      
      // Check collisions
      const collision = this.collisionSystem.check(this.player, this.track);
      if (collision) {
        this.score += 10;
        this.audio.playPickup();
        this.spawnParticle(collision.x, collision.y, 'spark');
        this.camera.shake(2);
      }
    }
    
    // Update camera
    if (this.player) {
      this.camera.update(this.player.x, this.player.y, this.renderer.getCanvas().width, this.renderer.getCanvas().height);
    }
    
    // Update particles
    this.particles = this.particles.filter(p => p.life > 0);
    for (const particle of this.particles) {
      particle.update(deltaTime);
    }
    
    // Update game state
    if (this.speed <= 0) {
      this.gameState = 'gameover';
      this.audio.playGameOver();
    }
  }

  private render(): void {
    const ctx = this.renderer.getContext();
    const canvas = this.renderer.getCanvas();
    
    // Clear screen
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw background parallax
    this.drawBackground(ctx);
    
    // Draw track
    for (const segment of this.track) {
      const worldPos = this.camera.toWorld(segment.x, segment.y);
      this.drawTrackSegment(ctx, segment, worldPos);
    }
    
    // Draw particles
    for (const particle of this.particles) {
      const worldPos = this.camera.toWorld(particle.x, particle.y);
      this.drawParticle(ctx, particle, worldPos);
    }
    
    // Draw player
    if (this.player) {
      const worldPos = this.camera.toWorld(this.player.x, this.player.y);
      this.drawPlayer(ctx, this.player, worldPos);
    }
    
    // Draw UI
    this.drawUI(ctx, canvas.width, canvas.height);
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    // Simple gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, this.renderer.getCanvas().height);
    gradient.addColorStop(0, '#0f0c29');
    gradient.addColorStop(0.5, '#302b63');
    gradient.addColorStop(1, '#24243e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.renderer.getCanvas().width, this.renderer.getCanvas().height);
  }

  private drawTrackSegment(ctx: CanvasRenderingContext2D, segment: TrackSegment, worldPos: {x: number, y: number}): void {
    ctx.save();
    
    // Track color based on type
    if (segment.type === 'curve') {
      ctx.fillStyle = '#ff6b6b';
    } else {
      ctx.fillStyle = '#4ecdc4';
    }
    
    // Draw track rectangle
    ctx.fillRect(worldPos.x, worldPos.y, segment.width, segment.height);
    
    // Add track markings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(worldPos.x + segment.width / 2, worldPos.y);
    ctx.lineTo(worldPos.x + segment.width / 2, worldPos.y + segment.height);
    ctx.stroke();
    
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, vehicle: CardVehicle, worldPos: {x: number, y: number}): void {
    ctx.save();
    ctx.translate(worldPos.x, worldPos.y);
    
    // Player body (card shape)
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.roundRect(-20, -30, 40, 60, 5);
    ctx.fill();
    
    // Card details
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('A', 0, 5);
    
    // Wheels
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(-15, 25, 8, 0, Math.PI * 2);
    ctx.arc(15, 25, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Speed lines when going fast
    if (this.speed > 10) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const offset = (i * 10) - 20;
        ctx.beginPath();
        ctx.moveTo(offset, 30);
        ctx.lineTo(offset - 30, 30);
        ctx.stroke();
      }
    }
    
    ctx.restore();
  }

  private drawParticle(ctx: CanvasRenderingContext2D, particle: Particle, worldPos: {x: number, y: number}): void {
    ctx.save();
    ctx.globalAlpha = particle.life / particle.maxLife;
    
    switch (particle.type) {
      case 'dust':
        ctx.fillStyle = '#8b7355';
        ctx.beginPath();
        ctx.arc(worldPos.x, worldPos.y, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'spark':
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(worldPos.x, worldPos.y, 2, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    
    ctx.restore();
  }

  private drawUI(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    
    // Score
    ctx.fillText(`Score: ${this.score}`, 20, 40);
    
    // Speed
    ctx.fillText(`Speed: ${Math.floor(this.speed)} km/h`, 20, 70);
    
    // Game state messages
    switch (this.gameState) {
      case 'menu':
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('CARD DRIVE & DRIFT', width / 2, height / 2 - 50);
        ctx.font = '24px Arial';
        ctx.fillText('Press SPACE to start', width / 2, height / 2 + 20);
        ctx.fillText('Arrow keys/WASD to drive', width / 2, height / 2 + 50);
        break;
      case 'gameover':
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', width / 2, height / 2 - 50);
        ctx.font = '24px Arial';
        ctx.fillText(`Final Score: ${this.score}`, width / 2, height / 2);
        ctx.fillText('Press R to restart', width / 2, height / 2 + 40);
        break;
    }
    
    ctx.restore();
  }

  private handleInput(): void {
    if (this.gameState === 'menu') {
      if (this.input.isKeyDown('Space')) {
        this.gameState = 'playing';
        this.score = 0;
        this.speed = 0;
        this.time = 0;
        this.audio.playStart();
      }
      return;
    }
    
    if (this.gameState === 'gameover') {
      if (this.input.isKeyDown('r') || this.input.isKeyDown('R')) {
        this.restartGame();
      }
      return;
    }
    
    if (this.player) {
      // Accelerate
      if (this.input.isKeyDown('ArrowUp') || this.input.isKeyDown('w') || this.input.isKeyDown('W')) {
        this.driftController.accelerate();
      }
      
      // Brake
      if (this.input.isKeyDown('ArrowDown') || this.input.isKeyDown('s') || this.input.isKeyDown('S')) {
        this.driftController.brake();
      }
      
      // Steer left
      if (this.input.isKeyDown('ArrowLeft') || this.input.isKeyDown('a') || this.input.isKeyDown('A')) {
        this.driftController.steerLeft();
      }
      
      // Steer right
      if (this.input.isKeyDown('ArrowRight') || this.input.isKeyDown('d') || this.input.isKeyDown('D')) {
        this.driftController.steerRight();
      }
    }
  }

  private spawnParticle(x: number, y: number, type: 'dust' | 'spark'): void {
    this.particles.push(new Particle(x, y, type));
  }

  private restartGame(): void {
    this.gameState = 'playing';
    this.score = 0;
    this.speed = 0;
    this.time = 0;
    if (this.player) {
      this.player.setVelocity(0, 0);
      this.player.x = 100;
      this.player.y = 300;
    }
    this.audio.playStart();
  }

  private onResize(): void {
    const canvas = this.renderer.getCanvas();
    const container = document.getElementById('gameContainer');
    
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }
    
    this.engine.resize(canvas.width, canvas.height);
  }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    const game = new CardDriveDrift();
    window.__cardDriveDrift = game;
    console.log('[CardDriveDrift] Game initialized successfully');
  } catch (error) {
    console.error('[CardDriveDrift] Initialization failed:', error);
  }
});