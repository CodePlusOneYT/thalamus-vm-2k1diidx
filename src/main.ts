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
  private highScore: number = 0;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    if (!this.ctx) {
      throw new Error('Failed to get canvas context');
    }

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
    this.start = this.start.bind(this);
    this.gameLoop = this.gameLoop.bind(this);
    this.update = this.update.bind(this);
    this.render = this.render.bind(this);
    this.handleGameOver = this.handleGameOver.bind(this);
    this.resetGame = this.resetGame.bind(this);
    
    // Load high score
    const savedHighScore = localStorage.getItem('cardDriveDrift_highScore');
    if (savedHighScore) {
      this.highScore = parseFloat(savedHighScore);
    }
  }

  /**
   * Initialize the game - setup event listeners and resize handling
   */
  init(): void {
    this.setupResizeHandler();
    this.setupInputHandlers();
    this.setupTouchHandlers();
    this.setupUIHandlers();
    this.resize();
    this.showStartScreen();
    
    // Store instance on window for debugging
    (window as Window).__cardDriveDrift = this;
    
    console.log('[CardDriveDrift] Game initialized successfully');
  }

  /**
   * Setup responsive canvas resize handling
   */
  private setupResizeHandler(): void {
    window.addEventListener('resize', () => this.resize());
  }

  /**
   * Resize canvas to fit viewport while maintaining aspect ratio
   */
  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    this.ctx.scale(dpr, dpr);
    
    // Notify renderer of size change
    this.renderer.setCanvasSize(rect.width, rect.height);
    
    // Update camera if exists
    if (this.vehicle) {
      const camera = this.entityMgr.getComponent(this.vehicle.id, 'camera') as Camera | undefined;
      if (camera) {
        camera.screenWidth = rect.width;
        camera.screenHeight = rect.height;
      }
    }
  }

  /**
   * Setup keyboard input handlers
   */
  private setupInputHandlers(): void {
    this.input.onKeyDown('ArrowLeft', () => this.handleLeft());
    this.input.onKeyDown('ArrowRight', () => this.handleRight());
    this.input.onKeyDown('ArrowUp', () => this.handleAccelerate());
    this.input.onKeyDown('ArrowDown', () => this.handleBrake());
    this.input.onKeyDown('KeyA', () => this.handleLeft());
    this.input.onKeyDown('KeyD', () => this.handleRight());
    this.input.onKeyDown('KeyW', () => this.handleAccelerate());
    this.input.onKeyDown('KeyS', () => this.handleBrake());
    this.input.onKeyDown('Space', () => this.handleDrift());
    this.input.onKeyDown('Enter', () => this.handleRestart());
    this.input.onKeyDown('Escape', () => this.togglePause());
  }

  /**
   * Setup touch controls for mobile
   */
  private setupTouchHandlers(): void {
    let touchLeft = false;
    let touchRight = false;
    let touchAccelerate = false;
    let touchBrake = false;
    let touchDrift = false;

    this.canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      this.resumeAudio();
      
      const touches = Array.from(e.changedTouches);
      const rect = this.canvas.getBoundingClientRect();
      
      touches.forEach(touch => {
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        const leftZone = x < rect.width / 3;
        const rightZone = x > rect.width / 3 && x < rect.width * 2 / 3;
        const accelerateZone = x >= rect.width * 2 / 3 && y < rect.height / 2;
        const brakeZone = x >= rect.width * 2 / 3 && y >= rect.height / 2;
        const driftZone = touch.clientX < rect.width * 0.15 || touch.clientX > rect.width * 0.85;
        
        if (leftZone) touchLeft = true;
        if (rightZone) touchRight = true;
        if (accelerateZone) touchAccelerate = true;
        if (brakeZone) touchBrake = true;
        if (driftZone) touchDrift = true;
      });
      
      this.applyTouchInputs(touchLeft, touchRight, touchAccelerate, touchBrake, touchDrift);
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault();
      touchLeft = false;
      touchRight = false;
      touchAccelerate = false;
      touchBrake = false;
      touchDrift = false;
      this.applyTouchInputs(false, false, false, false, false);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
    }, { passive: false });
  }

  /**
   * Apply touch input states to vehicle
   */
  private applyTouchInputs(left: boolean, right: boolean, accelerate: boolean, brake: boolean, drift: boolean): void {
    if (this.vehicle) {
      const vehicleComp = this.entityMgr.getComponent(this.vehicle.id, 'vehiclePhysics') as VehiclePhysics | undefined;
      if (vehicleComp) {
        vehicleComp.controls.left = left;
        vehicleComp.controls.right = right;
        vehicleComp.controls.accelerate = accelerate;
        vehicleComp.controls.brake = brake;
        vehicleComp.controls.drift = drift;
      }
    }
  }

  /**
   * Setup UI button handlers
   */
  private setupUIHandlers(): void {
    const startBtn = document.getElementById('startButton');
    const restartBtn = document.getElementById('restartButton');
    const pauseBtn = document.getElementById('pauseButton');
    
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startGame());
      startBtn.addEventListener('touchstart', () => this.startGame(), { passive: false });
    }
    
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.resetGame());
      restartBtn.addEventListener('touchstart', () => this.resetGame(), { passive: false });
    }
    
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.togglePause());
      pauseBtn.addEventListener('touchstart', () => this.togglePause(), { passive: false });
    }
  }

  /**
   * Start the game
   */
  startGame(): void {
    if (!this.gameStarted) {
      this.start();
      this.hideUI();
    } else if (this.gameOver) {
      this.resetGame();
    }
  }

  /**
   * Resume audio context after user gesture
   */
  private resumeAudio(): void {
    this.audio.resume();
  }

  /**
   * Handle left turn input
   */
  private handleLeft(): void {
    if (this.vehicle) {
      const vehicleComp = this.entityMgr.getComponent(this.vehicle.id, 'vehiclePhysics') as VehiclePhysics | undefined;
      if (vehicleComp) {
        vehicleComp.controls.left = true;
      }
    }
  }

  /**
   * Handle right turn input
   */
  private handleRight(): void {
    if (this.vehicle) {
      const vehicleComp = this.entityMgr.getComponent(this.vehicle.id, 'vehiclePhysics') as VehiclePhysics | undefined;
      if (vehicleComp) {
        vehicleComp.controls.right = true;
      }
    }
  }

  /**
   * Handle acceleration input
   */
  private handleAccelerate(): void {
    if (this.vehicle) {
      const vehicleComp = this.entityMgr.getComponent(this.vehicle.id, 'vehiclePhysics') as VehiclePhysics | undefined;
      if (vehicleComp) {
        vehicleComp.controls.accelerate = true;
      }
    }
  }

  /**
   * Handle braking input
   */
  private handleBrake(): void {
    if (this.vehicle) {
      const vehicleComp = this.entityMgr.getComponent(this.vehicle.id, 'vehiclePhysics') as VehiclePhysics | undefined;
      if (vehicleComp) {
        vehicleComp.controls.brake = true;
      }
    }
  }

  /**
   * Handle drift input
   */
  private handleDrift(): void {
    if (this.vehicle) {
      const vehicleComp = this.entityMgr.getComponent(this.vehicle.id, 'vehiclePhysics') as VehiclePhysics | undefined;
      if (vehicleComp) {
        vehicleComp.controls.drift = !vehicleComp.controls.drift;
      }
    }
  }

  /**
   * Handle restart input
   */
  private handleRestart(): void {
    if (this.gameOver) {
      this.resetGame();
    }
  }

  /**
   * Toggle pause state
   */
  private togglePause(): void {
    if (this.gameStarted && !this.gameOver) {
      this.engine.isPaused = !this.engine.isPaused;
    }
  }

  /**
   * Start the game loop
   */
  private start(): void {
    this.gameStarted = true;
    this.gameOver = false;
    this.score = 0;
    this.distance = 0;
    this.timeElapsed = 0;
    this.lastTime = performance.now();
    
    // Create player vehicle
    this.createPlayer();
    
    // Generate initial track
    this.generateInitialTrack();
    
    // Create camera
    this.createCamera();
    
    // Start game loop
    this.animationId = requestAnimationFrame(this.gameLoop);
    
    // Play background music
    this.audio.playMusic();
  }

  /**
   * Create player vehicle entity
   */
  private createPlayer(): void {
    const vehicle = new CardVehicle({
      x: 200,
      y: 0,
      width: 50,
      height: 80,
      color: '#ff6b35'
    });
    
    this.entityMgr.addEntity(vehicle);
    this.vehicle = vehicle;
    
    // Add vehicle physics component
    const physics = new VehiclePhysics(
      0.8,           // friction
      0.95,          // airResistance
      500,           // maxSpeed
      300,           // acceleration
      400,           // braking
      0.7,           // grip
      0.3,           // driftFactor
      0.9           // driftGripLoss
    );
    
    this.entityMgr.addComponent(vehicle.id, 'vehiclePhysics', physics);
    
    // Add collision component
    const collision = new CollisionSystem.AABBCollisionComponent({
      width: vehicle.width,
      height: vehicle.height
    });
    
    this.entityMgr.addComponent(vehicle.id, 'collision', collision);
    
    // Add particle emitter
    const particles = new Particle.ParticleEmitter({
      maxParticles: 50,
      lifeRange: [0.5, 1.5],
      speedRange: [5, 15],
      colors: ['#ff6b35', '#ffa500', '#ffff00']
    });
    
    this.entityMgr.addComponent(vehicle.id, 'particles', particles);
  }

  /**
   * Generate initial track segments
   */
  private generateInitialTrack(): void {
    const segmentCount = 20;
    let currentY = 0;
    const segmentWidth = 300;
    
    for (let i = 0; i < segmentCount; i++) {
      const segment = new TrackSegment({
        x: 0,
        y: currentY,
        width: segmentWidth,
        height: 60,
        type: 'normal' as const,
        obstacles: []
      });
      
      this.entityMgr.addEntity(segment);
      currentY += segment.height + 10;
    }
  }

  /**
   * Create camera entity
   */
  private createCamera(): void {
    const camera = new Camera({
      screenWidth: this.canvas.width / (Math.min(window.devicePixelRatio || 1, 2)),
      screenHeight: this.canvas.height / (Math.min(window.devicePixelRatio || 1, 2)),
      followTarget: this.vehicle?.id || null,
      smoothing: 0.1
    });
    
    this.entityMgr.addEntity(camera);
  }

  /**
   * Main game loop
   */
  private gameLoop(currentTime: number): void {
    if (!this.gameStarted) return;
    
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;
    
    if (!this.engine.isPaused) {
      this.update(deltaTime);
    }
    
    this.render();
    
    this.animationId = requestAnimationFrame(this.gameLoop);
  }

  /**
   * Update game state
   */
  private update(deltaTime: number): void {
    // Update physics
    this.physics.update(deltaTime);
    
    // Update entities
    this.entityMgr.update(deltaTime);
    
    // Update vehicle
    if (this.vehicle) {
      this.updateVehicle(deltaTime);
      this.checkCollisions();
      this.generateNewTrack();
    }
    
    // Update score based on distance traveled
    if (this.vehicle) {
      const vehiclePos = this.entityMgr.getComponent(this.vehicle.id, 'position') as { x: number, y: number } | undefined;
      if (vehiclePos) {
        const newDistance = Math.floor(Math.abs(vehiclePos.y) / 10);
        if (newDistance > this.distance) {
          this.distance = newDistance;
          this.score += (newDistance - (newDistance - Math.floor(Math.abs(vehiclePos.y) / 10)));
        }
      }
    }
    
    // Update time elapsed
    this.timeElapsed += deltaTime;
    
    // Update UI
    this.updateUI();
  }

  /**
   * Update vehicle behavior
   */
  private updateVehicle(deltaTime: number): void {
    if (!this.vehicle) return;
    
    const vehicleComp = this.entityMgr.getComponent(this.vehicle.id, 'vehiclePhysics') as VehiclePhysics | undefined;
    const posComp = this.entityMgr.getComponent(this.vehicle.id, 'position') as { x: number, y: number } | undefined;
    
    if (vehicleComp && posComp) {
      // Update position
      posComp.x += vehicleComp.velocity.x * deltaTime;
      posComp.y += vehicleComp.velocity.y * deltaTime;
      
      // Update velocity
      vehicleComp.update(deltaTime);
      
      // Check bounds
      if (posComp.y > 10000) {
        this.handleGameOver();
      }
    }
  }

  /**
   * Check collisions with track segments
   */
  private checkCollisions(): void {
    if (!this.vehicle) return;
    
    const vehiclePos = this.entityMgr.getComponent(this.vehicle.id, 'position') as { x: number, y: number } | undefined;
    const vehiclePhys = this.entityMgr.getComponent(this.vehicle.id, 'vehiclePhysics') as VehiclePhysics | undefined;
    
    if (!vehiclePos || !vehiclePhys) return;
    
    const vehicleWidth = this.entityMgr.getComponent(this.vehicle.id, 'collision') as { width: number } | undefined;
    const vehicleHeight = this.entityMgr.getComponent(this.vehicle.id, 'collision') as { height: number } | undefined;
    
    if (!vehicleWidth || !vehicleHeight) return;
    
    // Get all track segments
    const segments = this.entityMgr.getEntitiesByType('trackSegment');
    
    for (const segment of segments) {
      const segPos = this.entityMgr.getComponent(segment.id, 'position') as { x: number, y: number } | undefined;
      const segWidth = this.entityMgr.getComponent(segment.id, 'size') as { width: number } | undefined;
      const segHeight = this.entityMgr.getComponent(segment.id, 'size') as { height: number } | undefined;
      
      if (!segPos || !segWidth || !segHeight) continue;
      
      // AABB collision detection
      if (this.aabbCollision(
        vehiclePos.x - vehicleWidth.width / 2,
        vehiclePos.y - vehicleHeight.height / 2,
        vehicleWidth.width,
        vehicleHeight.height,
        segPos.x,
        segPos.y,
        segWidth.width,
        segHeight.height
      )) {
        // Bounce vehicle
        if (vehiclePhys.velocity.y > 0) {
          vehiclePhys.velocity.y = -vehiclePhys.velocity.y * 0.5;
          
          // Add particle effect
          this.spawnCollisionParticles(vehiclePos.x, vehiclePos.y);
          
          // Play bounce sound
          this.audio.playSound('bounce');
        }
      }
    }
  }

  /**
   * AABB collision detection
   */
  private aabbCollision(x1: number, y1: number, w1: number, h1: number, 
                        x2: number, y2: number, w2: number, h2: number): boolean {
    return x1 < x2 + w2 &&
           x1 + w1 > x2 &&
           y1 < y2 + h2 &&
           y1 + h1 > y2;
  }

  /**
   * Spawn collision particles
   */
  private spawnCollisionParticles(x: number, y: number): void {
    if (!this.vehicle) return;
    
    const particles = this.entityMgr.getComponent(this.vehicle.id, 'particles') as Particle.ParticleEmitter | undefined;
    
    if (particles) {
      for (let i = 0; i < 10; i++) {
        particles.emit(x, y);
      }
    }
  }

  /**
   * Generate new track segments as player progresses
   */
  private generateNewTrack(): void {
    if (!this.vehicle) return;
    
    const vehiclePos = this.entityMgr.getComponent(this.vehicle.id, 'position') as { x: number, y: number } | undefined;
    if (!vehiclePos) return;
    
    // Check if we need more track ahead
    const segments = this.entityMgr.getEntitiesByType('trackSegment');
    if (segments.length === 0) return;
    
    const farthestSegment = segments.reduce((max, seg) => {
      const segPos = this.entityMgr.getComponent(seg.id, 'position') as { y: number } | undefined;
      return (segPos?.y ?? 0) > (max?.y ?? 0) ? segPos ?? { y: 0 } : max;
    }, null) as { y: number };
    
    if (!farthestSegment) return;
    
    const viewDistance = 1500;
    
    if (vehiclePos.y < farthestSegment.y - viewDistance) {
      const segmentWidth = 300;
      const segmentHeight = 60;
      const baseY = farthestSegment.y + segmentHeight + 10;
      
      // Generate 5 new segments
      for (let i = 0; i < 5; i++) {
        const randomVariation = Math.random() * 50 - 25;
        const segment = new TrackSegment({
          x: randomVariation,
          y: baseY + i * (segmentHeight + 10),
          width: segmentWidth,
          height: segmentHeight,
          type: this.getRandomTrackType(),
          obstacles: this.generateObstacles()
        });
        
        this.entityMgr.addEntity(segment);
      }
      
      // Remove old segments behind player
      const removeThreshold = vehiclePos.y + 500;
      const segmentsToRemove = segments.filter(seg => {
        const segPos = this.entityMgr.getComponent(seg.id, 'position') as { y: number } | undefined;
        return segPos?.y ?? 0 < removeThreshold;
      });
      
      for (const seg of segmentsToRemove) {
        this.entityMgr.removeEntity(seg.id);
      }
    }
  }

  /**
   * Get random track type
   */
  private getRandomTrackType(): 'normal' | 'jump' | 'slope' | 'rough' {
    const types = ['normal', 'jump', 'slope', 'rough'] as const;
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Generate random obstacles
   */
  private generateObstacles(): Array<{ x: number, y: number, type: string }> {
    const obstacles = [];
    const obstacleCount = Math.floor(Math.random() * 3);
    
    for (let i = 0; i < obstacleCount; i++) {
      obstacles.push({
        x: Math.random() * 200 - 100,
        y: 10,
        type: ['coin', 'boost', 'hazard'][Math.floor(Math.random() * 3)]
      });
    }
    
    return obstacles;
  }

  /**
   * Render game frame
   */
  private render(): void {
    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw background gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#2d2d44');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw all entities
    this.renderer.renderAll(this.entityMgr);
    
    // Draw HUD
    this.drawHUD();
  }

  /**
   * Draw heads-up display
   */
  private drawHUD(): void {
    this.ctx.font = 'bold 24px Arial';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'left';
    
    // Score
    this.ctx.fillText(`SCORE: ${this.score}`, 20, 40);
    
    // Distance
    this.ctx.fillText(`DISTANCE: ${this.distance}m`, 20, 70);
    
    // Time
    const minutes = Math.floor(this.timeElapsed / 60);
    const seconds = Math.floor(this.timeElapsed % 60);
    const ms = Math.floor((this.timeElapsed % 1) * 100);
    this.ctx.fillText(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`, 20, 100);
    
    // High score
    this.ctx.fillStyle = '#ffd700';
    this.ctx.fillText(`HIGH SCORE: ${this.highScore}`, 20, 130);
    
    // Speed indicator
    if (this.vehicle) {
      const vehiclePhys = this.entityMgr.getComponent(this.vehicle.id, 'vehiclePhysics') as VehiclePhysics | undefined;
      if (vehiclePhys) {
        const speed = Math.abs(vehiclePhys.velocity.y);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(`SPEED: ${Math.floor(speed)} km/h`, this.canvas.width - 200, 40);
      }
    }
    
    // Pause indicator
    if (this.engine.isPaused) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 48px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
      this.ctx.font = '24px Arial';
      this.ctx.fillText('Press ESC to resume', this.canvas.width / 2, this.canvas.height / 2 + 50);
    }
  }

  /**
   * Update UI elements
   */
  private updateUI(): void {
    const scoreEl = document.getElementById('scoreDisplay');
    const distanceEl = document.getElementById('distanceDisplay');
    const timeEl = document.getElementById('timeDisplay');
    const highScoreEl = document.getElementById('highScoreDisplay');
    
    if (scoreEl) scoreEl.textContent = `${this.score}`;
    if (distanceEl) distanceEl.textContent = `${this.distance}m`;
    
    if (timeEl) {
      const minutes = Math.floor(this.timeElapsed / 60);
      const seconds = Math.floor(this.timeElapsed % 60);
      const ms = Math.floor((this.timeElapsed % 1) * 100);
      timeEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    
    if (highScoreEl) highScoreEl.textContent = `${this.highScore}`;
  }

  /**
   * Show start screen
   */
  private showStartScreen(): void {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('CARD DRIVE & DRIFT', this.canvas.width / 2, this.canvas.height / 2 - 80);
    
    this.ctx.font = '24px Arial';
    this.ctx.fillText('Use Arrow Keys or WASD to drive', this.canvas.width / 2, this.canvas.height / 2 - 30);
    this.ctx.fillText('SPACE to drift', this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.fillText('Press START to begin', this.canvas.width / 2, this.canvas.height / 2 + 50);
  }

  /**
   * Hide UI elements
   */
  private hideUI(): void {
    const uiElements = ['startScreen', 'gameOverScreen', 'pauseScreen'];
    uiElements.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  /**
   * Show game over screen
   */
  private showGameOverScreen(): void {
    const gameOverScreen = document.getElementById('gameOverScreen');
    if (!gameOverScreen) return;
    
    gameOverScreen.style.display = 'flex';
    
    const finalScoreEl = document.getElementById('finalScore');
    const finalDistanceEl = document.getElementById('finalDistance');
    
    if (finalScoreEl) finalScoreEl.textContent = `${this.score}`;
    if (finalDistanceEl) finalDistanceEl.textContent = `${this.distance}m`;
    
    // Save high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('cardDriveDrift_highScore', this.highScore.toString());
      
      const highScoreEl = document.getElementById('newHighScore');
      if (highScoreEl) {
        highScoreEl.style.display = 'block';
      }
    }
  }

  /**
   * Handle game over
   */
  private handleGameOver(): void {
    this.gameOver = true;
    this.gameStarted = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Stop music
    this.audio.stopMusic();
    
    // Play game over sound
    this.audio.playSound('gameOver');
    
    // Show game over screen
    this.showGameOverScreen();
  }

  /**
   * Reset game state
   */
  resetGame(): void {
    // Cancel animation loop
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Remove all entities
    this.entityMgr.clear();
    
    // Reset state
    this.gameOver = false;
    this.gameStarted = false;
    this.score = 0;
    this.distance = 0;
    this.timeElapsed = 0;
    
    // Hide UI
    this.hideUI();
    
    // Restart game
    this.start();
  }

  /**
   * Cleanup on page unload
   */
  destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.input.destroy();
    this.audio.destroy();
  }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    const game = new CardDriveDrift();
    game.init();
    console.log('[CardDriveDrift] Game ready to play!');
  } catch (error) {
    console.error('[CardDriveDrift] Initialization failed:', error);
    alert('Failed to initialize game. Please refresh the page.');
  }
});