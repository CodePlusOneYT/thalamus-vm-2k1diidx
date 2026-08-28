import { Entity } from './Entity.js';
import { Vector2, clamp, lerp, normalize, dotProduct, crossProduct } from '../physics/MathUtils.js';
import { VehiclePhysics } from '../physics/VehiclePhysics.js';
import { DriftController } from '../physics/DriftController.js';
import { CollisionShape, AABB, Circle, Transform } from '../physics/CollisionSystem.js';
import { ParticleManager } from './ParticleManager.js';
import { CardDeck } from '../cards/CardDeck.js';
import { AudioController } from '../audio/AudioController.js';

/**
 * CardVehicle - The player-controlled vehicle entity
 * Integrates physics simulation, card power-ups, and drift scoring
 */
export interface CardVehicleConfig {
  position: Vector2;
  rotation: number;
  color?: string;
  cardDeckType?: 'racing' | 'drift' | 'balanced';
  name?: string;
}

export class CardVehicle extends Entity {
  // Physics components
  private _vehiclePhysics: VehiclePhysics;
  private _driftController: DriftController;
  
  // Game state
  private _isDrifting: boolean = false;
  private _driftScore: number = 0;
  private _maxSpeed: number = 350; // pixels per second
  private _currentSpeed: number = 0;
  
  // Card system
  private _cardDeck: CardDeck;
  private _activeCardEffects: Map<string, number> = new Map(); // effectName -> remainingTime
  
  // Visual state
  private _tiresSkidding: boolean[] = [false, false, false, false]; // FL, FR, RL, RR
  private _particles: ParticleManager;
  private _audioController: AudioController;
  
  // Input state (for visual feedback)
  private _inputState: {
    throttle: number; // 0-1
    brake: number; // 0-1
    steer: number; // -1 to 1
    handbrake: boolean;
  } = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  
  constructor(config: CardVehicleConfig, audioController?: AudioController) {
    super(new Transform(config.position.clone(), config.rotation));
    
    this.name = config.name || 'CardVehicle';
    this.color = config.color || '#ff6b35';
    
    // Initialize physics components
    this._vehiclePhysics = new VehiclePhysics({
      mass: 1200, // kg
      centerOfMass: new Vector2(0, 0),
      momentOfInertia: 2500,
      wheelBase: 2.4, // meters
      trackWidth: 1.6,
      tireStiffness: 80000,
      dampingRatio: 0.4,
      maxSteerAngle: Math.PI / 4, // 45 degrees
      drivetrain: 'AWD',
      gearRatios: [3.5, 2.2, 1.5, 1.0, 0.8],
      finalDrive: 4.1,
    });
    
    this._driftController = new DriftController({
      driftThreshold: 12, // degrees
      driftRecoveryRate: 3.0,
      driftPenalty: 0.92, // speed multiplier while drifting
      driftBonus: 1.5, // score multiplier
    });
    
    // Initialize particle system
    this._particles = new ParticleManager(audioController);
    
    // Initialize card deck based on type
    const deckType = config.cardDeckType || 'balanced';
    this._cardDeck = new CardDeck(deckType);
    
    // Initialize audio controller
    this._audioController = audioController || AudioController.getInstance();
    
    // Add collision shape
    const width = 1.8;
    const height = 3.8;
    const shape = new AABB(
      new Vector2(-width / 2, -height / 2),
      new Vector2(width / 2, height / 2)
    );
    this.addCollisionShape(shape);
  }
  
  // Getters
  get vehiclePhysics(): VehiclePhysics { return this._vehiclePhysics; }
  get driftController(): DriftController { return this._driftController; }
  get cardDeck(): CardDeck { return this._cardDeck; }
  get currentSpeed(): number { return this._currentSpeed; }
  get isDrifting(): boolean { return this._isDrifting; }
  get driftScore(): number { return this._driftScore; }
  get inputState() { return this._inputState; }
  get tiresSkidding() { return this._tiresSkidding; }
  
  /**
   * Update vehicle state based on inputs
   * Called each frame by the engine
   */
  update(deltaTime: number, input: {
    throttle: number;
    brake: number;
    steer: number;
    handbrake: boolean;
  }): void {
    // Store input for visual feedback
    this._inputState = { ...input };
    
    // Update physics
    this._updatePhysics(deltaTime, input);
    
    // Update drift detection
    this._updateDrift(input);
    
    // Update active card effects
    this._updateCardEffects(deltaTime);
    
    // Generate particles based on state
    this._generateParticles(deltaTime);
  }
  
