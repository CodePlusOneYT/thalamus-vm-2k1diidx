import { Vector2 } from '../physics/MathUtils';

export type ParticleType = 
  | 'smoke'        // Drift smoke trails
  | 'spark'        // Collision sparks
  | 'dust'         // Tire dust
  | 'coin'         // Collectible coin sparkle
  | 'damage'       // Hit/damage effect
  | 'boost'        // Speed boost trail
  | 'nitro'        // Nitrous explosion
  | 'explosion'    // Large explosion burst
  | 'bubble'       // Power-up bubble
  | 'text';        // Floating damage/score text

export interface ParticleConfig {
  type: ParticleType;
  position: Vector2;
  velocity: Vector2;
  lifetime: number;           // Total lifetime in seconds
  color: string;              // Hex color (e.g., "#FF5733")
  size: number;               // Initial size
  sizeVariation: number;      // ± variation on spawn
  gravity: number;            // Gravity applied per second
  friction: number;           // Velocity damping (0-1)
  rotationSpeed: number;      // Radians per second
  alpha: number;              // Initial opacity (0-1)
  alphaVariation: number;     // ± variation on spawn
  maxAlpha: number;           // Maximum alpha during animation
  minAlpha: number;           // Minimum alpha before death
  scaleOverTime: boolean;     // Whether size changes over lifetime
  scaleCurve: 'ease-in' | 'ease-out' | 'linear' | 'bounce';
  fadeCurve: 'ease-in' | 'ease-out' | 'linear';
  isStatic?: boolean;         // For UI particles like floating text
  text?: string;              // Text content for 'text' type particles
  textSize?: number;          // Font size for text particles
  maxParticles: number;       // Max particles of this type in system
}

export class Particle {
  private static instance: ParticleSystem;
  
  public static getSystem(): ParticleSystem {
    if (!ParticleSystem.instance) {
      ParticleSystem.instance = new ParticleSystem();
    }
    return ParticleSystem.instance;
  }

  public static reset() {
    ParticleSystem.instance = null;
  }

  // Current state
  public position: Vector2;
  public velocity: Vector2;
  public acceleration: Vector2;
  public rotation: number;
  public angularVelocity: number;
  
  // Animation properties
  public age: number = 0;
  public lifetime: number;
  public size: number;
  public targetSize: number;
  public alpha: number;
  public targetAlpha: number;
  
  // Type-specific data
  public readonly type: ParticleType;
  public readonly color: string;
  public readonly isStatic: boolean;
  public readonly text?: string;
  public readonly textSize: number;
  
  // Performance flags
  public active: boolean = true;
  public canCollide: boolean = false;
  public zIndex: number = 0;
  
  // Emitter reference (for parent-relative particles)
  public emitter?: Particle;
  
  constructor(config: ParticleConfig) {
    this.type = config.type;
    this.position = config.position.clone();
    this.velocity = config.velocity.clone();
    this.acceleration = new Vector2(0, 0);
    this.rotation = Math.random() * Math.PI * 2;
    this.angularVelocity = config.rotationSpeed;
    
    this.lifetime = config.lifetime;
    this.age = 0;
    
    // Size with variation
    const sizeVar = config.sizeVariation * (Math.random() * 2 - 1);
    this.size = config.size + sizeVar;
    this.targetSize = this.size;
    
    // Alpha with variation
    const alphaVar = config.alphaVariation * (Math.random() * 2 - 1);
    this.alpha = Math.min(1, Math.max(0, config.alpha + alphaVar));
    this.targetAlpha = this.alpha;
    
    this.color = config.color;
    this.isStatic = config.isStatic ?? false;
    this.text = config.text;
    this.textSize = config.textSize ?? 24;
    
    // Store curve types for interpolation
    this.scaleCurve = config.scaleCurve;
    this.fadeCurve = config.fadeCurve;
    
    // Set initial target values based on curve
    if (config.scaleOverTime) {
      switch (config.scaleCurve) {
        case 'ease-in':
          this.targetSize = this.size * 0.5;
          break;
        case 'ease-out':
          this.targetSize = this.size * 2;
          break;
        case 'bounce':
          this.targetSize = this.size * (1 + Math.random());
          break;
        default:
          this.targetSize = this.size * 0.8;
      }
    } else {
      this.targetSize = this.size;
    }
    
    if (config.fadeCurve === 'ease-out') {
      this.targetAlpha = 0;
    } else if (config.fadeCurve === 'ease-in') {
      this.targetAlpha = config.minAlpha;
    } else {
      this.targetAlpha = config.minAlpha;
    }
    
    // Calculate death threshold
    this.deathThreshold = this.age + config.lifetime;
  }
  
  private deathThreshold: number;
  private scaleCurve: 'ease-in' | 'ease-out' | 'linear' | 'bounce';
  private fadeCurve: 'ease-in' | 'ease-out' | 'linear';
  
