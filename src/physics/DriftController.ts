/**
 * DriftController.ts
 * Core drift mechanics for Card Drive & Drift
 * Handles drift state machine, angle calculation, counter-steer assist, drift scoring, VFX triggers
 */

import { Vector2 } from './MathUtils';

export interface DriftState {
  isDrifting: boolean;
  driftAngle: number; // radians
  driftScore: number;
  comboMultiplier: number;
  comboCount: number;
  tireSmokeIntensity: number; // 0-1
  screenShakeIntensity: number; // 0-1
}

export interface DriftInput {
  steering: number; // -1 to 1
  throttle: number; // 0 to 1
  brake: number; // 0 to 1
  handbrake: boolean;
}

export interface DriftConfig {
  minDriftSpeed: number; // km/h
  maxDriftSpeed: number; // km/h
  driftThresholdAngle: number; // radians - when car starts drifting
  driftDecayRate: number; // radians per second
  driftBuildupRate: number; // radians per second
  driftMaintainRate: number; // radians per second
  driftScoreBase: number;
  driftScoreMultiplier: number;
  comboTimeoutMs: number;
  maxComboMultiplier: number;
  tireSmokeMinAngle: number; // radians
  tireSmokeMaxAngle: number; // radians
  screenShakeMinAngle: number; // radians
  screenShakeMaxAngle: number; // radians
  counterSteerAssistStrength: number; // 0-1
  counterSteerRecoveryTime: number; // seconds
}

const DEFAULT_CONFIG: DriftConfig = {
  minDriftSpeed: 30,
  maxDriftSpeed: 200,
  driftThresholdAngle: Math.PI / 8, // 22.5 degrees
  driftDecayRate: 0.5,
  driftBuildupRate: 0.8,
  driftMaintainRate: 0.3,
  driftScoreBase: 10,
  driftScoreMultiplier: 2.5,
  comboTimeoutMs: 2000,
  maxComboMultiplier: 5.0,
  tireSmokeMinAngle: Math.PI / 12, // 15 degrees
  tireSmokeMaxAngle: Math.PI / 4, // 45 degrees
  screenShakeMinAngle: Math.PI / 12,
  screenShakeMaxAngle: 0.1,
  counterSteerAssistStrength: 0.7,
  counterSteerRecoveryTime: 0.5,
};

export class DriftController {
  private config: DriftConfig;
  private lastUpdateTimestamp: number = 0;
  private driftStartTime: number = 0;
  private comboTimer: number = 0;
  private lastDriftAngle: number = 0;
  private counterSteerTarget: number = 0;
  private counterSteerActive: boolean = false;
  private counterSteerTimer: number = 0;

