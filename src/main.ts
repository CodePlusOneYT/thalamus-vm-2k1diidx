/**
 * Main Game Entry Point - Card Drive & Drift
 * Initializes and coordinates all game systems
 */

import { Engine } from './engine/Engine.js';
import { InputManager } from './engine/InputManager.js';
import { EntityManager } from './engine/EntityManager.js';
import { SceneManager } from './engine/SceneManager.js';
import { PhysicsEngine } from './physics/PhysicsEngine.js';
import { VehiclePhysics } from './physics/VehiclePhysics.js';
import { CollisionSystem } from './physics/CollisionSystem.js';
import { DriftController } from './physics/DriftController.js';
import { RenderSystem } from './engine/RenderSystem.js';
import { AudioSystem } from './audio/AudioSystem.js';
import { CardVehicle } from './entities/CardVehicle.js';
import { TrackSegment } from './entities/TrackSegment.js';
import { Vector2 } from './physics/MathUtils.js';

type GameState = 'menu' | 'playing' | 'paused' | 'gameover' | 'victory';

export class Game {
  private engine: Engine;
  private input: InputManager;
  private entityManager: EntityManager;
  private sceneManager: SceneManager;
  private physicsEngine: PhysicsEngine;
  private vehiclePhysics: VehiclePhysics;
  private collisionSystem: CollisionSystem;
  private driftController: DriftController;
  private renderSystem: RenderSystem;
  private audioSystem: AudioSystem;
  
  private gameState: GameState = 'menu';
  private score: number = 0;
  private lapsCompleted: number = 0;
  private bestTime: number = Infinity;
  private currentTime: number = 0;
  private lapTimes: number[] = [];
  
  private playerCar: CardVehicle | null = null;
  private trackSegments: TrackSegment[] = [];
  
  constructor() {
    // Initialize engine
    this.engine = new Engine({
      targetFPS: 60,
      maxDeltaTime: 0.1,
      fixedTimeStep: 1 / 60,
      maxPhysicsSteps: 10,
      autoStart: false,
      canvas: '#game-canvas',
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#1a1a2e',
    });
    
    // Initialize input system
    this.input = new InputManager();
    
    // Initialize entity manager
    this.entityManager = new EntityManager();
    
    // Initialize scene manager
    this.sceneManager = new SceneManager(this.entityManager);
    
    // Initialize physics systems
    this.physicsEngine = new PhysicsEngine();
    this.vehiclePhysics = new VehiclePhysics();
    this.collisionSystem = new CollisionSystem();
    this.driftController = new DriftController();
    
    // Initialize render system
    this.renderSystem = new RenderSystem();
    
    // Initialize audio system
    this.audioSystem = new AudioSystem();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Generate initial track
    this.generateTrack();
    
    // Create player car
    this.createPlayerCar();
    
    // Register update callbacks
    this.registerCallbacks();
  }
  
