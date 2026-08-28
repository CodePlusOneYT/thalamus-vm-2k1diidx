/**
 * Card Drive & Drift - Main Game Entry Point
 * HTML5 Canvas Racing Game with Advanced Physics
 */

import { Engine } from './engine/Engine.js';
import { InputManager } from './engine/InputManager.js';
import { EntityManager } from './engine/EntityManager.js';
import { SceneManager } from './engine/SceneManager.js';
import { PhysicsEngine } from './physics/PhysicsEngine.js';
import { VehiclePhysics } from './physics/VehiclePhysics.js';
import { CollisionSystem } from './physics/CollisionSystem.js';
import { DriftController } from './physics/DriftController.js';
import { CardVehicle } from './entities/CardVehicle.js';
import { TrackSegment } from './entities/TrackSegment.js';
import { Particle } from './entities/Particle.js';
import { Camera } from './entities/Camera.js';
import { AudioSystem } from './audio/AudioSystem.js';
import { RenderSystem } from './engine/RenderSystem.js';
import { AudioController } from './audio/AudioController.js';
import { CardDeck } from './systems/CardDeck.js';

interface GameState {
  score: number;
  distance: number;
  maxSpeed: number;
  level: number;
  lives: number;
  gameOver: boolean;
  gameStarted: boolean;
}

export class CardDriveDrift {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  // Core Systems
  private engine: Engine;
  private inputMgr: InputManager;
  private entityMgr: EntityManager;
  private sceneMgr: SceneManager;
  private physics: PhysicsEngine;
  private vehiclePhysics: VehiclePhysics;
  private collision: CollisionSystem;
  private driftCtrl: DriftController;
  
  // Rendering
  private renderer: RenderSystem;
  private audioSys: AudioSystem;
  private audioCtrl: AudioController;
  
  // Entities
  private vehicle?: CardVehicle;
  private camera?: Camera;
  private particles: Particle[] = [];
  private trackSegments: TrackSegment[] = [];
  
  // Game State
  private gameState: GameState = {
    score: 0,
    distance: 0,
    maxSpeed: 0,
    level: 1,
    lives: 3,
    gameOver: false,
    gameStarted: false
  };
  
  // Timing
  private lastTime: number = 0;
  private animationId?: number;
  private timeScale: number = 1;
  
