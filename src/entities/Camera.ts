import { Entity } from "./Entity";
import type { CardVehicle } from "./CardVehicle";

export interface CameraConfig {
  smoothFollowSpeed?: number;     // 0-1, higher = faster following
  minZoom?: number;                // Minimum zoom level
  maxZoom?: number;                // Maximum zoom level
  zoomSpeed?: number;              // How fast zoom changes
  baseZoom?: number;               // Default zoom level
  shakeIntensity?: number;         // Base shake intensity
  shakeDecay?: number;             // How fast shake decays (per frame)
  shakeMaxDuration?: number;       // Max shake duration in frames
  roadMarginPercent?: number;      // Extra space around road (0-1)
}

interface ShakeEvent {
  intensity: number;
  duration: number;
  elapsed: number;
}

export class Camera extends Entity {
  private config: Required<CameraConfig>;
  private target: Entity | null = null;
  
  // Current camera state
  private x: number = 0;
  private y: number = 0;
  private zoom: number = 1;
  private targetZoom: number = 1;
  
  // Shake system
  private shakeEvents: ShakeEvent[] = [];
  private shakeX: number = 0;
  private shakeY: number = 0;

  constructor(config: CameraConfig = {}) {
    super(0, 0);
    
    this.config = {
      smoothFollowSpeed: config.smoothFollowSpeed ?? 0.08,
      minZoom: config.minZoom ?? 0.4,
      maxZoom: config.maxZoom ?? 1.2,
      zoomSpeed: config.zoomSpeed ?? 0.02,
      baseZoom: config.baseZoom ?? 0.8,
      shakeIntensity: config.shakeIntensity ?? 8,
      shakeDecay: config.shakeDecay ?? 0.92,
      shakeMaxDuration: config.shakeMaxDuration ?? 30,
      roadMarginPercent: config.roadMarginPercent ?? 0.15,
    };
  }

  /**
   * Set the target entity to follow (usually the player vehicle)
   */
  setTarget(target: Entity | null): void {
    this.target = target;
  }

  /**
   * Trigger screen shake effect
   */
  addShake(intensity: number, durationFrames: number = 15): void {
    if (intensity <= 0 || durationFrames <= 0) return;
    
    this.shakeEvents.push({
      intensity: Math.min(intensity, 50),
      duration: durationFrames,
      elapsed: 0,
    });
  }

  /**
   * Add multiple shake events (for cumulative effects like explosions)
   */
  addMultiShake(events: { intensity: number; duration: number }[]): void {
    for (const event of events) {
      this.addShake(event.intensity, event.duration);
    }
  }

  /**
   * Update camera position and effects
   */
  update(deltaTime: number, width: number, height: number): void {
    if (!this.target) return;

    // Update zoom based on target speed (if vehicle)
    const speed = 'getSpeed' in this.target ? this.target.getSpeed() : 0;
    const targetZoom = this.calculateDynamicZoom(speed);
    this.targetZoom = targetZoom;

    // Smoothly interpolate zoom
    const zoomDelta = this.targetZoom - this.zoom;
    this.zoom += zoomDelta * this.config.zoomSpeed * deltaTime;
    this.zoom = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, this.zoom));

    // Handle shake decay and application
    this.updateShake(deltaTime, width, height);

    // Follow target smoothly
    const targetX = this.target.x;
    const targetY = this.target.y;
    
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    
    this.x += dx * this.config.smoothFollowSpeed * deltaTime;
    this.y += dy * this.config.smoothFollowSpeed * deltaTime;
  }

  /**
   * Calculate zoom level based on vehicle speed
   */
  private calculateDynamicZoom(speed: number): number {
    // Speed range: 0-150 (normalized 0-1)
    const normalizedSpeed = Math.min(speed / 150, 1);
    
    // Interpolate between min and max zoom
    const dynamicZoom = 
      this.config.baseZoom + 
      (this.config.maxZoom - this.config.baseZoom) * normalizedSpeed;
    
    return Math.max(this.config.minZoom, Math.min(this.config.maxZoom, dynamicZoom));
  }

  /**
   * Update shake effects over time
   */
  private updateShake(deltaTime: number, width: number, height: number): void {
    this.shakeX = 0;
    this.shakeY = 0;

    // Process active shake events
    for (let i = this.shakeEvents.length - 1; i >= 0; i--) {
      const event = this.shakeEvents[i];
      event.elapsed++;

      // Apply random shake offset
      const progress = event.elapsed / event.duration;
      const remaining = 1 - progress;
      
      // Stronger shake at start, easing out
      const currentIntensity = event.intensity * remaining;
      
      if (currentIntensity > 0.1) {
        // Generate random offset within intensity bounds
        this.shakeX += (Math.random() - 0.5) * currentIntensity * 2;
        this.shakeY += (Math.random() - 0.5) * currentIntensity * 2;
      }

      // Remove expired events
      if (event.elapsed >= event.duration) {
        this.shakeEvents.splice(i, 1);
      }
    }

    // Apply decay factor to accumulated shake
    this.shakeX *= this.config.shakeDecay;
    this.shakeY *= this.config.shakeDecay;
  }

  /**
   * Get current camera transform for rendering
   */
  getTransform(): { x: number; y: number; zoom: number; shakeX: number; shakeY: number } {
    return {
      x: this.x + this.shakeX,
      y: this.y + this.shakeY,
      zoom: this.zoom,
      shakeX: this.shakeX,
      shakeY: this.shakeY,
    };
  }

  /**
   * Reset all shake effects immediately
   */
  resetShake(): void {
    this.shakeEvents = [];
    this.shakeX = 0;
    this.shakeY = 0;
  }

  /**
   * Get current shake intensity (useful for UI feedback)
   */
  getShakeIntensity(): number {
    let totalIntensity = 0;
    for (const event of this.shakeEvents) {
      const progress = event.elapsed / event.duration;
      totalIntensity += event.intensity * (1 - progress);
    }
    return totalIntensity;
  }

  /**
   * Check if camera is currently shaking significantly
   */
  isSignificantlyShaking(threshold: number = 2): boolean {
    return this.getShakeIntensity() > threshold;
  }
}