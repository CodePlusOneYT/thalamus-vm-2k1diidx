import { Vector2 } from './MathUtils';

export interface PhysicsBody {
  id: string;
  position: Vector2;
  velocity: Vector2;
  acceleration: Vector2;
  mass: number;
  inverseMass: number;
  restitution: number;
  friction: number;
  angularVelocity: number;
  torque: number;
  momentOfInertia: number;
  inverseMomentOfInertia: number;
  angle: number;
  isStatic: boolean;
  isKinematic: boolean;
  collisionLayers: number;
  collisionMask: number;
  userData: unknown;
}

export interface CollisionInfo {
  bodyA: PhysicsBody;
  bodyB: PhysicsBody;
  contactPoint: Vector2;
  normal: Vector2;
  penetration: number;
  relativeVelocity: number;
}

export interface RaycastResult {
  hit: boolean;
  body: PhysicsBody | null;
  point: Vector2;
  normal: Vector2;
  distance: number;
  fraction: number;
}

export class PhysicsEngine {
  private bodies: Map<string, PhysicsBody> = new Map();
  private collisionPairs: CollisionInfo[] = [];
  private gravity: Vector2 = { x: 0, y: 0 };
  private subSteps: number = 8;
  private fixedTimeStep: number = 1 / 60;
  private maxSubSteps: number = 10;
  private broadPhaseGrid: Map<string, Set<string>> = new Map();
  private gridCellSize: number = 50;
  private sleepingBodies: Set<string> = new Set();
  private sleepThreshold: number = 0.01;
  private sleepTimeThreshold: number = 0.5;
  private bodySleepTimers: Map<string, number> = new Map();

  constructor(gravity: Vector2 = { x: 0, y: 0 }, subSteps: number = 8) {
    this.gravity = gravity;
    this.subSteps = Math.max(1, Math.min(subSteps, this.maxSubSteps));
  }

  setGravity(gravity: Vector2): void {
    this.gravity = gravity;
  }

  getGravity(): Vector2 {
    return { ...this.gravity };
  }

  setSubSteps(subSteps: number): void {
    this.subSteps = Math.max(1, Math.min(subSteps, this.maxSubSteps));
  }

  setFixedTimeStep(timeStep: number): void {
    this.fixedTimeStep = Math.max(1 / 240, Math.min(timeStep, 1 / 30));
  }

  addBody(body: PhysicsBody): void {
    if (this.bodies.has(body.id)) {
      console.warn(`Physics body with id ${body.id} already exists`);
      return;
    }
    this.bodies.set(body.id, body);
    this.bodySleepTimers.set(body.id, 0);
  }

  removeBody(id: string): boolean {
    this.broadPhaseRemove(id);
    this.sleepingBodies.delete(id);
    this.bodySleepTimers.delete(id);
    return this.bodies.delete(id);
  }

  getBody(id: string): PhysicsBody | undefined {
    return this.bodies.get(id);
  }

  getAllBodies(): PhysicsBody[] {
    return Array.from(this.bodies.values());
  }

  getDynamicBodies(): PhysicsBody[] {
    return Array.from(this.bodies.values()).filter(b => !b.isStatic && !b.isKinematic);
  }

