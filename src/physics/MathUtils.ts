/**
 * Vector2 - 2D vector operations for physics calculations
 */
export class Vector2 {
  x: number;
  y: number;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  add(v: Vector2): Vector2 {
    return new Vector2(this.x + v.x, this.y + v.y);
  }

  sub(v: Vector2): Vector2 {
    return new Vector2(this.x - v.x, this.y - v.y);
  }

  mul(scalar: number): Vector2 {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  div(scalar: number): Vector2 {
    if (scalar === 0) return new Vector2(0, 0);
    return new Vector2(this.x / scalar, this.y / scalar);
  }

  mag(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): Vector2 {
    const m = this.mag();
    if (m === 0) return new Vector2(0, 0);
    return this.div(m);
  }

  dot(v: Vector2): number {
    return this.x * v.x + this.y * v.y;
  }

  cross(v: Vector2): number {
    return this.x * v.y - this.y * v.x;
  }

  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  rotate(angle: number): Vector2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector2(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }

  static zero(): Vector2 {
    return new Vector2(0, 0);
  }

  static fromAngle(angle: number, length = 1): Vector2 {
    return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length);
  }
}

/**
 * AABB - Axis-Aligned Bounding Box for collision detection
 */
export class AABB {
  min: Vector2;
  max: Vector2;

  constructor(minX: number, minY: number, width: number, height: number) {
    this.min = new Vector2(minX, minY);
    this.max = new Vector2(minX + width, minY + height);
  }

  clone(): AABB {
    return new AABB(this.min.x, this.min.y, this.max.x - this.min.x, this.max.y - this.min.y);
  }

  containsPoint(point: Vector2): boolean {
    return point.x >= this.min.x && point.x <= this.max.x &&
           point.y >= this.min.y && point.y <= this.max.y;
  }

  intersects(other: AABB): boolean {
    return this.min.x <= other.max.x && this.max.x >= other.min.x &&
           this.min.y <= other.max.y && this.max.y >= other.min.y;
  }

  center(): Vector2 {
    return new Vector2((this.min.x + this.max.x) / 2, (this.min.y + this.max.y) / 2);
  }

  width(): number {
    return this.max.x - this.min.x;
  }

  height(): number {
    return this.max.y - this.min.y;
  }
}

/**
 * Matrix2 - 2D transformation matrix
 */
export class Matrix2 {
  data: number[];

  constructor() {
    this.data = [1, 0, 0, 1, 0, 0]; // Identity matrix
  }

  static translate(tx: number, ty: number): Matrix2 {
    const m = new Matrix2();
    m.data[4] = tx;
    m.data[5] = ty;
    return m;
  }

  static rotate(angle: number): Matrix2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const m = new Matrix2();
    m.data[0] = cos;
    m.data[1] = -sin;
    m.data[2] = sin;
    m.data[3] = cos;
    return m;
  }

  static scale(sx: number, sy: number): Matrix2 {
    const m = new Matrix2();
    m.data[0] = sx;
    m.data[3] = sy;
    return m;
  }

  transformPoint(p: Vector2): Vector2 {
    return new Vector2(
      p.x * this.data[0] + p.y * this.data[2] + this.data[4],
      p.x * this.data[1] + p.y * this.data[3] + this.data[5]
    );
  }

  combine(other: Matrix2): Matrix2 {
    const result = new Matrix2();
    const a = this.data;
    const b = other.data;
    result.data[0] = a[0] * b[0] + a[2] * b[1];
    result.data[1] = a[1] * b[0] + a[3] * b[1];
    result.data[2] = a[0] * b[2] + a[2] * b[3];
    result.data[3] = a[1] * b[2] + a[3] * b[3];
    result.data[4] = a[0] * b[4] + a[2] * b[5] + a[4];
    result.data[5] = a[1] * b[4] + a[3] * b[5] + a[5];
    return result;
  }
}

/**
 * Interpolation utilities
 */
export namespace Lerp {
  export function linear(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  export function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }

  export function easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  export function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}

/**
 * Random utilities
 */
export namespace Random {
  export function float(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  export function int(min: number, max: number): number {
    return Math.floor(float(min, max + 1));
  }

  export function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  export function chance(percent: number): boolean {
    return Math.random() * 100 < percent;
  }
}

/**
 * Clamp utility
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Map utility
 */
export function map(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Angle utilities
 */
export namespace Angle {
  export function normalize(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  export function shortestPath(from: number, to: number): number {
    const diff = Angle.normalize(to - from);
    return diff;
  }

  export function distance(from: number, to: number): number {
    return Math.abs(Angle.shortestPath(from, to));
  }
}

/**
 * Collision response utilities
 */
export namespace Collision {
  export function resolveAABBOverlap(aabb1: AABB, aabb2: AABB): Vector2 {
    const dx = (aabb1.center().x + aabb2.center().x) / 2 - aabb1.center().x;
    const dy = (aabb1.center().y + aabb2.center().y) / 2 - aabb1.center().y;
    
    const overlapX = (aabb1.width() + aabb2.width()) / 2 - Math.abs(aabb1.center().x - aabb2.center().x);
    const overlapY = (aabb1.height() + aabb2.height()) / 2 - Math.abs(aabb1.center().y - aabb2.center().y);
    
    if (overlapX < overlapY) {
      return new Vector2(dx > 0 ? overlapX : -overlapX, 0);
    } else {
      return new Vector2(0, dy > 0 ? overlapY : -overlapY);
    }
  }
}