  // Update physics and animation
  public update(dt: number): void {
    if (!this.active || this.isStatic) return;
    
    this.age += dt;
    
    // Check if particle is dead
    if (this.age >= this.deathThreshold) {
      this.active = false;
      return;
    }
    
    // Apply gravity
    this.velocity.y += config.gravity * dt;
    
    // Apply friction/damping
    this.velocity.x *= Math.pow(this.friction, dt);
    this.velocity.y *= Math.pow(this.friction, dt);
    
    // Update position
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    
    // Update rotation
    this.rotation += this.angularVelocity * dt;
    
    // Interpolate size over time
    const progress = this.getProgress();
    this.size = this.lerp(this.size, this.targetSize, this.getScaleFactor(progress));
    
    // Interpolate alpha over time
    this.alpha = this.lerp(this.alpha, this.targetAlpha, this.getFadeFactor(progress));
  }
  
  // Get normalized progress (0-1) through lifetime
  private getProgress(): number {
    return Math.min(1, this.age / this.lifetime);
  }
  
  // Scale factor based on curve
  private getScaleFactor(progress: number): number {
    switch (this.scaleCurve) {
      case 'ease-in':
        return progress * progress;
      case 'ease-out':
        return 1 - Math.pow(1 - progress, 2);
      case 'bounce':
        return this.bounce(progress);
      default:
        return progress;
    }
  }
  
  // Fade factor based on curve
  private getFadeFactor(progress: number): number {
    switch (this.fadeCurve) {
      case 'ease-in':
        return Math.pow(progress, 3);
      case 'ease-out':
        return 1 - Math.pow(1 - progress, 3);
      default:
        return progress;
    }
  }
  
  // Bounce easing function
  private bounce(t: number): number {
    const n1 = 7.5625;
    const d1 = 2.75;
    
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  }
  