  private broadPhaseInsert(body: PhysicsBody): void {
    const minX = Math.floor((body.position.x - 1) / this.gridCellSize);
    const maxX = Math.floor((body.position.x + 1) / this.gridCellSize);
    const minY = Math.floor((body.position.y - 1) / this.gridCellSize);
    const maxY = Math.floor((body.position.y + 1) / this.gridCellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `${x},${y}`;
        if (!this.broadPhaseGrid.has(key)) {
          this.broadPhaseGrid.set(key, new Set());
        }
        this.broadPhaseGrid.get(key)!.add(body.id);
      }
    }
  }

  private broadPhaseRemove(id: string): void {
    for (const [key, bodies] of this.broadPhaseGrid) {
      bodies.delete(id);
      if (bodies.size === 0) {
        this.broadPhaseGrid.delete(key);
      }
    }
  }

  private broadPhaseUpdate(body: PhysicsBody): void {
    this.broadPhaseRemove(body.id);
    this.broadPhaseInsert(body);
  }

  private getPotentialCollisions(): Array<[PhysicsBody, PhysicsBody]> {
    const pairs: Array<[PhysicsBody, PhysicsBody]> = [];
    const checkedPairs = new Set<string>();

    for (const [, cellBodies] of this.broadPhaseGrid) {
      const bodyArray = Array.from(cellBodies);
      for (let i = 0; i < bodyArray.length; i++) {
        for (let j = i + 1; j < bodyArray.length; j++) {
          const idA = bodyArray[i];
          const idB = bodyArray[j];
          const pairKey = idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;

          if (checkedPairs.has(pairKey)) continue;
          checkedPairs.add(pairKey);

          const bodyA = this.bodies.get(idA);
          const bodyB = this.bodies.get(idB);

          if (!bodyA || !bodyB) continue;
          if (bodyA.isStatic && bodyB.isStatic) continue;
          if ((bodyA.collisionMask & bodyB.collisionLayers) === 0) continue;
          if ((bodyB.collisionMask & bodyA.collisionLayers) === 0) continue;

          const dx = bodyA.position.x - bodyB.position.x;
          const dy = bodyA.position.y - bodyB.position.y;
          const distSq = dx * dx + dy * dy;
          const radiusSum = 2; // Simplified - would use actual collision shapes
          if (distSq > radiusSum * radiusSum) continue;

          pairs.push([bodyA, bodyB]);
        }
      }
    }

    return pairs;
  }

  private narrowPhaseCheck(bodyA: PhysicsBody, bodyB: PhysicsBody): CollisionInfo | null {
    const dx = bodyB.position.x - bodyA.position.x;
    const dy = bodyB.position.y - bodyA.position.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    if (dist === 0) {
      return {
        bodyA,
        bodyB,
        contactPoint: { ...bodyA.position },
        normal: { x: 1, y: 0 },
        penetration: 1,
        relativeVelocity: 0,
      };
    }

    const radiusSum = 1.5; // Simplified collision radius
    const penetration = radiusSum - dist;

    if (penetration <= 0) return null;

    const normal = { x: dx / dist, y: dy / dist };
    const contactPoint = {
      x: bodyA.position.x + normal.x * (radiusSum - penetration / 2),
      y: bodyA.position.y + normal.y * (radiusSum - penetration / 2),
    };

    const relVelX = bodyB.velocity.x - bodyA.velocity.x;
    const relVelY = bodyB.velocity.y - bodyA.velocity.y;
    const relativeVelocity = relVelX * normal.x + relVelY * normal.y;

    return {
      bodyA,
      bodyB,
      contactPoint,
      normal,
      penetration,
      relativeVelocity,
    };
  }

  private resolveCollision(collision: CollisionInfo): void {
    const { bodyA, bodyB, normal, penetration, relativeVelocity, contactPoint } = collision;

    if (relativeVelocity > 0) return; // Bodies separating

    const e = Math.min(bodyA.restitution, bodyB.restitution);
    const friction = Math.sqrt(bodyA.friction * bodyB.friction);

    let j = -(1 + e) * relativeVelocity;
    j /= bodyA.inverseMass + bodyB.inverseMass;

    const impulse = { x: normal.x * j, y: normal.y * j };

    if (!bodyA.isStatic && !bodyA.isKinematic) {
      bodyA.velocity.x -= impulse.x * bodyA.inverseMass;
      bodyA.velocity.y -= impulse.y * bodyA.inverseMass;
    }
    if (!bodyB.isStatic && !bodyB.isKinematic) {
      bodyB.velocity.x += impulse.x * bodyB.inverseMass;
      bodyB.velocity.y += impulse.y * bodyB.inverseMass;
    }

    // Friction impulse
    const tangentX = -normal.y;
    const tangentY = normal.x;
    const relVelTangent = (bodyB.velocity.x - bodyA.velocity.x) * tangentX +
                          (bodyB.velocity.y - bodyA.velocity.y) * tangentY;

    let jt = -relVelTangent;
    jt /= bodyA.inverseMass + bodyB.inverseMass;

    const maxFriction = j * friction;
    jt = Math.max(-maxFriction, Math.min(maxFriction, jt));

    const frictionImpulse = { x: tangentX * jt, y: tangentY * jt };

    if (!bodyA.isStatic && !bodyA.isKinematic) {
      bodyA.velocity.x -= frictionImpulse.x * bodyA.inverseMass;
      bodyA.velocity.y -= frictionImpulse.y * bodyA.inverseMass;
    }
    if (!bodyB.isStatic && !bodyB.isKinematic) {
      bodyB.velocity.x += frictionImpulse.x * bodyB.inverseMass;
      bodyB.velocity.y += frictionImpulse.y * bodyB.inverseMass;
    }

    // Position correction (Baumgarte stabilization)
    const percent = 0.2;
    const slop = 0.01;
    const correction = Math.max(penetration - slop, 0) * percent;
    const totalInverseMass = bodyA.inverseMass + bodyB.inverseMass;

    if (totalInverseMass > 0) {
      const correctionX = normal.x * correction / totalInverseMass;
      const correctionY = normal.y * correction / totalInverseMass;

      if (!bodyA.isStatic && !bodyA.isKinematic) {
        bodyA.position.x -= correctionX * bodyA.inverseMass;
        bodyA.position.y -= correctionY * bodyA.inverseMass;
      }
      if (!bodyB.isStatic && !bodyB.isKinematic) {
        bodyB.position.x += correctionX * bodyB.inverseMass;
        bodyB.position.y += correctionY * bodyB.inverseMass;
      }
    }
  }

  private updateSleepState(body: PhysicsBody, dt: number): void {
    if (body.isStatic || body.isKinematic) return;

    const speedSq = body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y;
    const angularSpeedSq = body.angularVelocity * body.angularVelocity;

    if (speedSq < this.sleepThreshold * this.sleepThreshold &&
        angularSpeedSq < this.sleepThreshold * this.sleepThreshold) {
      const timer = (this.bodySleepTimers.get(body.id) || 0) + dt;
      this.bodySleepTimers.set(body.id, timer);

      if (timer > this.sleepTimeThreshold) {
        this.sleepingBodies.add(body.id);
        body.velocity = { x: 0, y: 0 };
        body.angularVelocity = 0;
      }
    } else {
      this.bodySleepTimers.set(body.id, 0);
      this.sleepingBodies.delete(body.id);
    }
  }

  private wakeBody(body: PhysicsBody): void {
    this.sleepingBodies.delete(body.id);
    this.bodySleepTimers.set(body.id, 0);
  }

  applyForce(body: PhysicsBody, force: Vector2, point?: Vector2): void {
    if (body.isStatic || body.isKinematic) return;
    this.wakeBody(body);
    body.acceleration.x += force.x * body.inverseMass;
    body.acceleration.y += force.y * body.inverseMass;

    if (point) {
      const rx = point.x - body.position.x;
      const ry = point.y - body.position.y;
      const torque = rx * force.y - ry * force.x;
      body.torque += torque * body.inverseMomentOfInertia;
    }
  }

  applyImpulse(body: PhysicsBody, impulse: Vector2, point?: Vector2): void {
    if (body.isStatic || body.isKinematic) return;
    this.wakeBody(body);
    body.velocity.x += impulse.x * body.inverseMass;
    body.velocity.y += impulse.y * body.inverseMass;

    if (point) {
      const rx = point.x - body.position.x;
      const ry = point.y - body.position.y;
      const angularImpulse = rx * impulse.y - ry * impulse.x;
      body.angularVelocity += angularImpulse * body.inverseMomentOfInertia;
    }
  }

  setVelocity(body: PhysicsBody, velocity: Vector2): void {
    if (body.isStatic) return;
    this.wakeBody(body);
    body.velocity = { ...velocity };
  }

  setAngularVelocity(body: PhysicsBody, angularVelocity: number): void {
    if (body.isStatic) return;
    this.wakeBody(body);
    body.angularVelocity = angularVelocity;
  }

  step(dt: number): CollisionInfo[] {
    this.collisionPairs = [];
    const subDt = dt / this.subSteps;

    for (let step = 0; step < this.subSteps; step++) {
      this.integrateForces(subDt);
      this.broadPhaseGrid.clear();

      for (const body of this.bodies.values()) {
        if (!body.isStatic) {
          this.broadPhaseInsert(body);
        }
      }

      const potentialCollisions = this.getPotentialCollisions();

      for (const [bodyA, bodyB] of potentialCollisions) {
        const collision = this.narrowPhaseCheck(bodyA, bodyB);
        if (collision) {
          this.collisionPairs.push(collision);
          this.resolveCollision(collision);
        }
      }

      this.integrateVelocities(subDt);

      for (const body of this.bodies.values()) {
        if (!body.isStatic && !body.isKinematic) {
          this.updateSleepState(body, subDt);
        }
        body.acceleration = { x: 0, y: 0 };
        body.torque = 0;
      }
    }

    return this.collisionPairs;
  }

  private integrateForces(dt: number): void {
    for (const body of this.bodies.values()) {
      if (body.isStatic || body.isKinematic || this.sleepingBodies.has(body.id)) continue;

      body.velocity.x += (body.acceleration.x + this.gravity.x) * dt;
      body.velocity.y += (body.acceleration.y + this.gravity.y) * dt;
      body.angularVelocity += body.torque * dt;
    }
  }

  private integrateVelocities(dt: number): void {
    for (const body of this.bodies.values()) {
      if (body.isStatic || this.sleepingBodies.has(body.id)) continue;

      body.position.x += body.velocity.x * dt;
      body.position.y += body.velocity.y * dt;
      body.angle += body.angularVelocity * dt;

      this.broadPhaseUpdate(body);
    }
  }

  raycast(origin: Vector2, direction: Vector2, maxDistance: number, collisionMask: number = 0xFFFFFFFF): RaycastResult {
    let closestHit: RaycastResult = {
      hit: false,
      body: null,
      point: { x: 0, y: 0 },
      normal: { x: 0, y: 0 },
      distance: maxDistance,
      fraction: 1,
    };

    const dirLen = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (dirLen === 0) return closestHit;

    const dirNorm = { x: direction.x / dirLen, y: direction.y / dirLen };

    for (const body of this.bodies.values()) {
      if ((body.collisionLayers & collisionMask) === 0) continue;

      const dx = body.position.x - origin.x;
      const dy = body.position.y - origin.y;
      const proj = dx * dirNorm.x + dy * dirNorm.y;

      if (proj < 0 || proj > maxDistance) continue;

      const closestX = origin.x + dirNorm.x * proj;
      const closestY = origin.y + dirNorm.y * proj;
      const distToCenter = Math.sqrt((body.position.x - closestX) ** 2 + (body.position.y - closestY) ** 2);

      const radius = 1; // Simplified
      if (distToCenter > radius) continue;

      const hitDist = proj - Math.sqrt(Math.max(0, radius * radius - distToCenter * distToCenter));
      if (hitDist < 0 || hitDist >= closestHit.distance) continue;

      const hitPoint = { x: origin.x + dirNorm.x * hitDist, y: origin.y + dirNorm.y * hitDist };
      const normal = { x: hitPoint.x - body.position.x, y: hitPoint.y - body.position.y };
      const nLen = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
      if (nLen > 0) {
        normal.x /= nLen;
        normal.y /= nLen;
      }

      closestHit = {
        hit: true,
        body,
        point: hitPoint,
        normal,
        distance: hitDist,
        fraction: hitDist / maxDistance,
      };
    }

    return closestHit;
  }

  queryAABB(min: Vector2, max: Vector2, collisionMask: number = 0xFFFFFFFF): PhysicsBody[] {
    const results: PhysicsBody[] = [];
    const minX = Math.floor(min.x / this.gridCellSize);
    const maxX = Math.floor(max.x / this.gridCellSize);
    const minY = Math.floor(min.y / this.gridCellSize);
    const maxY = Math.floor(max.y / this.gridCellSize);

    const checked = new Set<string>();

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `${x},${y}`;
        const cellBodies = this.broadPhaseGrid.get(key);
        if (!cellBodies) continue;

        for (const id of cellBodies) {
          if (checked.has(id)) continue;
          checked.add(id);

          const body = this.bodies.get(id);
          if (!body) continue;
          if ((body.collisionLayers & collisionMask) === 0) continue;

          if (body.position.x >= min.x && body.position.x <= max.x &&
              body.position.y >= min.y && body.position.y <= max.y) {
            results.push(body);
          }
        }
      }
    }

    return results;
  }

  getCollisionPairs(): CollisionInfo[] {
    return [...this.collisionPairs];
  }

  clear(): void {
    this.bodies.clear();
    this.broadPhaseGrid.clear();
    this.sleepingBodies.clear();
    this.bodySleepTimers.clear();
    this.collisionPairs = [];
  }

  getBodyCount(): number {
    return this.bodies.size;
  }

  isSleeping(id: string): boolean {
    return this.sleepingBodies.has(id);
  }

  wakeAll(): void {
    for (const body of this.bodies.values()) {
      if (!body.isStatic && !body.isKinematic) {
        this.wakeBody(body);
      }
    }
  }
}