  /**
   * Apply physics forces based on driver inputs
   */
  private _updatePhysics(deltaTime: number, input: {
    throttle: number;
    brake: number;
    steer: number;
    handbrake: boolean;
  }): void {
    const dt = Math.min(deltaTime, 0.033); // Cap at ~30 FPS
    
    // Calculate target throttle (with acceleration curve)
    const targetThrottle = lerp(this._vehiclePhysics.throttle, input.throttle, 5 * dt);
    const targetBrake = lerp(this._vehiclePhysics.brake, input.brake, 10 * dt);
    const targetSteer = lerp(this._vehiclePhysics.steer, input.steer, 8 * dt);
    
    // Apply inputs to vehicle physics
    this._vehiclePhysics.throttle = targetThrottle;
    this._vehiclePhysics.brake = targetBrake;
    this._vehiclePhysics.steer = targetSteer;
    this._vehiclePhysics.handbrake = input.handbrake;
    
    // Simulate vehicle dynamics
    this._vehiclePhysics.update(dt);
    
    // Apply drift penalty if drifting
    if (this._isDrifting) {
      const speedMultiplier = this._driftController.driftPenalty;
      const velocity = this._vehiclePhysics.velocity.clone();
      velocity.scale(speedMultiplier);
      this._vehiclePhysics.velocity = velocity;
    }
    
    // Update current speed
    this._currentSpeed = this._vehiclePhysics.speed;
    
    // Update tire skid states
    this._updateTireStates();
  }
  
  /**
   * Detect and manage drifting state
   */
  private _updateDrift(input: {
    throttle: number;
    brake: number;
    steer: number;
    handbrake: boolean;
  }): void {
    const slipAngle = this._vehiclePhysics.slipAngle;
    const lateralVelocity = this._vehiclePhysics.lateralVelocity;
    const speed = this._vehiclePhysics.speed;
    
    // Check if we're in a drift
    const wasDrifting = this._isDrifting;
    this._isDrifting = this._driftController.isDrifting(slipAngle, lateralVelocity, input.handbrake);
    
    // Calculate drift score
    if (this._isDrifting && speed > 10) {
      const driftDuration = 1 / 60; // seconds per frame
      const driftIntensity = this._driftController.getDriftIntensity(slipAngle);
      const scoreGain = driftDuration * driftIntensity * this._driftController.driftBonus;
      this._driftScore += scoreGain;
      
      // Play drift sound if started or continuing
      if (!wasDrifting && this._isDrifting) {
        this._audioController?.playSound('drift_start');
      } else if (wasDrifting && this._isDrifting) {
        this._audioController?.playSound('drift_loop');
      }
    } else {
      // End drift
      this._isDrifting = false;
      if (wasDrifting) {
        this._audioController?.playSound('drift_end');
      }
    }
    
    // Recover from drift over time
    if (wasDrifting && !this._isDrifting) {
      this._driftController.recoverFromDrift();
    }
  }
  
  /**
   * Update tire skid detection for visual feedback
   */
  private _updateTireStates(): void {
    const slipAngles = this._vehiclePhysics.tireSlipAngles;
    const normalForces = this._vehiclePhysics.tireNormalForces;
    
    for (let i = 0; i < 4; i++) {
      const slipAngle = Math.abs(slipAngles[i]);
      const normalForce = normalForces[i];
      
      // Tire is skidding if slip angle is high AND there's normal force
      this._tiresSkidding[i] = slipAngle > 0.3 && normalForce > 100;
    }
  }
  
  /**
   * Update active card effect timers
   */
  private _updateCardEffects(deltaTime: number): void {
    for (const [effectName, endTime] of this._activeCardEffects.entries()) {
      if (endTime <= performance.now()) {
        this._activeCardEffects.delete(effectName);
        this._onCardEffectExpired(effectName);
      }
    }
  }
  
  /**
   * Generate particles based on current state
   */
  private _generateParticles(deltaTime: number): void {
    const position = this.transform.position;
    
    // Tire smoke when drifting
    if (this._isDrifting && this.currentSpeed > 20) {
      for (let i = 0; i < 4; i++) {
        if (this._tiresSkidding[i]) {
          const tireOffset = this._getTirePosition(i);
          this._particles.emitSmoke(position.add(tireOffset), 2, deltaTime);
        }
      }
    }
    
    // Engine exhaust when accelerating
    if (this._inputState.throttle > 0.7) {
      const rearCenter = new Vector2(-1.5, 0);
      this._particles.emitExhaust(position.add(rearCenter), 3, deltaTime);
    }
    
    // Speed lines when going fast
    if (this.currentSpeed > 200) {
      const offset = new Vector2(
        (Math.random() - 0.5) * 400,
        (Math.random() - 0.5) * 400
      );
      this._particles.emitSpeedLine(position.add(offset), 1, deltaTime);
    }
  }
  
