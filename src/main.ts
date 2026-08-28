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
    this.audio = new AudioController(this.engine);
    this.cardDeck = new CardDeck();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Resize canvas
    this.resizeCanvas();
    
    // Initial game setup
    this.setupLevel();
  }
  
  private setupEventListeners(): void {
    window.addEventListener('resize', () => this.resizeCanvas());
    this.inputMgr.onKeyDown((e) => this.handleKeyDown(e));
    this.inputMgr.onKeyUp((e) => this.handleKeyUp(e));
    
    // Touch support for mobile
    const touchHandler = (e: TouchEvent) => {
      e.preventDefault();
      if (!this.gameStarted && !this.gameOver) {
        this.startGame();
      } else if (this.gameOver) {
        this.resetGame();
      }
    };
    this.canvas.addEventListener('touchstart', touchHandler, { passive: false });
    this.canvas.addEventListener('touchmove', touchHandler, { passive: false });
  }
  
  private resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(dpr, dpr);
    
    this.camera.resize(width, height);
  }
  
  private setupLevel(): void {
    // Generate a procedural track
    const segmentCount = 100;
    const trackWidth = 300;
    const segmentLength = 400;
    
    this.trackSegments = [];
    let currentX = 0;
    let currentY = 0;
    let curveIntensity = 0;
    
    for (let i = 0; i < segmentCount; i++) {
      // Create track curvature
      curveIntensity += (Math.random() - 0.5) * 0.3;
      curveIntensity = Math.max(-0.8, Math.min(0.8, curveIntensity));
      
      currentX += curveIntensity * segmentLength;
      
      // Add elevation changes
      const elevation = Math.sin(i * 0.1) * 100 + Math.cos(i * 0.05) * 50;
      currentY = elevation;
      
      const segment = new TrackSegment(currentX, currentY, trackWidth, segmentLength, i);
      this.trackSegments.push(segment);
    }
    
    // Create starting position
    const startPos = this.trackSegments[0];
    this.vehicle = new CardVehicle(startPos.x, startPos.y, startPos.width);
    this.vehicle.setSpeed(0);
  }
  
  private startGame(): void {
    this.gameStarted = true;
    this.gameOver = false;
    this.score = 0;
    this.distance = 0;
    this.maxSpeed = 0;
    this.lapTime = 0;
    this.startTime = performance.now();
    
    // Resume audio context on user gesture
    this.audio.resume();
    
    // Hide any overlay messages
    this.hideUI();
    
    // Start the game loop
    this.lastTime = performance.now();
    this.animationId = requestAnimationFrame((t) => this.gameLoop(t));
    
    // Play start sound
    this.audio.playStartSound();
  }
  
  private gameLoop(timestamp: number): void {
    if (!this.gameStarted || this.gameOver) return;
    
    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;
    
    this.accumulator += deltaTime;
    
    // Fixed timestep update
    while (this.accumulator >= this.step * 1000) {
      this.update(this.step);
      this.accumulator -= this.step * 1000;
    }
    
    // Render
    this.render(deltaTime);
    
    if (!this.gameOver) {
      this.animationId = requestAnimationFrame((t) => this.gameLoop(t));
    }
  }
  
  private update(dt: number): void {
    if (!this.vehicle) return;
    
    // Update vehicle physics
    this.vehiclePhys.update(this.vehicle, dt, this.trackSegments);
    
    // Update vehicle position relative to camera
    this.camera.update(this.vehicle);
    
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].isDead()) {
        this.particles.splice(i, 1);
      }
    }
    
    // Check for crashes
    if (this.checkCrash()) {
      this.endGame();
      return;
    }
    
    // Update score and distance
    this.distance = Math.floor(this.vehicle.x / 10);
    this.score = Math.floor(this.distance * 10 + this.vehicle.speed * 0.1);
    
    // Update max speed
    this.maxSpeed = Math.max(this.maxSpeed, this.vehicle.speed);
    
    // Update lap time
    this.lapTime = (performance.now() - this.startTime) / 1000;
    
    // Spawn particles based on actions
    this.spawnParticles();
  }
  
  private render(deltaTime: number): void {
    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Apply camera transform
    this.ctx.save();
    this.ctx.translate(this.camera.offsetX, this.camera.offsetY);
    
    // Draw track
    for (const segment of this.trackSegments) {
      this.renderSys.drawTrackSegment(segment, this.camera);
    }
    
    // Draw vehicle
    if (this.vehicle) {
      this.renderSys.drawVehicle(this.vehicle, this.camera);
    }
    
    // Draw particles
    for (const particle of this.particles) {
      this.renderSys.drawParticle(particle, this.camera);
    }
    
    this.ctx.restore();
    
    // Draw UI overlay
    this.renderUI();
  }
  
  private renderUI(): void {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);
    
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, width, height);
    
    this.ctx.font = 'bold 24px Arial';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'left';
    
    // Score display
    this.ctx.fillText(`Score: ${this.score}`, 20, 40);
    
    // Distance display
    this.ctx.fillText(`Distance: ${this.distance}m`, 20, 70);
    
    // Speed display
    this.ctx.fillText(`Speed: ${Math.round(this.vehicle?.speed || 0)} km/h`, 20, 100);
    
    // Lap time
    this.ctx.fillText(`Time: ${this.lapTime.toFixed(2)}s`, 20, 130);
    
    // Max speed
    this.ctx.fillText(`Max: ${Math.round(this.maxSpeed)} km/h`, 20, 160);
    
    // Instructions
    this.ctx.font = '16px Arial';
    this.ctx.fillStyle = '#aaaaaa';
    this.ctx.fillText('Arrow Keys / WASD to drive', 20, height - 60);
    this.ctx.fillText('Space to brake', 20, height - 35);
  }
  
  private spawnParticles(): void {
    if (!this.vehicle) return;
    
    // Tire particles when drifting or turning hard
    if (Math.abs(this.vehicle.driftAngle) > 0.1) {
      const particleCount = Math.floor(Math.abs(this.vehicle.driftAngle) * 5);
      for (let i = 0; i < particleCount; i++) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const x = this.vehicle.x + side * this.vehicle.width / 2;
        const y = this.vehicle.y + this.vehicle.height;
        
        this.particles.push(new Particle(x, y, 'tire'));
      }
    }
    
    // Engine exhaust particles
    if (this.vehicle.throttle > 0) {
      const x = this.vehicle.x - 10;
      const y = this.vehicle.y + this.vehicle.height / 2;
      this.particles.push(new Particle(x, y, 'exhaust'));
    }
  }
  
  private checkCrash(): boolean {
    if (!this.vehicle) return false;
    
    // Check if vehicle went off track
    const closestSegment = this.trackSegments.find(seg => 
      Math.abs(seg.x - this.vehicle.x) < seg.length
    );
    
    if (!closestSegment) return true;
    
    const halfTrackWidth = closestSegment.width / 2;
    const vehicleHalfWidth = this.vehicle.width / 2;
    
    // Simple distance check from track center
    const distFromCenter = Math.abs(this.vehicle.x - closestSegment.x);
    
    if (distFromCenter > halfTrackWidth + vehicleHalfWidth) {
      return true;
    }
    
    // Also check speed threshold for crash detection
    if (this.vehicle.speed > 300 && this.vehicle.health < 50) {
      return true;
    }
    
    return false;
  }
  
  private endGame(): void {
    this.gameOver = true;
    this.gameStarted = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Play crash sound
    this.audio.playCrashSound();
    
    // Show game over screen
    this.showGameOver();
  }
  
  private showGameOver(): void {
    // Remove existing game over screen if any
    if (this.gameOverScreen) {
      this.gameOverScreen.remove();
      this.gameOverScreen = null;
    }
    
    this.gameOverScreen = document.createElement('div');
    this.gameOverScreen.id = 'game-over-screen';
    this.gameOverScreen.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: white;
      font-family: Arial, sans-serif;
      z-index: 1000;
    `;
    
    const title = document.createElement('h1');
    title.textContent = 'CRASHED!';
    title.style.fontSize = '48px';
    title.style.marginBottom = '20px';
    title.style.color = '#ff4444';
    
    const stats = document.createElement('div');
    stats.style.cssText = 'text-align: center; margin-bottom: 30px;';
    
    const scoreEl = document.createElement('p');
    scoreEl.textContent = `Final Score: ${this.score}`;
    scoreEl.style.fontSize = '24px';
    
    const distanceEl = document.createElement('p');
    distanceEl.textContent = `Distance: ${this.distance}m`;
    distanceEl.style.fontSize = '20px';
    
    const maxSpeedEl = document.createElement('p');
    maxSpeedEl.textContent = `Max Speed: ${Math.round(this.maxSpeed)} km/h`;
    maxSpeedEl.style.fontSize = '20px';
    
    const timeEl = document.createElement('p');
    timeEl.textContent = `Time: ${this.lapTime.toFixed(2)}s`;
    timeEl.style.fontSize = '20px';
    
    stats.appendChild(scoreEl);
    stats.appendChild(distanceEl);
    stats.appendChild(maxSpeedEl);
    stats.appendChild(timeEl);
    
    const restartBtn = document.createElement('button');
    restartBtn.textContent = 'Play Again';
    restartBtn.style.cssText = `
      padding: 15px 40px;
      font-size: 20px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      margin-top: 20px;
    `;
    restartBtn.onclick = () => this.resetGame();
    
    this.gameOverScreen.appendChild(title);
    this.gameOverScreen.appendChild(stats);
    this.gameOverScreen.appendChild(restartBtn);
    
    document.body.appendChild(this.gameOverScreen);
  }
  
  private hideUI(): void {
    if (this.uiOverlay) {
      this.uiOverlay.style.display = 'none';
    }
  }
  
  private resetGame(): void {
    // Remove game over screen
    if (this.gameOverScreen) {
      this.gameOverScreen.remove();
      this.gameOverScreen = null;
    }
    
    // Reset game state
    this.gameStarted = false;
    this.gameOver = false;
    this.score = 0;
    this.distance = 0;
    this.maxSpeed = 0;
    this.lapTime = 0;
    this.startTime = 0;
    this.accumulator = 0;
    
    // Regenerate level
    this.setupLevel();
    
    // Show start screen
    this.showStartScreen();
  }
  
  private showStartScreen(): void {
    // Remove existing overlay
    if (this.uiOverlay) {
      this.uiOverlay.remove();
      this.uiOverlay = null;
    }
    
    this.uiOverlay = document.createElement('div');
    this.uiOverlay.id = 'start-screen';
    this.uiOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: white;
      font-family: Arial, sans-serif;
      z-index: 1000;
    `;
    
    const title = document.createElement('h1');
    title.textContent = 'Card Drive & Drift';
    title.style.fontSize = '48px';
    title.style.marginBottom = '20px';
    title.style.background = 'linear-gradient(45deg, #ff6b6b, #feca57)';
    title.style.webkitBackgroundClip = 'text';
    title.style.webkitTextFillColor = 'transparent';
    
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Advanced Physics Racing Game';
    subtitle.style.fontSize = '20px';
    subtitle.style.marginBottom = '30px';
    
    const controls = document.createElement('div');
    controls.style.cssText = 'text-align: center; margin-bottom: 30px;';
    
    const controlLine1 = document.createElement('p');
    controlLine1.textContent = 'Arrow Keys / WASD to drive';
    controlLine1.style.fontSize = '16px';
    controlLine1.style.margin = '5px 0';
    
    const controlLine2 = document.createElement('p');
    controlLine2.textContent = 'Space to brake';
    controlLine2.style.fontSize = '16px';
    controlLine2.style.margin = '5px 0';
    
    const controlLine3 = document.createElement('p');
    controlLine2.textContent = 'Touch anywhere to start';
    controlLine3.style.fontSize = '16px';
    controlLine3.style.margin = '5px 0';
    
    controls.appendChild(controlLine1);
    controls.appendChild(controlLine2);
    controls.appendChild(controlLine3);
    
    const hintText = document.createElement('p');
    hintText.textContent = 'Tap or press any key to start';
    hintText.style.fontSize = '18px';
    hintText.style.marginTop = '20px';
    hintText.style.animation = 'pulse 1.5s infinite';
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
    
    this.uiOverlay.appendChild(title);
    this.uiOverlay.appendChild(subtitle);
    this.uiOverlay.appendChild(controls);
    this.uiOverlay.appendChild(hintText);
    
    document.body.appendChild(this.uiOverlay);
  }
  
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.gameStarted && !this.gameOver) {
      this.startGame();
      return;
    }
    
    if (this.gameOver) {
      return;
    }
    
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.vehicle?.applyThrottle(1);
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.vehicle?.applyThrottle(-1);
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.vehicle?.applySteering(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.vehicle?.applySteering(1);
        break;
      case 'Space':
        this.vehicle?.applyBrake(true);
        break;
    }
  }
  
  private handleKeyUp(event: KeyboardEvent): void {
    if (this.gameOver) {
      return;
    }
    
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.vehicle?.applyThrottle(0);
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.vehicle?.applyThrottle(0);
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.vehicle?.applySteering(0);
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.vehicle?.applySteering(0);
        break;
      case 'Space':
        this.vehicle?.applyBrake(false);
        break;
    }
  }
  
  public start(): void {
    this.showStartScreen();
  }
}

// Export for module usage
export default MainGame;