/**
 * RenderSystem - Canvas-based rendering engine for Card Drive & Drift
 * Handles all visual output including vehicles, tracks, particles, UI, and effects
 */
export class RenderSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.width = canvas.width;
    this.height = canvas.height;
    
    // Set up canvas scaling
    this.setupCanvas();
  }

  private setupCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public getWidth(): number {
    return this.width;
  }

  public getHeight(): number {
    return this.height;
  }

  /**
   * Clear the entire canvas
   */
  public clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Draw background with parallax effect
   */
  public drawBackground(offsetX: number, offsetY: number): void {
    // Sky gradient
    const skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    skyGradient.addColorStop(0, '#0f0f1a');
    skyGradient.addColorStop(0.5, '#1a1a3e');
    skyGradient.addColorStop(1, '#2a2a5e');
    
    this.ctx.fillStyle = skyGradient;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Parallax stars
    this.drawStars(offsetX * 0.1);

    // Distant mountains
    this.drawMountains(offsetX * 0.3, offsetY * 0.2);

    // City skyline
    this.drawCityscape(offsetX * 0.5);
  }

  private drawStars(partialOffset: number): void {
    this.ctx.fillStyle = '#ffffff';
    const starCount = 100;
    
    for (let i = 0; i < starCount; i++) {
      const x = ((i * 791 + partialOffset * 100) % this.width);
      const y = (i * 37) % (this.height * 0.4);
      const size = (i % 3) + 1;
      
      this.ctx.globalAlpha = 0.3 + (i % 5) * 0.1;
      this.ctx.beginPath();
      this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
  }

  private drawMountains(hOffset: number, vOffset: number): void {
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.beginPath();
    
    const peakCount = 8;
    let x = -hOffset % this.width;
    
    for (let i = 0; i <= peakCount; i++) {
      const peakHeight = 100 + (i % 3) * 40;
      this.ctx.lineTo(x, this.height * 0.6 - vOffset);
      this.ctx.lineTo(x + 100, this.height * 0.6 - vOffset - peakHeight);
      x += 150;
    }
    
    this.ctx.lineTo(this.width, this.height);
    this.ctx.lineTo(0, this.height);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawCityscape(hOffset: number): void {
    this.ctx.fillStyle = '#0a0a1a';
    const buildingWidth = 60;
    const offset = hOffset % (buildingWidth * 10);
    
    for (let x = -offset; x < this.width; x += buildingWidth) {
      const height = 50 + (x % 150) % 80;
      this.ctx.fillRect(x, this.height * 0.65, buildingWidth - 2, height);
      
      // Windows
      this.ctx.fillStyle = '#1a1a3e';
      for (let wy = this.height * 0.68; wy < this.height * 0.65 + height; wy += 10) {
        for (let wx = x + 5; wx < x + buildingWidth - 5; wx += 15) {
          if ((wx + wy) % 2 === 0) {
            this.ctx.fillRect(wx, wy, 5, 8);
          }
        }
      }
      this.ctx.fillStyle = '#0a0a1a';
    }
  }

  /**
   * Draw the race track with segments
   */
  public drawTrack(segments: any[], cameraOffsetX: number, cameraY: number): void {
    const segmentWidth = 200;
    const visibleSegments = Math.ceil((this.width + 200) / segmentWidth);
    
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const screenX = seg.x - cameraOffsetX + 100;
      const screenY = seg.y - cameraY;
      
      // Skip if off screen
      if (screenX < -segmentWidth || screenX > this.width) continue;
      
      // Draw road surface
      const roadGradient = this.ctx.createLinearGradient(screenX, screenY, screenX, screenY + seg.height);
      roadGradient.addColorStop(0, '#3a3a4a');
      roadGradient.addColorStop(0.5, '#2a2a3a');
      roadGradient.addColorStop(1, '#1a1a2a');
      
      this.ctx.fillStyle = roadGradient;
      this.ctx.fillRect(screenX, screenY, seg.width, seg.height);
      
      // Road edges
      this.ctx.strokeStyle = '#ffcc00';
      this.ctx.lineWidth = 4;
      this.ctx.strokeRect(screenX, screenY, seg.width, seg.height);
      
      // Center line
      if (seg.type === 'straight' || seg.type === 'curve') {
        this.ctx.setLineDash([20, 20]);
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(screenX + seg.width / 2, screenY);
        this.ctx.lineTo(screenX + seg.width / 2, screenY + seg.height);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
      
      // Obstacles on track
      if (seg.obstacle) {
        this.drawObstacle(screenX + seg.width / 2, screenY + seg.height / 2, seg.obstacle);
      }
      
      // Coins/pickups
      if (seg.coins && seg.coins.length > 0) {
        seg.coins.forEach((coin: any, idx: number) => {
          const coinScreenX = screenX + coin.x;
          const coinScreenY = screenY + coin.y;
          this.drawCoin(coinScreenX, coinScreenY, coin.size, coin.collected);
        });
      }
    }
  }

  private drawObstacle(x: number, y: number, obstacleType: string): void {
    switch (obstacleType) {
      case 'barrier':
        this.ctx.fillStyle = '#ff4444';
        this.ctx.fillRect(x - 20, y - 10, 40, 20);
        // Stripes
        this.ctx.fillStyle = '#ffffff';
        for (let i = -20; i < 20; i += 10) {
          this.ctx.fillRect(x + i, y - 10, 5, 20);
        }
        break;
      case 'rock':
        this.ctx.fillStyle = '#6b6b6b';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 15, 0, Math.PI * 2);
        this.ctx.fill();
        break;
      case 'spike':
        this.ctx.fillStyle = '#4a4a6a';
        this.ctx.beginPath();
        this.ctx.moveTo(x - 10, y + 10);
        this.ctx.lineTo(x, y - 10);
        this.ctx.lineTo(x + 10, y + 10);
        this.ctx.closePath();
        this.ctx.fill();
        break;
    }
  }

  private drawCoin(x: number, y: number, size: number, collected: boolean): void {
    if (collected) return;
    
    const pulse = Math.sin(Date.now() / 200) * 2;
    
    this.ctx.save();
    this.ctx.translate(x, y);
    
    // Coin glow
    const glowGradient = this.ctx.createRadialGradient(0, 0, 5, 0, 0, 20 + pulse);
    glowGradient.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
    glowGradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    this.ctx.fillStyle = glowGradient;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 20 + pulse, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Coin body
    const coinGradient = this.ctx.createRadialGradient(-size/3, -size/3, 0, 0, 0, size);
    coinGradient.addColorStop(0, '#fff8dc');
    coinGradient.addColorStop(0.5, '#ffd700');
    coinGradient.addColorStop(1, '#b8860b');
    
    this.ctx.fillStyle = coinGradient;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, size + pulse/2, size, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Dollar sign
    this.ctx.fillStyle = '#8b6914';
    this.ctx.font = `bold ${size}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('$', 0, 0);
    
    this.ctx.restore();
  }

  /**
   * Draw player vehicle with procedural art
   */
  public drawVehicle(vehicle: any, cameraOffsetX: number, cameraY: number): void {
    const screenX = vehicle.x - cameraOffsetX;
    const screenY = vehicle.y - cameraY;
    
    // Skip if off screen
    if (screenX < -100 || screenX > this.width + 100) return;
    
    this.ctx.save();
    this.ctx.translate(screenX, screenY);
    
    // Apply rotation based on drift
    const rotation = vehicle.driftAngle * 0.1;
    this.ctx.rotate(rotation);
    
    // Shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.beginPath();
    this.ctx.ellipse(5, 10, 30, 10, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Car body - card-inspired design
    const carColor = vehicle.color || '#4a90d9';
    const carGradient = this.ctx.createLinearGradient(-30, -20, 30, 20);
    carGradient.addColorStop(0, carColor);
    carGradient.addColorStop(1, this.darkenColor(carColor, 30));
    
    this.ctx.fillStyle = carGradient;
    
    // Main chassis
    this.ctx.beginPath();
    this.ctx.roundRect(-35, -15, 70, 30, 8);
    this.ctx.fill();
    
    // Card deck on top
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.roundRect(-20, -25, 40, 15, 3);
    this.ctx.fill();
    
    // Card details
    this.ctx.fillStyle = carColor;
    this.ctx.fillRect(-15, -22, 30, 10);
    
    // Card symbols
    this.ctx.fillStyle = '#ff4444';
    this.ctx.beginPath();
    this.ctx.arc(-8, -18, 3, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.fillStyle = '#4444ff';
    this.ctx.beginPath();
    this.ctx.arc(8, -18, 3, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Wheels
    const wheelColor = '#2a2a3a';
    const rimColor = '#c0c0c0';
    
    [-20, 20].forEach(wheelX => {
      // Wheel base
      this.ctx.fillStyle = wheelColor;
      this.ctx.beginPath();
      this.ctx.arc(wheelX, 10, 8, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Rim
      this.ctx.fillStyle = rimColor;
      this.ctx.beginPath();
      this.ctx.arc(wheelX, 10, 5, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Spokes
      this.ctx.strokeStyle = '#6a6a7a';
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const angle = Date.now() / 50 + i * Math.PI / 2;
        this.ctx.beginPath();
        this.ctx.moveTo(wheelX + Math.cos(angle) * 5, 10 + Math.sin(angle) * 5);
        this.ctx.lineTo(wheelX + Math.cos(angle) * 8, 10 + Math.sin(angle) * 8);
        this.ctx.stroke();
      }
    });
    
    // Driver
    this.ctx.fillStyle = '#ffccaa';
    this.ctx.beginPath();
    this.ctx.arc(0, -10, 6, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Helmet
    this.ctx.fillStyle = vehicle.helmetColor || '#ff4444';
    this.ctx.beginPath();
    this.ctx.arc(0, -14, 7, Math.PI, 0);
    this.ctx.fill();
    
    // Windshield
    this.ctx.fillStyle = '#87ceeb';
    this.ctx.beginPath();
    this.ctx.ellipse(5, -8, 8, 5, -0.2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Speed lines when fast
    if (vehicle.speed > 10) {
      this.drawSpeedLines(screenX, screenY, vehicle.speed);
    }
    
    // Drift smoke
    if (vehicle.isDrifting) {
      this.drawDriftSmoke(screenX, screenY);
    }
    
    this.ctx.restore();
  }

  private drawSpeedLines(x: number, y: number, speed: number): void {
    const numLines = Math.min(Math.floor(speed / 3), 5);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.lineWidth = 2;
    
    for (let i = 0; i < numLines; i++) {
      const lineX = x - 80 - i * 20;
      const lineY = y + (i % 2) * 15 - 10;
      
      this.ctx.beginPath();
      this.ctx.moveTo(lineX, lineY);
      this.ctx.lineTo(lineX - 30, lineY);
      this.ctx.stroke();
    }
  }

  private drawDriftSmoke(x: number, y: number): void {
    // This would integrate with particle system
    // For now, simple visual indication
    this.ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
    this.ctx.beginPath();
    this.ctx.arc(x - 30, y + 10, 15, 0, Math.PI * 2);
    this.ctx.arc(x - 40, y + 8, 12, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private darkenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = ((num >> 8) & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    
    return '#' + (
      0x1000000 +
      (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1);
  }

  /**
   * Draw particles from particle array
   */
  public drawParticles(particles: any[]): void {
    particles.forEach(particle => {
      const screenX = particle.x;
      const screenY = particle.y;
      
      if (particle.type === 'smoke') {
        this.ctx.fillStyle = `rgba(100, 100, 100, ${particle.alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, particle.size, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (particle.type === 'spark') {
        this.ctx.fillStyle = `rgba(255, 215, 0, ${particle.alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, particle.size, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (particle.type === 'dust') {
        this.ctx.fillStyle = `rgba(150, 130, 100, ${particle.alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, particle.size, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });
  }

  /**
   * Draw UI elements - score, speed, controls hint
   */
  public drawUI(score: number, speed: number, maxSpeed: number, 
                gameState: string, controlsHint?: boolean): void {
    // Score display
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Score: ${Math.floor(score)}`, 20, 40);
    
    // Speedometer
    const speedPercent = Math.min(speed / maxSpeed, 1);
    const speedBarWidth = 200;
    const speedBarHeight = 20;
    
    this.ctx.fillStyle = '#3a3a4a';
    this.ctx.fillRect(this.width - 220, 20, speedBarWidth, speedBarHeight);
    
    const speedFillWidth = speedBarWidth * speedPercent;
    const speedGradient = this.ctx.createLinearGradient(this.width - 220, 20, this.width - 20, 20);
    speedGradient.addColorStop(0, '#4a90d9');
    speedGradient.addColorStop(0.5, '#4ad990');
    speedGradient.addColorStop(1, '#d94a4a');
    
    this.ctx.fillStyle = speedGradient;
    this.ctx.fillRect(this.width - 220, 20, speedFillWidth, speedBarHeight);
    
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(this.width - 220, 20, speedBarWidth, speedBarHeight);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`${Math.floor(speed)} km/h`, this.width - 210, 36);
    
    // Game state overlays
    if (gameState === 'menu') {
      this.drawMenuOverlay();
    } else if (gameState === 'gameover') {
      this.drawGameOverOverlay();
    }
    
    // Controls hint (bottom right)
    if (controlsHint && gameState === 'playing') {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      this.ctx.font = '14px Arial';
      this.ctx.textAlign = 'right';
      this.ctx.fillText('WASD/Arrows: Drive | Space: Brake', this.width - 20, this.height - 20);
    }
  }

  private drawMenuOverlay(): void {
    // Semi-transparent overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Title
    this.ctx.fillStyle = '#ffd700';
    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.shadowColor = '#ff8800';
    this.ctx.shadowBlur = 20;
    this.ctx.fillText('CARD DRIVE & DRIFT', this.width / 2, this.height / 3);
    this.ctx.shadowBlur = 0;
    
    // Subtitle
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '24px Arial';
    this.ctx.fillText('Advanced Physics Racing', this.width / 2, this.height / 3 + 50);
    
    // Instructions
    this.ctx.font = '18px Arial';
    this.ctx.fillStyle = '#cccccc';
    
    const instructions = [
      'Arrow Keys / WASD to drive',
      'Space to brake',
      'Collect coins for points',
      'Avoid obstacles!',
      'Drift for style bonuses'
    ];
    
    instructions.forEach((text, i) => {
      this.ctx.fillText(text, this.width / 2, this.height / 2 + 50 + i * 30);
    });
    
    // Start button
    this.ctx.fillStyle = '#4a90d9';
    this.ctx.fillRect(this.width / 2 - 100, this.height / 2 + 120, 200, 50);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 20px Arial';
    this.ctx.fillText('START GAME', this.width / 2, this.height / 2 + 150);
  }

  private drawGameOverOverlay(): void {
    // Semi-transparent overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Game Over text
    this.ctx.fillStyle = '#ff4444';
    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GAME OVER', this.width / 2, this.height / 3);
    
    // Final score
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '24px Arial';
    this.ctx.fillText(`Final Score: ${Math.floor(this.score)}`, this.width / 2, this.height / 2);
    
    // Best score (if implemented later)
    this.ctx.font = '18px Arial';
    this.ctx.fillStyle = '#cccccc';
    this.ctx.fillText('Press R to Restart', this.width / 2, this.height / 2 + 50);
  }

  /**
   * Screen shake effect for impacts
   */
  public applyShake(magnitude: number): void {
    const offsetX = (Math.random() - 0.5) * magnitude;
    const offsetY = (Math.random() - 0.5) * magnitude;
    this.ctx.translate(offsetX, offsetY);
  }

  public resetTransform(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /**
   * Flash effect for damage/death
   */
  public flashScreen(duration: number = 200): void {
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.backgroundColor = 'white';
    flash.style.opacity = '0.8';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '9999';
    
    document.body.appendChild(flash);
    
    setTimeout(() => {
      flash.remove();
    }, duration);
  }

  /**
   * Update canvas size on resize
   */
  public onResize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * (window.devicePixelRatio || 1);
    this.canvas.height = rect.height * (window.devicePixelRatio || 1);
    this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    this.width = rect.width;
    this.height = rect.height;
  }
}