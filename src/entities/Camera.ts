/**
 * Camera - Follows player with smooth movement, shake effects, and zoom
 */
export class Camera {
  private x: number = 0;
  private y: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;
  private shakeTimer: number = 0;
  private zoom: number = 1;
  private targetZoom: number = 1;
  private lerpSpeed: number = 0.1;
  private width: number = 0;
  private height: number = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Update camera position based on player position
   */
  update(playerX: number, playerY: number, deltaTime: number): void {
    // Smooth follow
    this.targetX = playerX - this.width / 2;
    this.targetY = playerY - this.height / 2;

    // Apply lerp for smooth movement
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    this.x += dx * this.lerpSpeed;
    this.y += dy * this.lerpSpeed;

    // Zoom smoothing
    this.zoom += (this.targetZoom - this.zoom) * this.lerpSpeed;

    // Shake effect
    if (this.shakeDuration > 0) {
      this.shakeTimer -= deltaTime;
      if (this.shakeTimer <= 0) {
        this.shakeDuration = 0;
        this.shakeIntensity = 0;
      } else {
        const randomX = (Math.random() - 0.5) * this.shakeIntensity;
        const randomY = (Math.random() - 0.5) * this.shakeIntensity;
        this.x += randomX;
        this.y += randomY;
      }
    }
  }

  /**
   * Apply screen shake effect
   */
  applyShake(intensity: number, duration: number): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  /**
   * Set zoom level
   */
  setZoom(zoom: number): void {
    this.targetZoom = Math.max(0.1, Math.min(3, zoom));
  }

  /**
   * Get current camera bounds in world coordinates
   */
  getBounds(): { left: number; right: number; top: number; bottom: number } {
    return {
      left: this.x,
      right: this.x + this.width / this.zoom,
      top: this.y,
      bottom: this.y + this.height / this.zoom
    };
  }

  /**
   * Transform world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: (worldX - this.x) * this.zoom,
      y: (worldY - this.y) * this.zoom
    };
  }

  /**
   * Transform screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: screenX / this.zoom + this.x,
      y: screenY / this.zoom + this.y
    };
  }

  /**
   * Check if entity is within camera view
   */
  isVisible(entityX: number, entityY: number, entityWidth: number, entityHeight: number): boolean {
    const bounds = this.getBounds();
    const entityLeft = entityX - entityWidth / 2;
    const entityRight = entityX + entityWidth / 2;
    const entityTop = entityY - entityHeight / 2;
    const entityBottom = entityY + entityHeight / 2;

    return entityLeft < bounds.right &&
           entityRight > bounds.left &&
           entityTop < bounds.bottom &&
           entityBottom > bounds.top;
  }

  /**
   * Reset camera to default state
   */
  reset(): void {
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.shakeTimer = 0;
    this.targetZoom = 1;
    this.zoom = 1;
  }

  /**
   * Get current camera transform matrix values for rendering
   */
  getTransform(): { offsetX: number; offsetY: number; scale: number } {
    return {
      offsetX: -this.x,
      offsetY: -this.y,
      scale: this.zoom
    };
  }
}