  /**
   * Get tire world position
   */
  private _getTirePosition(tireIndex: number): Vector2 {
    const wheelBase = 1.2;
    const trackWidth = 0.8;
    
    const positions = [
      new Vector2(-wheelBase, -trackWidth), // FL
      new Vector2(-wheelBase, trackWidth),  // FR
      new Vector2(wheelBase, -trackWidth),  // RL
      new Vector2(wheelBase, trackWidth),   // RR
    ];
    
    const localPos = positions[tireIndex];
    return this.transform.applyTransform(localPos);
  }
  
  /**
   * Trigger a card effect
   */
  activateCard(cardId: string, duration?: number): void {
    const card = this._cardDeck.getCard(cardId);
    if (!card) return;
    
    const endTime = duration ? performance.now() + duration * 1000 : Infinity;
    this._activeCardEffects.set(cardId, endTime);
    
    switch (card.type) {
      case 'boost':
        this._applyBoost(card.value);
        this._audioController?.playSound('boost_activate');
        break;
      case 'shield':
        this._applyShield(card.value);
        this._audioController?.playSound('shield_activate');
        break;
      case 'nitro':
        this._activateNitro(card.value);
        this._audioController?.playSound('nitro_activate');
        break;
      case 'magnet':
        this._activateMagnet(card.value);
        this._audioController?.playSound('magnet_activate');
        break;
      default:
        console.warn(`Unknown card type: ${card.type}`);
    }
  }
  
  /**
   * Handle card effect expiration
   */
  private _onCardEffectExpired(effectName: string): void {
    switch (effectName) {
      case 'boost':
        this._audioController?.playSound('boost_expire');
        break;
      case 'shield':
        this._audioController?.playSound('shield_expire');
        break;
      case 'nitro':
        this._audioController?.playSound('nitro_expire');
        break;
      case 'magnet':
        this._audioController?.playSound('magnet_expire');
        break;
    }
  }
  
  /**
   * Apply speed boost
   */
  private _applyBoost(amount: number): void {
    const boost = amount * 50; // pixels per second
    this._vehiclePhysics.velocity = this._vehiclePhysics.velocity.add(boost * this.transform.forward);
  }
  
  /**
   * Apply invulnerability shield
   */
  private _applyShield(duration: number): void {
    // Shield logic would be handled by collision system
    this._activeCardEffects.set('shield_active_time', performance.now() + duration * 1000);
  }
  
  /**
   * Activate temporary nitro burst
   */
  private _activateNitro(amount: number): void {
    const nitroBoost = amount * 100;
    this._vehiclePhysics.throttle = 1.0;
    setTimeout(() => {
      this._vehiclePhysics.throttle = 0;
    }, amount * 1000);
  }
  
  /**
   * Activate magnet for item collection
   */
  private _activateMagnet(radius: number): void {
    // Magnet logic would be handled by item pickup system
    this._activeCardEffects.set('magnet_radius', radius);
  }
  
  /**
   * Reset vehicle to starting configuration
   */
  reset(): void {
    this._vehiclePhysics.reset();
    this._driftController.reset();
    this._driftScore = 0;
    this._activeCardEffects.clear();
    this._particles.clear();
    this.transform.position.set(0, 0);
    this.transform.rotation = 0;
  }
  
  /**
   * Get drift data for UI display
   */
  getDriftData(): {
    isDrifting: boolean;
    driftScore: number;
    driftIntensity: number;
    slipAngle: number;
    tiresSkidding: boolean[];
  } {
    return {
      isDrifting: this._isDrifting,
      driftScore: this._driftScore,
      driftIntensity: this._driftController.getDriftIntensity(this._vehiclePhysics.slipAngle),
      slipAngle: this._vehiclePhysics.slipAngle,
      tiresSkidding: [...this._tiresSkidding],
    };
  }
  
  /**
   * Render the vehicle
   */
  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.transform.position.x, this.transform.position.y);
    ctx.rotate(this.transform.rotation);
    
    // Draw body
    ctx.fillStyle = this._inputState.throttle > 0.7 ? '#ff6b35' : this.color;
    ctx.fillRect(-1.5, -0.9, 3.0, 1.8);
    
    // Draw cockpit
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(-0.5, -0.5, 1.0, 1.0);
    
    // Draw wheels
    ctx.fillStyle = '#333';
    const wheelPositions = [
      [-0.8, -0.8], [-0.8, 0.8], [0.8, -0.8], [0.8, 0.8],
    ];
    
    for (const [x, y] of wheelPositions) {
      ctx.beginPath();
      ctx.arc(x, y, 0.3, 0, Math.PI * 2);
      ctx.fill();
      
      // Skid marks on wheels
      const tireIndex = wheelPositions.indexOf([x, y]);
      if (this._tiresSkidding[tireIndex]) {
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 0.2, y - 0.2, 0.4, 0.4);
      }
    }
    
    // Draw spoiler
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(1.2, -1.0, 0.3, 2.0);
    
    ctx.restore();
  }
}