  // Linear interpolation
  private lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }
  
  // Draw the particle
  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    
    if (this.isStatic) {
      // Static particles don't move, use absolute position
    } else {
      ctx.translate(this.position.x, this.position.y);
      ctx.rotate(this.rotation);
    }
    
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    
    if (this.type === 'text' && this.text) {
      // Text particle
      ctx.font = `${this.textSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Add shadow for readability
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      ctx.fillText(this.text, 0, 0);
    } else {
      // Shape-based particle
      ctx.beginPath();
      
      switch (this.type) {
        case 'smoke':
        case 'dust':
          // Soft circular puff
          ctx.arc(0, 0, this.size, 0, Math.PI * 2);
          break;
          
        case 'spark':
        case 'explosion':
          // Star shape
          this.drawStar(ctx, 0, 0, 5, this.size, this.size * 0.5);
          break;
          
        case 'coin':
          // Diamond shape
          ctx.moveTo(0, -this.size);
          ctx.lineTo(this.size * 0.7, 0);
          ctx.lineTo(0, this.size);
          ctx.lineTo(-this.size * 0.7, 0);
          ctx.closePath();
          break;
          
        case 'damage':
          // X shape
          ctx.moveTo(-this.size, -this.size);
          ctx.lineTo(this.size, this.size);
          ctx.moveTo(this.size, -this.size);
          ctx.lineTo(-this.size, this.size);
          ctx.lineWidth = 3;
          ctx.strokeStyle = this.color;
          ctx.stroke();
          break;
          
        case 'boost':
        case 'nitro':
          // Oval/trail shape
          ctx.ellipse(0, 0, this.size * 2, this.size, 0, 0, Math.PI * 2);
          break;
          
        case 'bubble':
          // Circle with highlight
          ctx.arc(0, 0, this.size, 0, Math.PI * 2);
          ctx.fill();
          
          // Highlight
          ctx.globalAlpha = this.alpha * 0.6;
          ctx.beginPath();
          ctx.arc(-this.size * 0.3, -this.size * 0.3, this.size * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          break;
          
        default:
          // Default circle
          ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      }
      
      ctx.fill();
    }
    
    ctx.restore();
  }
  
  // Draw a star shape
  private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number): void {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;
    
    ctx.moveTo(cx, cy - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;
      
      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  }
  
  // Clone this particle for spawning
  public clone(offset: Vector2 = new Vector2(0, 0)): Particle {
    const config: ParticleConfig = {
      type: this.type,
      position: this.position.clone(),
      velocity: this.velocity.clone(),
      lifetime: this.lifetime,
      color: this.color,
      size: this.size,
      sizeVariation: 0,
      gravity: 0,
      friction: 1,
      rotationSpeed: this.angularVelocity,
      alpha: this.alpha,
      alphaVariation: 0,
      maxAlpha: 1,
      minAlpha: 0,
      scaleOverTime: false,
      scaleCurve: this.scaleCurve,
      fadeCurve: this.fadeCurve,
      isStatic: this.isStatic,
      text: this.text,
      textSize: this.textSize,
      maxParticles: 0
    };
    
    const cloned = new Particle(config);
    cloned.position.add(offset);
    cloned.active = true;
    cloned.age = 0;
    
    return cloned;
  }
}

// Particle System Manager
export class ParticleSystem {
  private particles: Particle[] = [];
  private pools: Map<ParticleType, Particle[]> = new Map();
  private maxPoolSize = 1000;
  
  constructor() {
    this.initializePools();
  }
  
  private initializePools(): void {
    const types: ParticleType[] = [
      'smoke', 'spark', 'dust', 'coin', 'damage', 
      'boost', 'nitro', 'explosion', 'bubble', 'text'
    ];
    
    types.forEach(type => {
      this.pools.set(type, []);
    });
  }
  
  // Spawn a single particle
  public spawn(config: Omit<ParticleConfig, 'maxParticles'>): Particle {
    // Try to reuse from pool
    const pool = this.pools.get(config.type);
    let particle: Particle;
    
    if (pool && pool.length > 0) {
      particle = pool.pop()!;
      particle.active = true;
      particle.age = 0;
      
      // Reset properties
      particle.position = config.position.clone();
      particle.velocity = config.velocity.clone();
      particle.lifetime = config.lifetime;
      particle.size = config.size;
      particle.targetSize = config.size;
      particle.alpha = config.alpha;
      particle.targetAlpha = config.alpha;
      particle.color = config.color;
      particle.type = config.type;
      particle.isStatic = config.isStatic ?? false;
      particle.text = config.text;
      particle.textSize = config.textSize ?? 24;
      particle.scaleCurve = config.scaleCurve;
      particle.fadeCurve = config.fadeCurve;
      particle.deathThreshold = particle.age + config.lifetime;
    } else {
      particle = new Particle({ ...config, maxParticles: this.maxPoolSize });
    }
    
    this.particles.push(particle);
    return particle;
  }
  
  // Spawn multiple particles (burst)
  public spawnBurst(
    config: Omit<ParticleConfig, 'maxParticles'>,
    count: number,
    spreadAngle: number = Math.PI * 2
  ): Particle[] {
    const spawned: Particle[] = [];
    
    for (let i = 0; i < count; i++) {
      const angle = (spreadAngle / count) * i;
      const speed = config.velocity.magnitude * (0.5 + Math.random() * 0.5);
      
      const burstConfig = {
        ...config,
        velocity: new Vector2(
          Math.cos(angle) * speed,
          Math.sin(angle) * speed
        )
      };
      
      spawned.push(this.spawn(burstConfig));
    }
    
    return spawned;
  }
  
  // Spawn particles at an emitter point
  public spawnFromEmitter(
    emitterPos: Vector2,
    config: Omit<ParticleConfig, 'maxParticles'>,
    count: number = 1
  ): Particle[] {
    const spawned: Particle[] = [];
    
    for (let i = 0; i < count; i++) {
      const particle = this.spawn({
        ...config,
        position: emitterPos.clone()
      });
      particle.emitter = undefined;
      spawned.push(particle);
    }
    
    return spawned;
  }
  
  // Update all active particles
  public update(dt: number): void {
    // Update each particle
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.update(dt);
      
      // Recycle inactive particles
      if (!particle.active) {
        this.recycle(particle);
        this.particles.splice(i, 1);
      }
    }
  }
  
  // Draw all active particles
  public draw(ctx: CanvasRenderingContext2D): void {
    // Sort by z-index for proper layering
    const sorted = [...this.particles].sort((a, b) => a.zIndex - b.zIndex);
    
    for (const particle of sorted) {
      if (particle.active) {
        particle.draw(ctx);
      }
    }
  }
  
  // Recycle particle back to pool
  private recycle(particle: Particle): void {
    particle.active = false;
    
    const pool = this.pools.get(particle.type);
    if (pool && pool.length < this.maxPoolSize) {
      pool.push(particle);
    }
  }
  
  // Clear all particles
  public clear(): void {
    this.particles.forEach(p => this.recycle(p));
    this.particles = [];
  }
  
  // Get particle count
  public get count(): number {
    return this.particles.filter(p => p.active).length;
  }
  
  // Get stats
  public getStats(): Record<ParticleType, number> {
    const stats: Record<ParticleType, number> = {
      smoke: 0, spark: 0, dust: 0, coin: 0, damage: 0,
      boost: 0, nitro: 0, explosion: 0, bubble: 0, text: 0
    };
    
    this.particles.forEach(p => {
      if (p.active) {
        stats[p.type]++;
      }
    });
    
    return stats;
  }
}

</FILE>