  constructor(config?: Partial<DriftConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  update(dt: number, velocity: number, input: DriftInput, currentDriftState: DriftState): DriftState {
    const timestamp = performance.now();
    
    // Calculate velocity magnitude
    const speed = Math.abs(velocity);
    
    // Check if we're in valid drift speed range
    const inSpeedRange = speed >= this.config.minDriftSpeed && speed <= this.config.maxDriftSpeed;
    
    // Calculate current yaw angle from velocity vector
    const yawAngle = Math.atan2(velocity.y, velocity.x);
    
    // Determine if car is pointed in different direction than moving
    let targetDriftAngle = Math.abs(yawAngle % (2 * Math.PI));
    if (targetDriftAngle > Math.PI) {
      targetDriftAngle -= 2 * Math.PI;
    }
    targetDriftAngle = Math.abs(targetDriftAngle);
    
    let newState: DriftState = { ...currentDriftState };
    
    // Handle drift entry
    if (!newState.isDrifting && inSpeedRange && Math.abs(input.steering) > 0.3) {
      if (targetDriftAngle >= this.config.driftThresholdAngle || input.handbrake) {
        newState.isDrifting = true;
        newState.driftStartTime = timestamp;
        newState.driftAngle = targetDriftAngle;
        newState.tireSmokeIntensity = 0;
        newState.screenShakeIntensity = 0;
        
        // Trigger drift start VFX
        this.triggerDriftStartVFX(newState);
      }
    }
    
    // Handle drift maintenance
    if (newState.isDrifting) {
      const timeInDrift = (timestamp - this.driftStartTime) / 1000; // seconds
      
      // Update drift angle based on input
      if (input.steering < -0.5 && targetDriftAngle < this.lastDriftAngle) {
        // Counter-steer needed
        newState.driftAngle += this.config.driftMaintainRate * dt;
        this.counterSteerActive = true;
        this.counterSteerTarget = input.steering * -1;
        this.counterSteerTimer = this.config.counterSteerRecoveryTime;
      } else if (input.steering > 0.5 && targetDriftAngle > this.lastDriftAngle) {
        newState.driftAngle -= this.config.driftMaintainRate * dt;
        this.counterSteerActive = true;
        this.counterSteerTarget = input.steering * -1;
        this.counterSteerTimer = this.config.counterSteerRecoveryTime;
      } else {
        // Build up or decay drift angle
        if (input.handbrake) {
          newState.driftAngle += this.config.driftBuildupRate * dt;
        } else {
          newState.driftAngle -= this.config.driftDecayRate * dt;
        }
      }
      
      // Clamp drift angle
      newState.driftAngle = Math.max(0, Math.min(newState.driftAngle, Math.PI / 2));
      
      // Update combo timer
      this.comboTimer += dt * 1000;
      if (this.comboTimer > this.config.comboTimeoutMs) {
        this.resetCombo();
      } else {
        // Increase combo count
        newState.comboCount++;
        newState.comboMultiplier = Math.min(
          this.config.maxComboMultiplier,
          1 + (newState.comboCount * 0.2)
        );
      }
      
      // Calculate drift score
      const driftDuration = timeInDrift;
      const baseScore = this.config.driftScoreBase * driftDuration;
      newState.driftScore += baseScore * newState.comboMultiplier;
      
      // Calculate VFX intensity based on drift angle
      const smokeIntensity = Math.min(
        1,
        (newState.driftAngle - this.config.tireSmokeMinAngle) / 
        (this.config.tireSmokeMaxAngle - this.config.tireSmokeMinAngle)
      );
      newState.tireSmokeIntensity = Math.max(0, smokeIntensity);
      
      const shakeIntensity = Math.min(
        this.config.screenShakeMaxAngle,
        (newState.driftAngle - this.config.screenShakeMinAngle) / 
        (this.config.tireSmokeMaxAngle - this.config.tireSmokeMinAngle)
      );
      newState.screenShakeIntensity = Math.max(0, shakeIntensity);
    }
    
    // Handle drift exit
    if (newState.isDrifting && !inSpeedRange) {
      this.completeDrift(newState);
      newState.isDrifting = false;
      newState.driftAngle = 0;
      newState.driftScore = 0;
      newState.comboMultiplier = 1;
      newState.comboCount = 0;
      newState.tireSmokeIntensity = 0;
      newState.screenShakeIntensity = 0;
    }
    
    this.lastDriftAngle = newState.driftAngle;
    return newState;
  }

  applyCounterSteer(currentSteering: number, dt: number): number {
    if (this.counterSteerActive && this.counterSteerTimer > 0) {
      this.counterSteerTimer -= dt;
      const assistAmount = this.config.counterSteerAssistStrength * dt;
      return currentSteering + (this.counterSteerTarget - currentSteering) * assistAmount;
    }
    this.counterSteerActive = false;
    return currentSteering;
  }

  getDriftScore(): number {
    return this.config.driftScoreBase * (performance.now() - this.driftStartTime) / 1000;
  }

  resetCombo(): void {
    this.comboTimer = 0;
    this.comboCount = 0;
  }

  completeDrift(state: DriftState): void {
    // Log drift completion for scoring
    console.log(`Drift Complete! Score: ${state.driftScore.toFixed(2)}, Combo: x${state.comboMultiplier.toFixed(2)}`);
  }

  triggerDriftStartVFX(state: DriftState): void {
    // This would trigger particle system for tire smoke
    // In a real implementation, this would emit an event to the particle system
    console.log('Drift started!');
  }

  getConfig(): DriftConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<DriftConfig>): void {
    this.config = { ...this.config, ...config };
  }
}