/**
 * Card Drive & Drift - Main Game Entry Point
 * HTML5 Canvas Racing Game with Procedural Art & Advanced Physics
 */

import { Engine } from './engine/Engine';
import { InputManager } from './engine/InputManager';
import { EntityManager } from './engine/EntityManager';
import { SceneManager } from './engine/SceneManager';
import { PhysicsEngine } from './physics/PhysicsEngine';
import { CardVehicle } from './entities/CardVehicle';
import { TrackSegment } from './entities/TrackSegment';
import { Particle } from './entities/Particle';
import { Camera } from './entities/Camera';
import { RenderSystem } from './engine/RenderSystem';
import { AudioController } from './audio/AudioController';
import { MathUtils } from './physics/MathUtils';
import { CollisionSystem } from './physics/CollisionSystem';
import { DriftController } from './physics/DriftController';
import { VehiclePhysics } from './physics/VehiclePhysics';
import { CardDeck } from './systems/CardDeck';

export class MainGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: Engine;
  private inputMgr: InputManager;
  private entityMgr: EntityManager;
  private sceneMgr: SceneManager;
  private physics: PhysicsEngine;
  private collisionSys: CollisionSystem;
  private driftCtrl: DriftController;
  private vehiclePhys: VehiclePhysics;
  private renderSys: RenderSystem;
  private camera: Camera;
  private audio: AudioController;
  private cardDeck: CardDeck;
  
  private vehicle: CardVehicle | null = null;
  private trackSegments: TrackSegment[] = [];
  private particles: Particle[] = [];
  
  private gameStarted: boolean = false;
  private gameOver: boolean = false;
  private animationId: number | null = null;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private step: number = 1 / 60;
  
  // Game state
  private score: number = 0;
  private distance: number = 0;
  private maxSpeed: number = 0;
  private lapTime: number = 0;
  private startTime: number = 0;
  
  // UI elements
  private uiOverlay: HTMLElement | null = null;
  private gameOverScreen: HTMLElement | null = null;
  
  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error('Canvas element not found');
    }
    
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Could not get 2D context');
    }
    
    // Initialize systems
    this.engine = new Engine();
    this.inputMgr = new InputManager(this.canvas);
    this.entityMgr = new EntityManager();
    this.sceneMgr = new SceneManager();
    this.physics = new PhysicsEngine();
    this.collisionSys = new CollisionSystem(this.physics);
    this.driftCtrl = new DriftController();
    this.vehiclePhys = new VehiclePhysics(this.physics, this.collisionSys);
    this.renderSys = new RenderSystem(this.ctx);
    this.camera = new Camera();
    this.audio = new AudioController();
    this.cardDeck = new CardDeck();
    
    // Setup canvas size
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    // Load UI elements
    this.loadUI();
    
    // Initialize game
    this.init();
    
    // Start game loop
    this.lastTime = performance.now();
    this.gameLoop();
  }
  
  private resizeCanvas(): void {
    const container = this.canvas.parentElement;
    if (container) {
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
      this.camera.resize(this.canvas.width, this.canvas.height);
    }
  }
  
  private loadUI(): void {
    this.uiOverlay = document.getElementById('ui-overlay');
    this.gameOverScreen = document.getElementById('game-over-screen');
  }
  
  private init(): void {
    // Create initial track segments
    for (let i = 0; i < 50; i++) {
      this.addTrackSegment(i * 200, 0);
    }
    
    // Create player vehicle
    this.createPlayerVehicle();
    
    // Reset game state
    this.resetGameState();
  }
  
  private resetGameState(): void {
    this.score = 0;
    this.distance = 0;
    this.maxSpeed = 0;
    this.lapTime = 0;
    this.startTime = 0;
    this.gameStarted = false;
    this.gameOver = false;
    
    // Clear particles
    this.particles.forEach(p => p.active = false);
    this.particles.length = 0;
    
    // Update UI
    this.updateUI();
    
    // Hide screens
    if (this.gameOverScreen) {
      this.gameOverScreen.classList.add('hidden');
    }
  }
  
  private createPlayerVehicle(): void {
    this.vehicle = new CardVehicle(
      100,
      this.trackSegments[0]?.y || 400,
      this.inputMgr,
      this.physics,
      this.collisionSys,
      this.driftCtrl,
      this.vehiclePhys
    );
    
    this.entityMgr.addEntity(this.vehicle);
  }
  
  private addTrackSegment(x: number, y: number): void {
    const segment = new TrackSegment(x, y, 200, 50);
    this.trackSegments.push(segment);
    this.entityMgr.addEntity(segment);
  }
  
  private startGame(): void {
    if (this.gameStarted || this.gameOver) return;
    
    this.gameStarted = true;
    this.gameOver = false;
    this.startTime = performance.now();
    
    // Resume audio context if needed
    this.audio.resume();
    
    // Show HUD
    if (this.uiOverlay) {
      this.uiOverlay.classList.remove('hidden');
    }
    
    // Play start sound
    this.audio.playSound('start');
  }
  
  private update(deltaTime: number): void {
    if (!this.gameStarted || this.gameOver) return;
    
    // Update input
    this.inputMgr.update();
    
    // Update camera
    this.camera.update(this.vehicle?.position.x || 0, this.canvas.width);
    
    // Update vehicle
    if (this.vehicle) {
      this.vehicle.update(deltaTime);
      
      // Track maximum speed
      if (this.vehicle.velocity.mag() > this.maxSpeed) {
        this.maxSpeed = this.vehicle.velocity.mag();
      }
      
      // Track distance
      this.distance += this.vehicle.velocity.x * deltaTime * 0.1;
    }
    
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.update(deltaTime);
      if (!particle.active) {
        this.particles.splice(i, 1);
      }
    }
    
    // Update lap time
    this.lapTime = (performance.now() - this.startTime) / 1000;
    
    // Update UI
    this.updateUI();
  }
  
  private updateUI(): void {
    if (!this.uiOverlay) return;
    
    const scoreEl = this.uiOverlay.querySelector('#score');
    const distanceEl = this.uiOverlay.querySelector('#distance');
    const speedEl = this.uiOverlay.querySelector('#speed');
    const timeEl = this.uiOverlay.querySelector('#time');
    
    if (scoreEl) scoreEl.textContent = Math.floor(this.score).toString();
    if (distanceEl) distanceEl.textContent = Math.floor(this.distance).toString();
    if (speedEl && this.vehicle) speedEl.textContent = Math.floor(this.vehicle.velocity.mag()).toString();
    if (timeEl) timeEl.textContent = this.lapTime.toFixed(2);
  }
  
  private draw(): void {
    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Apply camera transform
    this.ctx.save();
    this.ctx.translate(-this.camera.x, 0);
    
    // Draw background
    this.drawBackground();
    
    // Draw track segments
    for (const segment of this.trackSegments) {
      this.renderSys.drawTrackSegment(segment);
    }
    
    // Draw particles
    for (const entity of this.entityMgr.getAll()) {
      if (entity instanceof Particle && entity.active) {
        this.renderSys.drawParticle(entity);
      }
    }
    
    // Draw vehicle
    if (this.vehicle) {
      this.renderSys.drawCardVehicle(this.vehicle);
    }
    
    // Restore context
    this.ctx.restore();
    
    // Draw VFX (screen shake, etc.)
    this.drawVFX();
    
    // Check game over conditions
    this.checkGameOver();
  }
  
  private drawBackground(): void {
    // Simple parallax stars
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 50; i++) {
      const x = ((i * 137) % this.canvas.width + this.camera.x) % this.canvas.width;
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
        this.renderSys.drawParticle(entity);
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
      
      const finalScore = this.gameOverScreen.querySelector('#final-score');
      const finalDistance = this.gameOverScreen.querySelector('#final-distance');
      const maxSpeed = this.gameOverScreen.querySelector('#max-speed');
      
      if (finalScore) finalScore.textContent = Math.floor(this.score).toString();
      if (finalDistance) finalDistance.textContent = Math.floor(this.distance).toString();
      if (maxSpeed) maxSpeed.textContent = Math.floor(this.maxSpeed).toString();
    }
    
    // Play game over sound
    this.audio.playSound('gameover');
  }
  
  private gameLoop(currentTime: number = 0): void {
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    
    this.accumulator += deltaTime;
    
    while (this.accumulator >= this.step) {
      this.update(this.step);
      this.accumulator -= this.step;
    }
    
    this.draw();
    
    if (!this.gameOver) {
      this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
    }
  }
  
  public destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.audio.destroy();
  }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    const game = new MainGame();
    console.log('Card Drive & Drift initialized successfully');
  } catch (error) {
    console.error('Failed to initialize game:', error);
  }
});