export function createPhysicsBody(params: {
  id: string;
  position?: Vector2;
  velocity?: Vector2;
  mass?: number;
  restitution?: number;
  friction?: number;
  angle?: number;
  angularVelocity?: number;
  isStatic?: boolean;
  isKinematic?: boolean;
  collisionLayers?: number;
  collisionMask?: number;
  userData?: unknown;
}): PhysicsBody {
  const mass = params.mass ?? 1;
  const isStatic = params.isStatic ?? false;
  const isKinematic = params.isKinematic ?? false;

  return {
    id: params.id,
    position: params.position ?? { x: 0, y: 0 },
    velocity: params.velocity ?? { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    mass,
    inverseMass: isStatic || isKinematic || mass <= 0 ? 0 : 1 / mass,
    restitution: params.restitution ?? 0.3,
    friction: params.friction ?? 0.6,
    angularVelocity: params.angularVelocity ?? 0,
    torque: 0,
    momentOfInertia: mass * 1, // Simplified
    inverseMomentOfInertia: isStatic || isKinematic || mass <= 0 ? 0 : 1 / (mass * 1),
    angle: params.angle ?? 0,
    isStatic,
    isKinematic,
    collisionLayers: params.collisionLayers ?? 1,
    collisionMask: params.collisionMask ?? 0xFFFFFFFF,
    userData: params.userData ?? null,
  };
}