  private setupEventListeners(): void {
    // Handle window resize
    window.addEventListener('resize', () => {
      const dpr = window.devicePixelRatio || 1;
      this.engine.canvas.width = window.innerWidth * dpr;
      this.engine.canvas.height = window.innerHeight * dpr;
      this.engine.canvas.style.width = `${window.innerWidth}px`;
      this.engine.canvas.style.height = `${window.innerHeight}px`;
    });
    
    // Handle visibility changes (pause on tab switch)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.gameState === 'playing') {
        this.pauseGame();
      }
    });
    
    // Handle user interaction for audio context
    document.addEventListener('click', () => {
      if (!this.audioSystem.isInitialized()) {
        this.audioSystem.init();
      }
    }, { once: true });
    
    document.addEventListener('keydown', (e) => {
      this.handleKeyPress(e);
    });
  }
  
  private handleKeyPress(event: KeyboardEvent): void {
    switch (event.key.toLowerCase()) {
      case 'escape':
      case 'p':
        if (this.gameState === 'playing') {
          this.pauseGame();
        } else if (this.gameState === 'paused') {
          this.resumeGame();
        }
        break;
      
      case 'r':
        if (this.gameState === 'gameover' || this.gameState === 'victory') {
          this.restartGame();
        }
        break;
      
      case ' ':
        if (this.gameState === 'menu') {
          this.startGame();
        } else if (this.gameState === 'gameover' || this.gameState === 'victory') {
          this.restartGame();
        }
        break;
    }
  }
  
  private registerCallbacks(): void {
    // Fixed timestep callback (physics updates)
    this.engine.onFixedTick((dt) => {
      if (this.gameState !== 'playing') return;
      this.updatePhysics(dt);
      this.updateGameLogic(dt);
    });
    
    // Frame callback (rendering)
    this.engine.onFrame((dt) => {
      if (this.gameState === 'playing') {
        this.currentTime += dt;
      }
      this.render();
      this.updateUI();
    });
  }
  
  private createPlayerCar(): void {
    const spawnPoint = this.getSpawnPoint();
    this.playerCar = new CardVehicle({
      x: spawnPoint.x,
      y: spawnPoint.y,
      width: 40,
      height: 70,
      color: '#3498db',
      physicsConfig: {
        mass: 1500,
        friction: 0.98,
        acceleration: 500,
        maxSpeed: 800,
        turnSpeed: 3,
        driftFactor: 0.1,
      },
    });
    
    this.entityManager.addEntity(this.playerCar);
  }
  
  private getSpawnPoint(): Vector2 {
    // Find the first track segment and use its center as spawn
    if (this.trackSegments.length > 0) {
      const firstSegment = this.trackSegments[0];
      return new Vector2(firstSegment.x + firstSegment.width / 2, firstSegment.y + firstSegment.height / 2);
    }
    return new Vector2(window.innerWidth / 2, window.innerHeight / 2);
  }
  
  private generateTrack(): void {
    this.trackSegments = [];
    
    const segmentWidth = 200;
    const segmentHeight = 150;
    const numSegments = 50;
    
    let x = 100;
    let y = window.innerHeight / 2;
    let direction = 1;
    
    for (let i = 0; i < numSegments; i++) {
      const segment = new TrackSegment({
        x,
        y,
        width: segmentWidth,
        height: segmentHeight,
        type: 'straight',
        difficulty: Math.min(1, i / 20),
        id: i,
      });
      
      this.trackSegments.push(segment);
      this.entityManager.addEntity(segment);
      
      // Add curves after straight sections
      if (i % 5 === 0 && i > 0) {
        direction *= -1;
        const curve = new TrackSegment({
          x: x + direction * 100,
          y: y + direction * 50,
          width: segmentWidth,
          height: segmentHeight,
          type: 'curve',
          difficulty: Math.min(1, i / 20),
          id: i,
        });
        
        this.trackSegments.push(curve);
        this.entityManager.addEntity(curve);
        x += direction * 100;
        y += direction * 50;
      } else {
        x += direction * segmentWidth;
      }
    }
  }
  
  private updatePhysics(deltaTime: number): void {
    if (!this.playerCar) return;
    
    // Get input
    const input = this.input.getState();
    
    // Apply steering
    if (input.left) {
      this.playerCar.applySteering(-1);
    }
    if (input.right) {
      this.playerCar.applySteering(1);
    }
    
    // Apply acceleration
    if (input.up) {
      this.playerCar.applyAcceleration(1);
    }
    if (input.down) {
      this.playerCar.applyAcceleration(-1);
    }
    
    // Update vehicle physics
    this.vehiclePhysics.update(this.playerCar, deltaTime);
    
    // Update drift controller
    this.driftController.update(this.playerCar, deltaTime);
    
    // Update physics engine
    this.physicsEngine.update(deltaTime);
    
    // Check collisions
    this.checkCollisions();
    
    // Update camera
    this.updateCamera();
  }
  
  private checkCollisions(): void {
    if (!this.playerCar) return;
    
    const player = this.playerCar;
    
    for (const segment of this.trackSegments) {
      if (this.collisionSystem.checkAABB(player, segment)) {
        // Calculate bounce based on relative velocity
        const relativeVel = player.velocity.sub(segment.velocity || new Vector2(0, 0));
        
        // Simple bounce response
        const normal = this.collisionSystem.calculateNormal(player, segment);
        
        if (normal) {
          const bounceFactor = 0.3;
          const impulse = normal.mul(relativeVel.dot(normal) * bounceFactor);
          
          player.velocity = player.velocity.sub(impulse);
          player.rotation += 0.1 * Math.sign(relativeVel.mag());
        }
        
        // Play collision sound
        this.audioSystem.playSound('collision');
        
        // Screen shake effect
        this.renderSystem.addScreenShake(5);
      }
    }
    
    // Check boundaries
    const bounds = this.getBounds();
    if (player.x < bounds.left || player.x > bounds.right || 
        player.y < bounds.top || player.y > bounds.bottom) {
      this.handleOutOfBounds(player);
    }
  }
  
  private getBounds(): { left: number; right: number; top: number; bottom: number } {
    return {
      left: 0,
      right: window.innerWidth,
      top: 0,
      bottom: window.innerHeight,
    };
  }
  
  private handleOutOfBounds(player: CardVehicle): void {
    // Penalty for going out of bounds
    this.score = Math.max(0, this.score - 100);
    this.audioSystem.playSound('damage');
    this.renderSystem.addScreenShake(10);
    
    // Slow down the car
    player.velocity = player.velocity.mul(0.5);
    
    // Push back onto track
    const spawnPoint = this.getSpawnPoint();
    player.x = spawnPoint.x;
    player.y = spawnPoint.y;
  }
  
  private updateCamera(): void {
    if (!this.playerCar) return;
    
    // Camera follows player with smooth interpolation
    const targetX = this.playerCar.x - window.innerWidth / 2;
    const targetY = this.playerCar.y - window.innerHeight / 2;
    
    this.renderSystem.setCamera(targetX, targetY);
  }
  
  private updateGameLogic(deltaTime: number): void {
    if (!this.playerCar) return;
    
    // Check lap completion
    this.checkLapCompletion();
    
    // Check victory condition
    if (this.lapsCompleted >= 3) {
      this.victory();
    }
  }
  
  private checkLapCompletion(): void {
    if (!this.playerCar) return;
    
    // Simple lap detection based on position
    // In a full implementation, this would use checkpoints
    const trackLength = this.trackSegments.reduce((sum, seg) => sum + seg.width, 0);
    
    // Check if player has crossed enough of the track
    const progress = this.playerCar.x / trackLength;
    
    if (progress > 1 && !this.lapInProgress) {
      this.completeLap();
    }
  }
  
  private lapInProgress: boolean = false;
  
  private completeLap(): void {
    this.lapInProgress = true;
    this.lapsCompleted++;
    
    const lapTime = this.currentTime;
    this.lapTimes.push(lapTime);
    
    if (lapTime < this.bestTime) {
      this.bestTime = lapTime;
    }
    
    this.score += 1000;
    
    this.audioSystem.playSound('coin');
    this.renderSystem.addFloatingText(`+${1000}`, this.playerCar!.x, this.playerCar!.y, '#f1c40f');
  }
  
  private render(): void {
    const ctx = this.engine.ctx;
    const width = this.engine.canvas.width;
    const height = this.engine.canvas.height;
    
    // Clear canvas
    ctx.fillStyle = this.engine.config.backgroundColor!;
    ctx.fillRect(0, 0, width, height);
    
    // Apply camera transform
    ctx.save();
    const cam = this.renderSystem.getCamera();
    ctx.translate(-cam.x, -cam.y);
    
    // Draw track segments
    for (const segment of this.trackSegments) {
      this.renderSystem.drawTrackSegment(segment);
    }
    
    // Draw particles
    for (const particle of this.entityManager.getEntitiesByType('particle')) {
      this.renderSystem.drawParticle(particle as any);
    }
    
    // Draw player car
    if (this.playerCar) {
      this.renderSystem.drawCardVehicle(this.playerCar);
    }
    
    ctx.restore();
    
    // Draw UI overlay (handled separately)
  }
  
  private updateUI(): void {
    const ctx = this.engine.ctx;
    const canvas = this.engine.canvas;
    
    // Score display
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this.score}`, 20, 40);
    
    // Lap counter
    ctx.textAlign = 'center';
    ctx.fillText(`Laps: ${this.lapsCompleted}/3`, canvas.width / 2, 40);
    
    // Best time
    ctx.textAlign = 'right';
    const bestTimeString = this.bestTime === Infinity ? 'N/A' : `${this.bestTime.toFixed(2)}s`;
    ctx.fillText(`Best Time: ${bestTimeString}`, canvas.width - 20, 40);
    
    // Current time
    ctx.fillText(`Time: ${this.currentTime.toFixed(2)}s`, canvas.width - 20, 70);
    
    // Controls hint
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#888888';
    ctx.fillText('WASD/Arrows: Drive | Space: Start | P: Pause', 20, canvas.height - 20);
  }
  
  private showMenu(): void {
    const ctx = this.engine.ctx;
    const canvas = this.engine.canvas;
    
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Title
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#3498db';
    ctx.textAlign = 'center';
    ctx.fillText('CARD DRIVE & DRIFT', canvas.width / 2, canvas.height / 2 - 80);
    
    // Subtitle
    ctx.font = '24px Arial';
    ctx.fillStyle = '#ecf0f1';
    ctx.fillText('Advanced Physics Racing', canvas.width / 2, canvas.height / 2 - 40);
    
    // Instructions
    ctx.font = '18px Arial';
    ctx.fillStyle = '#bdc3c7';
    ctx.fillText('Use WASD or Arrow Keys to drive', canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText('Complete 3 laps to win!', canvas.width / 2, canvas.height / 2 + 50);
    
    // Press space to start
    ctx.font = '24px Arial';
    ctx.fillText('Press SPACE to Start', canvas.width / 2, canvas.height / 2 + 120);
    
    // Controls hint
    ctx.font = '14px Arial';
    ctx.fillStyle = '#888888';
    ctx.fillText('P: Pause | R: Restart', canvas.width / 2, canvas.height / 2 + 160);
  }
  
  private showGameOver(): void {
    const ctx = this.engine.ctx;
    const canvas = this.engine.canvas;
    
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Game Over text
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#e74c3c';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 50);
    
    // Final stats
    ctx.font = '24px Arial';
    ctx.fillStyle = '#ecf0f1';
    ctx.fillText(`Final Score: ${this.score}`, canvas.width / 2, canvas.height / 2);
    
    if (this.bestTime !== Infinity) {
      ctx.fillText(`Best Time: ${this.bestTime.toFixed(2)}s`, canvas.width / 2, canvas.height / 2 + 40);
    }
    
    // Press R to restart
    ctx.font = '24px Arial';
    ctx.fillText('Press R to Restart', canvas.width / 2, canvas.height / 2 + 100);
  }
  
  private showVictory(): void {
    const ctx = this.engine.ctx;
    const canvas = this.engine.canvas;
    
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Victory text
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#2ecc71';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY!', canvas.width / 2, canvas.height / 2 - 50);
    
    // Final stats
    ctx.font = '24px Arial';
    ctx.fillStyle = '#ecf0f1';
    ctx.fillText(`Final Score: ${this.score}`, canvas.width / 2, canvas.height / 2);
    
    if (this.bestTime !== Infinity) {
      ctx.fillText(`Best Time: ${this.bestTime.toFixed(2)}s`, canvas.width / 2, canvas.height / 2 + 40);
    }
    
    // Press R to play again
    ctx.font = '24px Arial';
    ctx.fillText('Press R to Play Again', canvas.width / 2, canvas.height / 2 + 100);
  }
  
  private updateGameState(): void {
    switch (this.gameState) {
      case 'menu':
        this.showMenu();
        break;
      
      case 'gameover':
        this.showGameOver();
        break;
      
      case 'victory':
        this.showVictory();
        break;
      
      default:
        // Playing state - no menu overlay
        break;
    }
  }
  
  start(): void {
    this.engine.start();
  }
  
  pause(): void {
    this.engine.pause();
    this.gameState = 'paused';
  }
  
  resume(): void {
    this.engine.resume();
    this.gameState = 'playing';
  }
  
  stop(): void {
    this.engine.stop();
  }
  
  startGame(): void {
    this.resetGame();
    this.gameState = 'playing';
    this.currentTime = 0;
    this.lapsCompleted = 0;
    this.lapTimes = [];
    this.lapInProgress = false;
    this.engine.start();
  }
  
  pauseGame(): void {
    this.gameState = 'paused';
    this.engine.pause();
  }
  
  resumeGame(): void {
    this.gameState = 'playing';
    this.engine.resume();
  }
  
  restartGame(): void {
    this.resetGame();
    this.startGame();
  }
  
  victory(): void {
    this.gameState = 'victory';
    this.engine.pause();
    this.audioSystem.playSound('win');
  }
  
  gameOver(): void {
    this.gameState = 'gameover';
    this.engine.pause();
    this.audioSystem.playSound('lose');
  }
  
  private resetGame(): void {
    this.score = 0;
    this.lapsCompleted = 0;
    this.bestTime = Infinity;
    this.currentTime = 0;
    this.lapTimes = [];
    this.lapInProgress = false;
    
    // Regenerate track
    this.generateTrack();
    
    // Recreate player car
    this.entityManager.clearEntities();
    this.createPlayerCar();
  }
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.start();
    
    // Expose globally for debugging
    (window as any).__game = game;
  });
}