  // UI Elements
  private uiOverlay?: HTMLElement;
  private gameOverScreen?: HTMLElement;
  
  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvas) throw new Error('Canvas not found');
    
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
    
    // Initialize systems
    this.inputMgr = new InputManager();
    this.entityMgr = new EntityManager();
    this.sceneMgr = new SceneManager();
    this.renderer = new RenderSystem(this.ctx, this.canvas);
    this.audioSys = new AudioSystem();
    this.audioCtrl = new AudioController(this.audioSys);
    
    this.physics = new PhysicsEngine(9.8, 0.01);
    this.vehiclePhysics = new VehiclePhysics();
    this.collision = new CollisionSystem();
    this.driftCtrl = new DriftController();
    
    this.engine = new Engine(this);
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initialize game world
    this.initWorld();
    
    // Start the game
    this.startGame();
  }
  
  private setupEventListeners(): void {
    window.addEventListener('resize', () => this.handleResize());
    document.addEventListener('keydown', (e: KeyboardEvent) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e: KeyboardEvent) => this.handleKeyUp(e));
    
    // Touch support for mobile
    this.canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      this.inputMgr.touchActive = true;
    }, { passive: false });
    
    this.canvas.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
    }, { passive: false });
    
    this.canvas.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault();
      this.inputMgr.touchActive = false;
    });
  }
  
  private handleResize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderer.resize(rect.width, rect.height);
  }
  
  private handleKeyDown(e: KeyboardEvent): void {
    if (this.gameState.gameOver && e.key === 'Enter') {
      this.restartGame();
      return;
    }
    
    if (!this.gameState.gameStarted) {
      this.startGame();
      return;
    }
    
    switch (e.code) {
      case 'Space':
      case 'ArrowUp':
        this.inputMgr.jump();
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.inputMgr.left();
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.inputMgr.right();
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.inputMgr.brake();
        break;
      case 'KeyW':
        this.inputMgr.throttle();
        break;
    }
  }
  
  private handleKeyUp(e: KeyboardEvent): void {
    switch (e.code) {
      case 'Space':
      case 'ArrowUp':
        this.inputMgr.releaseJump();
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.inputMgr.releaseLeft();
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.inputMgr.releaseRight();
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.inputMgr.releaseBrake();
        break;
      case 'KeyW':
        this.inputMgr.releaseThrottle();
        break;
    }
  }
  
  private initWorld(): void {
    // Create initial track
    let x = 0;
    for (let i = 0; i < 100; i++) {
      const segment = new TrackSegment(x, 400, 200);
      this.trackSegments.push(segment);
      this.entityMgr.add(segment);
      x += 200 + Math.random() * 100;
    }
    
    // Create player vehicle
    this.vehicle = new CardVehicle(100, 350);
    this.entityMgr.add(this.vehicle);
    
    // Create camera
    this.camera = new Camera(this.canvas.width / (window.devicePixelRatio || 1), 
                              this.canvas.height / (window.devicePixelRatio || 1));
    this.entityMgr.add(this.camera);
    
    // Initialize card deck
    const deck = new CardDeck();
    
    // Setup UI overlay
    this.uiOverlay = document.createElement('div');
    this.uiOverlay.id = 'ui-overlay';
    this.uiOverlay.innerHTML = `
      <div id="score-display">Score: 0</div>
      <div id="distance-display">Distance: 0m</div>
      <div id="speed-display">Speed: 0 km/h</div>
      <div id="lives-display">Lives: 3</div>
    `;
    document.body.appendChild(this.uiOverlay);
    
    // Setup game over screen
    this.gameOverScreen = document.createElement('div');
    this.gameOverScreen.id = 'game-over-screen';
    this.gameOverScreen.classList.add('hidden');
    this.gameOverScreen.innerHTML = `
      <h2>GAME OVER</h2>
      <p id="final-score">Score: 0</p>
      <p id="final-distance">Distance: 0m</p>
      <p id="max-speed">Max Speed: 0 km/h</p>
      <button id="restart-btn">Play Again</button>
    `;
    document.body.appendChild(this.gameOverScreen);
    
    const restartBtn = this.gameOverScreen.querySelector('#restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.restartGame());
    }
  }
  
  private startGame(): void {
    this.gameState.gameStarted = true;
    this.gameState.gameOver = false;
    this.lastTime = performance.now();
    
    if (this.gameOverScreen) {
      this.gameOverScreen.classList.add('hidden');
    }
    
    if (this.uiOverlay) {
      this.uiOverlay.classList.remove('hidden');
    }
    
    // Resume audio context on first user interaction
    if (this.audioSys.context?.state === 'suspended') {
      this.audioSys.context.resume();
    }
    
    this.audioCtrl.playMusic();
    this.loop(performance.now());
  }
  
  private loop(currentTime: number): void {
    if (this.gameState.gameOver) return;
    
    const deltaTime = (currentTime - this.lastTime) / 1000 * this.timeScale;
    this.lastTime = currentTime;
    
    // Update systems
    this.inputMgr.update();
    this.physics.update(deltaTime);
    this.driftCtrl.update(deltaTime);
    this.collision.checkCollisions(this.entityMgr.getAll(), this.physics);
    
    // Update entities
    for (const entity of this.entityMgr.getAll()) {
      entity.update(deltaTime, this.physics, this.driftCtrl);
    }
    
    // Update camera
    if (this.camera && this.vehicle) {
      this.camera.follow(this.vehicle, deltaTime);
    }
    
    // Update particles
    for (const particle of this.particles) {
      particle.update(deltaTime);
      if (!particle.active) {
        this.particles = this.particles.filter(p => p !== particle);
      }
    }
    
    // Generate particles from vehicle effects
    if (this.vehicle && this.vehicle.isDrifting && Math.random() > 0.7) {
      this.spawnParticles(this.vehicle.position.x, this.vehicle.position.y + 20, 'drift');
    }
    
    // Update game state
    if (this.vehicle) {
      const speedKmh = Math.abs(this.vehicle.velocity.x) * 3.6;
      this.gameState.distance += this.vehicle.velocity.x * deltaTime * 0.1;
      this.gameState.score += Math.floor(speedKmh * deltaTime);
      this.gameState.maxSpeed = Math.max(this.gameState.maxSpeed, speedKmh);
      
      // Update UI
      this.updateUI();
    }
    
    // Check win condition (reach certain distance)
    if (this.gameState.distance >= 10000) {
      this.victory();
      return;
    }
    
    // Continue loop
    this.animationId = requestAnimationFrame((t) => this.loop(t));
  }
  
  private updateUI(): void {
    if (!this.uiOverlay) return;
    
    const scoreEl = this.uiOverlay.querySelector('#score-display');
    const distEl = this.uiOverlay.querySelector('#distance-display');
    const speedEl = this.uiOverlay.querySelector('#speed-display');
    const livesEl = this.uiOverlay.querySelector('#lives-display');
    
    if (scoreEl) scoreEl.textContent = `Score: ${Math.floor(this.gameState.score)}`;
    if (distEl) distEl.textContent = `Distance: ${Math.floor(this.gameState.distance)}m`;
    if (speedEl && this.vehicle) {
      const speedKmh = Math.round(Math.abs(this.vehicle.velocity.x) * 3.6);
      speedEl.textContent = `Speed: ${speedKmh} km/h`;
    }
    if (livesEl) livesEl.textContent = `Lives: ${this.gameState.lives}`;
  }
  
  private spawnParticles(x: number, y: number, type: 'drift' | 'jump' | 'damage'): void {
    const count = type === 'drift' ? 3 : 5;
    for (let i = 0; i < count; i++) {
      const particle = new Particle(x, y, type);
      this.particles.push(particle);
      this.entityMgr.add(particle);
    }
  }
  
  private drawBackground(): void {
    // Simple parallax stars
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 50; i++) {
      const x = ((i * 137) % this.canvas.width + (this.camera?.x || 0)) % this.canvas.width;
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
    
    // Reset transform after VFX
    this.ctx.resetTransform();
  }
  
  private checkGameOver(): void {
    if (!this.vehicle) return;
    
    // Check if vehicle fell off track
    if (this.vehicle.position.y > 800 || this.vehicle.position.y < -200) {
      this.gameState.lives--;
      this.spawnParticles(this.vehicle.position.x, this.vehicle.position.y, 'damage');
      this.audioCtrl.playDamage();
      
      if (this.gameState.lives <= 0) {
        this.endGame();
      } else {
        // Respawn vehicle
        this.vehicle.position.x = 100;
        this.vehicle.position.y = 350;
        this.vehicle.velocity.x = 0;
        this.vehicle.velocity.y = 0;
      }
      return;
    }
    
    // Check collision damage
    if (this.vehicle.health <= 0) {
      this.gameState.lives--;
      this.spawnParticles(this.vehicle.position.x, this.vehicle.position.y, 'damage');
      this.audioCtrl.playDamage();
      
      if (this.gameState.lives <= 0) {
        this.endGame();
      } else {
        this.vehicle.health = 100;
        this.vehicle.position.x = 100;
        this.vehicle.position.y = 350;
      }
      return;
    }
  }
  
  private endGame(): void {
    this.gameState.gameOver = true;
    this.gameState.gameStarted = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    // Show game over screen
    if (this.gameOverScreen) {
      this.gameOverScreen.classList.remove('hidden');
      
      const finalScore = this.gameOverScreen.querySelector('#final-score');
      const finalDistance = this.gameOverScreen.querySelector('#final-distance');
      const maxSpeed = this.gameOverScreen.querySelector('#max-speed');
      
      if (finalScore) finalScore.textContent = `Score: ${Math.floor(this.gameState.score)}`;
      if (finalDistance) finalDistance.textContent = `Distance: ${Math.floor(this.gameState.distance)}m`;
      if (maxSpeed) maxSpeed.textContent = `Max Speed: ${Math.round(this.gameState.maxSpeed)} km/h`;
    }
    
    // Play game over sound
    this.audioCtrl.playGameOver();
  }
  
  private victory(): void {
    this.gameState.gameOver = true;
    this.gameState.gameStarted = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    // Show victory screen
    if (this.gameOverScreen) {
      this.gameOverScreen.classList.remove('hidden');
      this.gameOverScreen.querySelector('h2')!.textContent = 'VICTORY!';
      
      const finalScore = this.gameOverScreen.querySelector('#final-score');
      const finalDistance = this.gameOverScreen.querySelector('#final-distance');
      const maxSpeed = this.gameOverScreen.querySelector('#max-speed');
      
      if (finalScore) finalScore.textContent = `Final Score: ${Math.floor(this.gameState.score)}`;
      if (finalDistance) finalDistance.textContent = `Total Distance: ${Math.floor(this.gameState.distance)}m`;
      if (maxSpeed) maxSpeed.textContent = `Top Speed: ${Math.round(this.gameState.maxSpeed)} km/h`;
    }
    
    // Play victory sound
    this.audioCtrl.playVictory();
  }
  
  private restartGame(): void {
    // Reset game state
    this.gameState = {
      score: 0,
      distance: 0,
      maxSpeed: 0,
      level: 1,
      lives: 3,
      gameOver: false,
      gameStarted: false
    };
    
    // Clear entities
    this.entityMgr.clear();
    this.particles = [];
    
    // Rebuild world
    this.initWorld();
    
    // Restart game
    this.startGame();
  }
  
  public destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.entityMgr.clear();
    this.inputMgr.destroy();
    this.audioSys.destroy();
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