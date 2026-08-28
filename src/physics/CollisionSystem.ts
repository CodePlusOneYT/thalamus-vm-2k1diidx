/**
 * CollisionSystem.ts
 * Narrow-phase collision detection (GJK/EPA, SAT), contact generation,
 * collision response with friction/restitution for Card Drive & Drift
 */

import { Vec2, Vec3, Mat3, MathUtils } from './MathUtils.js';

export interface ContactPoint {
  pointA: Vec2;
  pointB: Vec2;
  normal: Vec2;
  penetration: number;
  featureA: number;
  featureB: number;
}

export interface CollisionManifold {
  contacts: ContactPoint[];
  normal: Vec2;
  bodyA: CollisionBody;
  bodyB: CollisionBody;
  restitution: number;
  friction: number;
}

export interface CollisionBody {
  id: number;
  position: Vec2;
  rotation: number;
  velocity: Vec2;
  angularVelocity: number;
  mass: number;
  invMass: number;
  inertia: number;
  invInertia: number;
  shape: CollisionShape;
  material: PhysicsMaterial;
  isStatic: boolean;
  isTrigger: boolean;
  userData: unknown;
}

export interface PhysicsMaterial {
  restitution: number;
  staticFriction: number;
  dynamicFriction: number;
}

export enum CollisionShapeType {
  CIRCLE = 'circle',
  BOX = 'box',
  POLYGON = 'polygon',
  CAPSULE = 'capsule',
  EDGE = 'edge',
}

export interface CollisionShape {
  type: CollisionShapeType;
  radius?: number;
  halfExtents?: Vec2;
  vertices?: Vec2[];
  normals?: Vec2[];
  radiusA?: number;
  radiusB?: number;
  centerA?: Vec2;
  centerB?: Vec2;
}

export interface AABB {
  min: Vec2;
  max: Vec2;
}

export interface RaycastResult {
  hit: boolean;
  point: Vec2;
  normal: Vec2;
  distance: number;
  body: CollisionBody | null;
}

export interface CollisionFilter {
  categoryBits: number;
  maskBits: number;
  groupIndex: number;
}

const DEFAULT_MATERIAL: PhysicsMaterial = {
  restitution: 0.3,
  staticFriction: 0.6,
  dynamicFriction: 0.4,
};

const DEFAULT_FILTER: CollisionFilter = {
  categoryBits: 0x0001,
  maskBits: 0xFFFF,
  groupIndex: 0,
};

export class CollisionSystem {
  private bodies: Map<number, CollisionBody> = new Map();
  private bodyIdCounter = 0;
  private broadPhasePairs: Array<[CollisionBody, CollisionBody]> = [];
  private manifolds: CollisionManifold[] = [];
  private contactListener: ContactListener | null = null;
  private gravity: Vec2 = { x: 0, y: -9.81 };
  private subSteps = 4;
  private positionCorrectionPercent = 0.4;
  private positionCorrectionSlop = 0.01;
  private maxContactPoints = 4;

  constructor() {}

  setContactListener(listener: ContactListener): void {
    this.contactListener = listener;
  }

  setGravity(gravity: Vec2): void {
    this.gravity = gravity;
  }

  setSubSteps(steps: number): void {
    this.subSteps = Math.max(1, Math.floor(steps));
  }

  createBody(def: BodyDef): CollisionBody {
    const id = this.bodyIdCounter++;
    const shape = this.createShape(def.shape);
    const mass = def.isStatic ? 0 : def.mass ?? this.computeMass(shape, def.density ?? 1);
    const inertia = def.isStatic ? 0 : this.computeInertia(shape, mass);

    const body: CollisionBody = {
      id,
      position: { ...def.position },
      rotation: def.rotation ?? 0,
      velocity: { ...def.velocity },
      angularVelocity: def.angularVelocity ?? 0,
      mass,
      invMass: mass > 0 ? 1 / mass : 0,
      inertia,
      invInertia: inertia > 0 ? 1 / inertia : 0,
      shape,
      material: def.material ?? DEFAULT_MATERIAL,
      isStatic: def.isStatic ?? false,
      isTrigger: def.isTrigger ?? false,
      userData: def.userData ?? null,
    };

    this.bodies.set(id, body);
    return body;
  }

  destroyBody(body: CollisionBody): void {
    this.bodies.delete(body.id);
  }

  private createShape(def: ShapeDef): CollisionShape {
    switch (def.type) {
      case CollisionShapeType.CIRCLE:
        return { type: CollisionShapeType.CIRCLE, radius: def.radius ?? 1 };
      case CollisionShapeType.BOX:
        return { type: CollisionShapeType.BOX, halfExtents: def.halfExtents ?? { x: 1, y: 1 } };
      case CollisionShapeType.POLYGON:
        return {
          type: CollisionShapeType.POLYGON,
          vertices: def.vertices ?? [],
          normals: this.computeNormals(def.vertices ?? []),
        };
      case CollisionShapeType.CAPSULE:
        return {
          type: CollisionShapeType.CAPSULE,
          radius: def.radius ?? 0.5,
          centerA: def.centerA ?? { x: 0, y: -def.halfHeight ?? -1 },
          centerB: def.centerB ?? { x: 0, y: def.halfHeight ?? 1 },
        };
      case CollisionShapeType.EDGE:
        return {
          type: CollisionShapeType.EDGE,
          vertices: def.vertices ?? [{ x: -1, y: 0 }, { x: 1, y: 0 }],
        };
      default:
        return { type: CollisionShapeType.CIRCLE, radius: 1 };
    }
  }

  private computeNormals(vertices: Vec2[]): Vec2[] {
    const normals: Vec2[] = [];
    for (let i = 0; i < vertices.length; i++) {
      const next = (i + 1) % vertices.length;
      const edge = MathUtils.vec2Sub(vertices[next], vertices[i]);
      const normal = MathUtils.vec2Normalize({ x: -edge.y, y: edge.x });
      normals.push(normal);
    }
    return normals;
  }

  private computeMass(shape: CollisionShape, density: number): number {
    let area = 0;
    switch (shape.type) {
      case CollisionShapeType.CIRCLE:
        area = Math.PI * shape.radius! ** 2;
        break;
      case CollisionShapeType.BOX:
        area = 4 * shape.halfExtents!.x * shape.halfExtents!.y;
        break;
      case CollisionShapeType.POLYGON:
        area = this.polygonArea(shape.vertices!);
        break;
      case CollisionShapeType.CAPSULE:
        const r = shape.radius!;
        const h = MathUtils.vec2Distance(shape.centerA!, shape.centerB!);
        area = Math.PI * r * r + 2 * r * h;
        break;
      case CollisionShapeType.EDGE:
        area = 0;
        break;
    }
    return area * density;
  }

  private polygonArea(vertices: Vec2[]): number {
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
    }
    return Math.abs(area) * 0.5;
  }

  private computeInertia(shape: CollisionShape, mass: number): number {
    if (mass === 0) return 0;
    switch (shape.type) {
      case CollisionShapeType.CIRCLE:
        return 0.5 * mass * shape.radius! ** 2;
      case CollisionShapeType.BOX: {
        const hx = shape.halfExtents!.x;
        const hy = shape.halfExtents!.y;
        return (mass / 12) * (4 * hx * hx + 4 * hy * hy);
      }
      case CollisionShapeType.POLYGON:
        return this.polygonInertia(shape.vertices!, mass);
      case CollisionShapeType.CAPSULE: {
        const r = shape.radius!;
        const h = MathUtils.vec2Distance(shape.centerA!, shape.centerB!);
        return mass * (0.5 * r * r + (1 / 12) * h * h);
      }
      case CollisionShapeType.EDGE:
        return 0;
      default:
        return 1;
    }
  }

  private polygonInertia(vertices: Vec2[], mass: number): number {
    let I = 0;
    let area = 0;
    const center = { x: 0, y: 0 };
    const kInv3 = 1 / 3;

    for (let i = 0; i < vertices.length; i++) {
      const v1 = vertices[i];
      const v2 = vertices[(i + 1) % vertices.length];
      const cross = v1.x * v2.y - v2.x * v1.y;
      const triangleArea = 0.5 * cross;
      area += triangleArea;

      center.x += triangleArea * kInv3 * (v1.x + v2.x);
      center.y += triangleArea * kInv3 * (v1.y + v2.y);

      const ix = v1.x * v1.x + v2.x * v1.x + v2.x * v2.x;
      const iy = v1.y * v1.y + v2.y * v1.y + v2.y * v2.y;
      I += 0.25 * kInv3 * cross * (ix + iy);
    }

    center.x *= 1 / area;
    center.y *= 1 / area;
    I *= mass / area;

    return I;
  }

  step(dt: number): void {
    const subDt = dt / this.subSteps;

    for (let i = 0; i < this.subSteps; i++) {
      this.integrateVelocities(subDt);
      this.broadPhase();
      this.narrowPhase();
      this.solveContacts(subDt);
      this.integratePositions(subDt);
      this.clearForces();
    }
  }

  private integrateVelocities(dt: number): void {
    for (const body of this.bodies.values()) {
      if (body.isStatic || body.invMass === 0) continue;
      body.velocity.x += this.gravity.x * dt;
      body.velocity.y += this.gravity.y * dt;
    }
  }

  private integratePositions(dt: number): void {
    for (const body of this.bodies.values()) {
      if (body.isStatic || body.invMass === 0) continue;
      body.position.x += body.velocity.x * dt;
      body.position.y += body.velocity.y * dt;
      body.rotation += body.angularVelocity * dt;
    }
  }

  private clearForces(): void {
    // Forces would be accumulated here if we had force application
  }

  private broadPhase(): void {
    this.broadPhasePairs = [];
    const bodies = Array.from(this.bodies.values());
    const count = bodies.length;

    for (let i = 0; i < count; i++) {
      const bodyA = bodies[i];
      const aabbA = this.computeAABB(bodyA);

      for (let j = i + 1; j < count; j++) {
        const bodyB = bodies[j];

        if (bodyA.isStatic && bodyB.isStatic) continue;
        if (!this.shouldCollide(bodyA, bodyB)) continue;

        const aabbB = this.computeAABB(bodyB);
        if (this.aabbOverlap(aabbA, aabbB)) {
          this.broadPhasePairs.push([bodyA, bodyB]);
        }
      }
    }
  }

  private computeAABB(body: CollisionBody): AABB {
    const shape = body.shape;
    const cos = Math.cos(body.rotation);
    const sin = Math.sin(body.rotation);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const addPoint = (x: number, y: number) => {
      const rx = cos * x - sin * y + body.position.x;
      const ry = sin * x + cos * y + body.position.y;
      minX = Math.min(minX, rx);
      minY = Math.min(minY, ry);
      maxX = Math.max(maxX, rx);
      maxY = Math.max(maxY, ry);
    };

    switch (shape.type) {
      case CollisionShapeType.CIRCLE: {
        const r = shape.radius!;
        addPoint(-r, -r);
        addPoint(r, r);
        break;
      }
      case CollisionShapeType.BOX: {
        const hx = shape.halfExtents!.x;
        const hy = shape.halfExtents!.y;
        addPoint(-hx, -hy);
        addPoint(hx, -hy);
        addPoint(hx, hy);
        addPoint(-hx, hy);
        break;
      }
      case CollisionShapeType.POLYGON: {
        for (const v of shape.vertices!) {
          addPoint(v.x, v.y);
        }
        break;
      }
      case CollisionShapeType.CAPSULE: {
        const r = shape.radius!;
        addPoint(shape.centerA!.x - r, shape.centerA!.y - r);
        addPoint(shape.centerA!.x + r, shape.centerA!.y + r);
        addPoint(shape.centerB!.x - r, shape.centerB!.y - r);
        addPoint(shape.centerB!.x + r, shape.centerB!.y + r);
        break;
      }
      case CollisionShapeType.EDGE: {
        for (const v of shape.vertices!) {
          addPoint(v.x, v.y);
        }
        break;
      }
    }

    return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
  }

  private aabbOverlap(a: AABB, b: AABB): boolean {
    return a.min.x <= b.max.x && a.max.x >= b.min.x &&
           a.min.y <= b.max.y && a.max.y >= b.min.y;
  }

  private shouldCollide(bodyA: CollisionBody, bodyB: CollisionBody): boolean {
    if (bodyA.isTrigger || bodyB.isTrigger) return true;
    return true; // Simplified - would use collision filters in full implementation
  }

  private narrowPhase(): void {
    this.manifolds = [];

    for (const [bodyA, bodyB] of this.broadPhasePairs) {
      const manifold = this.collide(bodyA, bodyB);
      if (manifold && manifold.contacts.length > 0) {
        this.manifolds.push(manifold);

        if (this.contactListener) {
          if (bodyA.isTrigger || bodyB.isTrigger) {
            this.contactListener.onTriggerEnter?.(bodyA, bodyB);
          } else {
            this.contactListener.onContactBegin?.(manifold);
          }
        }
      }
    }
  }

  private collide(bodyA: CollisionBody, bodyB: CollisionBody): CollisionManifold | null {
    const shapeA = bodyA.shape;
    const shapeB = bodyB.shape;

    if (shapeA.type === CollisionShapeType.CIRCLE && shapeB.type === CollisionShapeType.CIRCLE) {
      return this.collideCircles(bodyA, bodyB);
    }
    if (shapeA.type === CollisionShapeType.CIRCLE && shapeB.type === CollisionShapeType.BOX) {
      return this.collideCircleBox(bodyA, bodyB);
    }
    if (shapeA.type === CollisionShapeType.BOX && shapeB.type === CollisionShapeType.CIRCLE) {
      const m = this.collideCircleBox(bodyB, bodyA);
      if (m) {
        m.normal = { x: -m.normal.x, y: -m.normal.y };
        const temp = m.bodyA; m.bodyA = m.bodyB; m.bodyB = temp;
        for (const c of m.contacts) {
          const tp = c.pointA; c.pointA = c.pointB; c.pointB = tp;
        }
      }
      return m;
    }
    if (shapeA.type === CollisionShapeType.BOX && shapeB.type === CollisionShapeType.BOX) {
      return this.collideBoxes(bodyA, bodyB);
    }
    if (shapeA.type === CollisionShapeType.CIRCLE && shapeB.type === CollisionShapeType.POLYGON) {
      return this.collideCirclePolygon(bodyA, bodyB);
    }
    if (shapeA.type === CollisionShapeType.POLYGON && shapeB.type === CollisionShapeType.CIRCLE) {
      const m = this.collideCirclePolygon(bodyB, bodyA);
      if (m) {
        m.normal = { x: -m.normal.x, y: -m.normal.y };
        const temp = m.bodyA; m.bodyA = m.bodyB; m.bodyB = temp;
        for (const c of m.contacts) {
          const tp = c.pointA; c.pointA = c.pointB; c.pointB = tp;
        }
      }
      return m;
    }
    if (shapeA.type === CollisionShapeType.POLYGON && shapeB.type === CollisionShapeType.POLYGON) {
      return this.collidePolygons(bodyA, bodyB);
    }
    if (shapeA.type === CollisionShapeType.CAPSULE || shapeB.type === CollisionShapeType.CAPSULE) {
      return this.collideCapsule(bodyA, bodyB);
    }
    if (shapeA.type === CollisionShapeType.EDGE || shapeB.type === CollisionShapeType.EDGE) {
      return this.collideEdge(bodyA, bodyB);
    }

    return null;
  }

  private collideCircles(bodyA: CollisionBody, bodyB: CollisionBody): CollisionManifold | null {
    const shapeA = bodyA.shape as CircleShape;
    const shapeB = bodyB.shape as CircleShape;
    const rA = shapeA.radius!;
    const rB = shapeB.radius!;

    const dx = bodyB.position.x - bodyA.position.x;
    const dy = bodyB.position.y - bodyA.position.y;
    const distSq = dx * dx + dy * dy;
    const radiusSum = rA + rB;

    if (distSq >= radiusSum * radiusSum) return null;

    const dist = Math.sqrt(distSq);
    let normal: Vec2;
    if (dist > 0.0001) {
      normal = { x: dx / dist, y: dy / dist };
    } else {
      normal = { x: 1, y: 0 };
    }

    const penetration = radiusSum - dist;
    const pointA = { x: bodyA.position.x + normal.x * rA, y: bodyA.position.y + normal.y * rA };
    const pointB = { x: bodyB.position.x - normal.x * rB, y: bodyB.position.y - normal.y * rB };

    return this.createManifold(bodyA, bodyB, normal, [{ pointA, pointB, normal, penetration, featureA: 0, featureB: 0 }]);
  }

  private collideCircleBox(bodyA: CollisionBody, bodyB: CollisionBody): CollisionManifold | null {
    const circle = bodyA.shape as CircleShape;
    const box = bodyB.shape as BoxShape;
    const r = circle.radius!;
    const hx = box.halfExtents!.x;
    const hy = box.halfExtents!.y;

    const cos = Math.cos(bodyB.rotation);
    const sin = Math.sin(bodyB.rotation);

    const dx = bodyA.position.x - bodyB.position.x;
    const dy = bodyA.position.y - bodyB.position.y;

    const localX = cos * dx + sin * dy;
    const localY = -sin * dx + cos * dy;

    let closestX = MathUtils.clamp(localX, -hx, hx);
    let closestY = MathUtils.clamp(localY, -hy, hy);

    const diffX = localX - closestX;
    const diffY = localY - closestY;
    const distSq = diffX * diffX + diffY * diffY;

    if (distSq >= r * r) return null;

    let normal: Vec2;
    let penetration: number;
    let featureA = 0;
    let featureB = 0;

    const inside = localX > -hx && localX < hx && localY > -hy && localY < hy;

    if (inside) {
      const distX = Math.min(localX + hx, hx - localX);
      const distY = Math.min(localY + hy, hy - localY);

      if (distX < distY) {
        if (localX > 0) {
          closestX = hx;
          normal = { x: cos, y: sin };
          penetration = hx - localX + r;
          featureB = 1;
        } else {
          closestX = -hx;
          normal = { x: -cos, y: -sin };
          penetration = localX + hx + r;
          featureB = 3;
        }
      } else {
        if (localY > 0) {
          closestY = hy;
          normal = { x: -sin, y: cos };
          penetration = hy - localY + r;
          featureB = 2;
        } else {
          closestY = -hy;
          normal = { x: sin, y: -cos };
          penetration = localY + hy + r;
          featureB = 0;
        }
      }
    } else {
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        normal = { x: (cos * diffX - sin * diffY) / dist, y: (sin * diffX + cos * diffY) / dist };
      } else {
        normal = { x: cos, y: sin };
      }
      penetration = r - dist;
      featureA = 0;
    }

    const worldClosestX = cos * closestX - sin * closestY + bodyB.position.x;
    const worldClosestY = sin * closestX + cos * closestY + bodyB.position.y;

    const pointA = { x: bodyA.position.x + normal.x * r, y: bodyA.position.y + normal.y * r };
    const pointB = { x: worldClosestX, y: worldClosestY };

    return this.createManifold(bodyA, bodyB, normal, [{ pointA, pointB, normal, penetration, featureA, featureB }]);
  }

  private collideBoxes(bodyA: CollisionBody, bodyB: CollisionBody): CollisionManifold | null {
    const shapeA = bodyA.shape as BoxShape;
    const shapeB = bodyB.shape as BoxShape;

    const cosA = Math.cos(bodyA.rotation);
    const sinA = Math.sin(bodyA.rotation);
    const cosB = Math.cos(bodyB.rotation);
    const sinB = Math.sin(bodyB.rotation);

    const axes: Vec2[] = [
      { x: cosA, y: sinA },
      { x: -sinA, y: cosA },
      { x: cosB, y: sinB },
      { x: -sinB, y: cosB },
    ];

    let minPenetration = Infinity;
    let minAxis: Vec2 = { x: 0, y: 0 };
    let minAxisIndex = -1;

    for (let i = 0; i < 4; i++) {
      const axis = axes[i];
      const projA = this.projectBox(bodyA, shapeA, axis);
      const projB = this.projectBox(bodyB, shapeB, axis);

      const penetration = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
      if (penetration <= 0) return null;

      if (penetration < minPenetration) {
        minPenetration = penetration;
        minAxis = axis;
        minAxisIndex = i;
      }
    }

    const dx = bodyB.position.x - bodyA.position.x;
    const dy = bodyB.position.y - bodyA.position.y;
    if (dx * minAxis.x + dy * minAxis.y < 0) {
      minAxis = { x: -minAxis.x, y: -minAxis.y };
    }

    const contacts = this.findContactPoints(bodyA, shapeA, bodyB, shapeB, minAxis, minPenetration);
    return this.createManifold(bodyA, bodyB, minAxis, contacts);
  }

  private projectBox(body: CollisionBody, shape: BoxShape, axis: Vec2): { min: number; max: number } {
    const cos = Math.cos(body.rotation);
    const sin = Math.sin(body.rotation);
    const hx = shape.halfExtents!.x;
    const hy = shape.halfExtents!.y;

    const vertices = [
      { x: -hx, y: -hy },
      { x: hx, y: -hy },
      { x: hx, y: hy },
      { x: -hx, y: hy },
    ];

    let min = Infinity, max = -Infinity;
    for (const v of vertices) {
      const rx = cos * v.x - sin * v.y;
      const ry = sin * v.x + cos * v.y;
      const proj = (rx + body.position.x) * axis.x + (ry + body.position.y) * axis.y;
      min = Math.min(min, proj);
      max = Math.max(max, proj);
    }
    return { min, max };
  }

  private findContactPoints(
    bodyA: CollisionBody, shapeA: BoxShape,
    bodyB: CollisionBody, shapeB: BoxShape,
    normal: Vec2, penetration: number
  ): ContactPoint[] {
    const contacts: ContactPoint[] = [];
    const cosA = Math.cos(bodyA.rotation);
    const sinA = Math.sin(bodyA.rotation);
    const cosB = Math.cos(bodyB.rotation);
    const sinB = Math.sin(bodyB.rotation);
    const hxA = shapeA.halfExtents!.x;
    const hyA = shapeA.halfExtents!.y;
    const hxB = shapeB.halfExtents!.x;
    const hyB = shapeB.halfExtents!.y;

    const verticesA: Vec2[] = [
      { x: -hxA, y: -hyA },
      { x: hxA, y: -hyA },
      { x: hxA, y: hyA },
      { x: -hxA, y: hyA },
    ].map(v => ({
      x: cosA * v.x - sinA * v.y + bodyA.position.x,
      y: sinA * v.x + cosA * v.y + bodyA.position.y,
    }));

    const verticesB: Vec2[] = [
      { x: -hxB, y: -hyB },
      { x: hxB, y: -hyB },
      { x: hxB, y: hyB },
      { x: -hxB, y: hyB },
    ].map(v => ({
      x: cosB * v.x - sinB * v.y + bodyB.position.x,
      y: sinB * v.x + cosB * v.y + bodyB.position.y,
    }));

    for (let i = 0; i < 4; i++) {
      const v = verticesA[i];
      const dist = (v.x - bodyB.position.x) * normal.x + (v.y - bodyB.position.y) * normal.y;
      const projB = this.projectBox(bodyB, shapeB, normal);
      if (dist >= projB.min - 0.001 && dist <= projB.max + 0.001) {
        const localX = cosB * (v.x - bodyB.position.x) + sinB * (v.y - bodyB.position.y);
        const localY = -sinB * (v.x - bodyB.position.x) + cosB * (v.y - bodyB.position.y);
        if (localX >= -hxB - 0.001 && localX <= hxB + 0.001 && localY >= -hyB - 0.001 && localY <= hyB + 0.001) {
          contacts.push({
            pointA: v,
            pointB: v,
            normal,
            penetration,
            featureA: i,
            featureB: -1,
          });
        }
      }
    }

    for (let i = 0; i < 4; i++) {
      const v = verticesB[i];
      const dist = (v.x - bodyA.position.x) * (-normal.x) + (v.y - bodyA.position.y) * (-normal.y);
      const projA = this.projectBox(bodyA, shapeA, { x: -normal.x, y: -normal.y });
      if (dist >= projA.min - 0.001 && dist <= projA.max + 0.001) {
        const localX = cosA * (v.x - bodyA.position.x) + sinA * (v.y - bodyA.position.y);
        const localY = -sinA * (v.x - bodyA.position.x) + cosA * (v.y - bodyA.position.y);
        if (localX >= -hxA - 0.001 && localX <= hxA + 0.001 && localY >= -hyA - 0.001 && localY <= hyA + 0.001) {
          contacts.push({
            pointA: v,
            pointB: v,
            normal,
            penetration,
            featureA: -1,
            featureB: i,
          });
        }
      }
    }

    return this.reduceContacts(contacts);
  }

  private reduceContacts(contacts: ContactPoint[]): ContactPoint[] {
    if (contacts.length <= this.maxContactPoints) return contacts;

    const unique: ContactPoint[] = [];
    for (const c of contacts) {
      let found = false;
      for (const u of unique) {
        if (MathUtils.vec2Distance(c.pointA, u.pointA) < 0.01) {
          found = true;
          break;
        }
      }
      if (!found) unique.push(c);
      if (unique.length >= this.maxContactPoints) break;
    }
    return unique;
  }

  private collideCirclePolygon(bodyA: CollisionBody, bodyB: CollisionBody): CollisionManifold | null {
    const circle = bodyA.shape as CircleShape;
    const polygon = bodyB.shape as PolygonShape;
    const r = circle.radius!;

    const cos = Math.cos(bodyB.rotation);
    const sin = Math.sin(bodyB.rotation);

    const dx = bodyA.position.x - bodyB.position.x;
    const dy = bodyA.position.y - bodyB.position.y;

    const localX = cos * dx + sin * dy;
    const localY = -sin * dx + cos * dy;

    let minDist = Infinity;
    let minNormal: Vec2 = { x: 0, y: 0 };
    let minFeature = -1;
    let inside = true;

    for (let i = 0; i < polygon.vertices!.length; i++) {
      const v = polygon.vertices![i];
      const n = polygon.normals![i];
      const dist = (localX - v.x) * n.x + (localY - v.y) * n.y;
      if (dist > r) return null;
      if (dist > 0) inside = false;
      if (dist < minDist) {
        minDist = dist;
        minNormal = n;
        minFeature = i;
      }
    }

    let normal: Vec2;
    let penetration: number;
    let featureA = 0;
    let featureB = minFeature;

    if (inside) {
      normal = { x: cos * minNormal.x - sin * minNormal.y, y: sin * minNormal.x + cos * minNormal.y };
      penetration = r - minDist;
    } else {
      let closestDistSq = Infinity;
      let closestVertex: Vec2 = { x: 0, y: 0 };
      let closestFeature = -1;

      for (let i = 0; i < polygon.vertices!.length; i++) {
        const v = polygon.vertices![i];
        const diffX = localX - v.x;
        const diffY = localY - v.y;
        const distSq = diffX * diffX + diffY * diffY;
        if (distSq < closestDistSq) {
          closestDistSq = distSq;
          closestVertex = v;
          closestFeature = i;
        }
      }

      if (closestDistSq >= r * r) return null;

      const closestDist = Math.sqrt(closestDistSq);
      const nx = cos * closestVertex.x - sin * closestVertex.y;
      const ny = sin * closestVertex.x + cos * closestVertex.y;

      if (closestDist > 0.0001) {
        normal = { x: nx / closestDist, y: ny / closestDist };
      } else {
        normal = { x: cos * minNormal.x - sin * minNormal.y, y: sin * minNormal.x + cos * minNormal.y };
      }
      penetration = r - closestDist;
      featureB = closestFeature;
    }

    const worldClosestX = cos * (localX - normal.x * penetration) - sin * (localY - normal.y * penetration) + bodyB.position.x;
    const worldClosestY = sin * (localX - normal.x * penetration) + cos * (localY - normal.y * penetration) + bodyB.position.y;

    const pointA = { x: bodyA.position.x + normal.x * r, y: bodyA.position.y + normal.y * r };
    const pointB = { x: worldClosestX, y: worldClosestY };

    return this.createManifold(bodyA, bodyB, normal, [{ pointA, pointB, normal, penetration, featureA, featureB }]);
  }

  private collidePolygons(bodyA: CollisionBody, bodyB: CollisionBody): CollisionManifold | null {
    const polyA = bodyA.shape as PolygonShape;
    const polyB = bodyB.shape as PolygonShape;

    const cosA = Math.cos(bodyA.rotation);
    const sinA = Math.sin(bodyA.rotation);
    const cosB = Math.cos(bodyB.rotation);
    const sinB = Math.sin(bodyB.rotation);

    let minPenetration = Infinity;
    let minNormal: Vec2 = { x: 0, y: 0 };
    let minFeatureA = -1;
    let minFeatureB = -1;
    let referenceBody: CollisionBody = bodyA;
    let incidentBody: CollisionBody = bodyB;
    let referencePoly = polyA;
    let incidentPoly = polyB;
    let referenceCos = cosA, referenceSin = sinA;
    let incidentCos = cosB, incidentSin = sinB;
    let flipped = false;

    for (let i = 0; i < polyA.vertices!.length; i++) {
      const n = polyA.normals![i];
      const worldN = { x: cosA * n.x - sinA * n.y, y: sinA * n.x + cosA * n.y };
      const projA = this.projectPolygon(bodyA, polyA, worldN);
      const projB = this.projectPolygon(bodyB, polyB, worldN);
      const penetration = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
      if (penetration <= 0) return null;
      if (penetration < minPenetration) {
        minPenetration = penetration;
        minNormal = worldN;
        minFeatureA = i;
        minFeatureB = -1;
        flipped = false;
      }
    }

    for (let i = 0; i < polyB.vertices!.length; i++) {
      const n = polyB.normals![i];
      const worldN = { x: cosB * n.x - sinB * n.y, y: sinB * n.x + cosB * n.y };
      const projA = this.projectPolygon(bodyA, polyA, worldN);
      const projB = this.projectPolygon(bodyB, polyB, worldN);
      const penetration = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
      if (penetration <= 0) return null;
      if (penetration < minPenetration) {
        minPenetration = penetration;
        minNormal = worldN;
        minFeatureA = -1;
        minFeatureB = i;
        flipped = true;
        referenceBody = bodyB;
        incidentBody = bodyA;
        referencePoly = polyB;
        incidentPoly = polyA;
        referenceCos = cosB; referenceSin = sinB;
        incidentCos = cosA; incidentSin = sinA;
      }
    }

    const dx = incidentBody.position.x - referenceBody.position.x;
    const dy = incidentBody.position.y - referenceBody.position.y;
    if (dx * minNormal.x + dy * minNormal.y < 0) {
      minNormal = { x: -minNormal.x, y: -minNormal.y };
    }

    const contacts = this.clipPolygons(referenceBody, referencePoly, incidentBody, incidentPoly, minNormal, minPenetration, flipped);
    return this.createManifold(bodyA, bodyB, minNormal, contacts);
  }

  private projectPolygon(body: CollisionBody, poly: PolygonShape, axis: Vec2): { min: number; max: number } {
    let min = Infinity, max = -Infinity;
    for (const v of poly.vertices!) {
      const rx = Math.cos(body.rotation) * v.x - Math.sin(body.rotation) * v.y + body.position.x;
      const ry = Math.sin(body.rotation) * v.x + Math.cos(body.rotation) * v.y + body.position.y;
      const proj = rx * axis.x + ry * axis.y;
      min = Math.min(min, proj);
      max = Math.max(max, proj);
    }
    return { min, max };
  }

  private clipPolygons(
    refBody: CollisionBody, refPoly: PolygonShape,
    incBody: CollisionBody, incPoly: PolygonShape,
    normal: Vec2, penetration: number, flipped: boolean
  ): ContactPoint[] {
    const refVertices = refPoly.vertices!.map(v => ({
      x: Math.cos(refBody.rotation) * v.x - Math.sin(refBody.rotation) * v.y + refBody.position.x,
      y: Math.sin(refBody.rotation) * v.x + Math.cos(refBody.rotation) * v.y + refBody.position.y,
    }));

    const incVertices = incPoly.vertices!.map(v => ({
      x: Math.cos(incBody.rotation) * v.x - Math.sin(incBody.rotation) * v.y + incBody.position.x,
      y: Math.sin(incBody.rotation) * v.x + Math.cos(incBody.rotation) * v.y + incBody.position.y,
    }));

    let input = incVertices;
    for (let i = 0; i < refPoly.vertices!.length; i++) {
      const v1 = refVertices[i];
      const v2 = refVertices[(i + 1) % refVertices.length];
      const edge = { x: v2.x - v1.x, y: v2.y - v1.y };
      const edgeNormal = { x: -edge.y, y: edge.x };
      const len = Math.hypot(edgeNormal.x, edgeNormal.y);
      if (len > 0) {
        edgeNormal.x /= len;
        edgeNormal.y /= len;
      }

      const output: Vec2[] = [];
      for (let j = 0; j < input.length; j++) {
        const curr = input[j];
        const next = input[(j + 1) % input.length];
        const distCurr = (curr.x - v1.x) * edgeNormal.x + (curr.y - v1.y) * edgeNormal.y;
        const distNext = (next.x - v1.x) * edgeNormal.x + (next.y - v1.y) * edgeNormal.y;

        if (distCurr >= -0.001) output.push(curr);
        if (distCurr * distNext < -0.001) {
          const t = distCurr / (distCurr - distNext);
          output.push({
            x: curr.x + (next.x - curr.x) * t,
            y: curr.y + (next.y - curr.y) * t,
          });
        }
      }
      input = output;
      if (input.length === 0) break;
    }

    const contacts: ContactPoint[] = [];
    for (const v of input) {
      const dist = (v.x - refBody.position.x) * normal.x + (v.y - refBody.position.y) * normal.y;
      const projRef = this.projectPolygon(refBody, refPoly, normal);
      if (dist >= projRef.min - 0.001 && dist <= projRef.max + 0.001) {
        const pointA = flipped ? v : { x: v.x - normal.x * penetration, y: v.y - normal.y * penetration };
        const pointB = flipped ? { x: v.x + normal.x * penetration, y: v.y + normal.y * penetration } : v;
        contacts.push({
          pointA,
          pointB,
          normal,
          penetration,
          featureA: flipped ? -1 : minFeatureA,
          featureB: flipped ? minFeatureB : -1,
        });
      }
    }

    return this.reduceContacts(contacts);
  }

  private collideCapsule(bodyA: CollisionBody, bodyB: CollisionBody): CollisionManifold | null {
    // Simplified capsule collision - treat as circle for now
    return this.collideCircles(bodyA, bodyB);
  }

  private collideEdge(bodyA: CollisionBody, bodyB: CollisionBody): CollisionManifold | null {
    // Simplified edge collision - treat as polygon
    const edgeA = bodyA.shape.type === CollisionShapeType.EDGE ? bodyA : bodyB;
    const other = bodyA.shape.type === CollisionShapeType.EDGE ? bodyB : bodyA;
    const edgeShape = edgeA.shape as EdgeShape;

    if (other.shape.type === CollisionShapeType.CIRCLE) {
      return this.collideCircleEdge(other, edgeA);
    }
    return null;
  }

  private collideCircleEdge(circleBody: CollisionBody, edgeBody: CollisionBody): CollisionManifold | null {
    const circle = circleBody.shape as CircleShape;
    const edge = edgeBody.shape as EdgeShape;
    const r = circle.radius!;
    const vertices = edge.vertices!;

    if (vertices.length < 2) return null;

    const cos = Math.cos(edgeBody.rotation);
    const sin = Math.sin(edgeBody.rotation);

    const localCircleX = cos * (circleBody.position.x - edgeBody.position.x) + sin * (circleBody.position.y - edgeBody.position.y);
    const localCircleY = -sin * (circleBody.position.x - edgeBody.position.x) + cos * (circleBody.position.y - edgeBody.position.y);

    let minDist = Infinity;
    let closestPoint: Vec2 = { x: 0, y: 0 };
    let closestNormal: Vec2 = { x: 0, y: 0 };
    let feature = -1;

    for (let i = 0; i < vertices.length - 1; i++) {
      const v1 = vertices[i];
      const v2 = vertices[i + 1];
      const edgeVec = { x: v2.x - v1.x, y: v2.y - v1.y };
      const edgeLen = Math.hypot(edgeVec.x, edgeVec.y);
      if (edgeLen < 0.0001) continue;

      const t = MathUtils.clamp(
        ((localCircleX - v1.x) * edgeVec.x + (localCircleY - v1.y) * edgeVec.y) / (edgeLen * edgeLen),
        0, 1
      );

      const closestX = v1.x + edgeVec.x * t;
      const closestY = v1.y + edgeVec.y * t;

      const diffX = localCircleX - closestX;
      const diffY = localCircleY - closestY;
      const distSq = diffX * diffX + diffY * diffY;

      if (distSq < minDist) {
        minDist = distSq;
        closestPoint = { x: closestX, y: closestY };
        const normalLen = Math.sqrt(distSq);
        if (normalLen > 0.0001) {
          closestNormal = { x: diffX / normalLen, y: diffY / normalLen };
        } else {
          closestNormal = { x: -edgeVec.y / edgeLen, y: edgeVec.x / edgeLen };
        }
        feature = i;
      }
    }

    if (minDist >= r * r) return null;

    const dist = Math.sqrt(minDist);
    let normal: Vec2;
    let penetration: number;

    if (dist > 0.0001) {
      normal = { x: cos * closestNormal.x - sin * closestNormal.y, y: sin * closestNormal.x + cos * closestNormal.y };
    } else {
      normal = { x: -sin * (vertices[1].y - vertices[0].y), y: cos * (vertices[1].x - vertices[0].x) };
      const len = Math.hypot(normal.x, normal.y);
      if (len > 0) { normal.x /= len; normal.y /= len; }
    }
    penetration = r - dist;

    const worldClosestX = cos * closestPoint.x - sin * closestPoint.y + edgeBody.position.x;
    const worldClosestY = sin * closestPoint.x + cos * closestPoint.y + edgeBody.position.y;

    const pointA = { x: circleBody.position.x + normal.x * r, y: circleBody.position.y + normal.y * r };
    const pointB = { x: worldClosestX, y: worldClosestY };

    return this.createManifold(circleBody, edgeBody, normal, [{ pointA, pointB, normal, penetration, featureA: 0, featureB: feature }]);
  }

  private createManifold(
    bodyA: CollisionBody, bodyB: CollisionBody,
    normal: Vec2, contacts: ContactPoint[]
  ): CollisionManifold {
    const restitution = Math.sqrt(bodyA.material.restitution * bodyB.material.restitution);
    const staticFriction = Math.sqrt(bodyA.material.staticFriction * bodyB.material.staticFriction);
    const dynamicFriction = Math.sqrt(bodyA.material.dynamicFriction * bodyB.material.dynamicFriction);

    return {
      contacts,
      normal,
      bodyA,
      bodyB,
      restitution,
      friction: dynamicFriction,
    };
  }

  private solveContacts(dt: number): void {
    for (const manifold of this.manifolds) {
      if (manifold.bodyA.isTrigger || manifold.bodyB.isTrigger) continue;

      for (const contact of manifold.contacts) {
        this.solveContact(manifold, contact, dt);
      }
    }
  }

  private solveContact(manifold: CollisionManifold, contact: ContactPoint, dt: number): void {
    const bodyA = manifold.bodyA;
    const bodyB = manifold.bodyB;
    const normal = manifold.normal;

    const ra = { x: contact.pointA.x - bodyA.position.x, y: contact.pointA.y - bodyA.position.y };
    const rb = { x: contact.pointB.x - bodyB.position.x, y: contact.pointB.y - bodyB.position.y };

    const vA = {
      x: bodyA.velocity.x - bodyA.angularVelocity * ra.y,
      y: bodyA.velocity.y + bodyA.angularVelocity * ra.x,
    };
    const vB = {
      x: bodyB.velocity.x - bodyB.angularVelocity * rb.y,
      y: bodyB.velocity.y + bodyB.angularVelocity * rb.x,
    };

    const dv = { x: vB.x - vA.x, y: vB.y - vA.y };
    const vn = dv.x * normal.x + dv.y * normal.y;

    if (vn > 0) return;

    const raCrossN = ra.x * normal.y - ra.y * normal.x;
    const rbCrossN = rb.x * normal.y - rb.y * normal.x;
    const invMassSum = bodyA.invMass + bodyB.invMass + raCrossN * raCrossN * bodyA.invInertia + rbCrossN * rbCrossN * bodyB.invInertia;

    if (invMassSum === 0) return;

    let j = -(1 + manifold.restitution) * vn / invMassSum;
    j = Math.max(j, 0);

    const impulse = { x: normal.x * j, y: normal.y * j };

    bodyA.velocity.x -= impulse.x * bodyA.invMass;
    bodyA.velocity.y -= impulse.y * bodyA.invMass;
    bodyA.angularVelocity -= (ra.x * impulse.y - ra.y * impulse.x) * bodyA.invInertia;

    bodyB.velocity.x += impulse.x * bodyB.invMass;
    bodyB.velocity.y += impulse.y * bodyB.invMass;
    bodyB.angularVelocity += (rb.x * impulse.y - rb.y * impulse.x) * bodyB.invInertia;

    this.solveFriction(manifold, contact, dt, vA, vB, ra, rb);
    this.solvePositionCorrection(manifold, contact);
  }

  private solveFriction(
    manifold: CollisionManifold, contact: ContactPoint, dt: number,
    vA: Vec2, vB: Vec2, ra: Vec2, rb: Vec2
  ): void {
    const bodyA = manifold.bodyA;
    const bodyB = manifold.bodyB;
    const normal = manifold.normal;

    const tangent = { x: vB.x - vA.x, y: vB.y - vA.y };
    const tangentNormal = tangent.x * normal.x + tangent.y * normal.y;
    tangent.x -= normal.x * tangentNormal;
    tangent.y -= normal.y * tangentNormal;

    const tangentLen = Math.hypot(tangent.x, tangent.y);
    if (tangentLen < 0.0001) return;

    tangent.x /= tangentLen;
    tangent.y /= tangentLen;

    const raCrossT = ra.x * tangent.y - ra.y * tangent.x;
    const rbCrossT = rb.x * tangent.y - rb.y * tangent.x;
    const invMassSum = bodyA.invMass + bodyB.invMass + raCrossT * raCrossT * bodyA.invInertia + rbCrossT * rbCrossT * bodyB.invInertia;

    if (invMassSum === 0) return;

    const vt = (vB.x - vA.x) * tangent.x + (vB.y - vA.y) * tangent.y;
    let jt = -vt / invMassSum;
    const maxFriction = manifold.friction * Math.abs(-(1 + manifold.restitution) * ((vB.x - vA.x) * normal.x + (vB.y - vA.y) * normal.y) / (bodyA.invMass + bodyB.invMass + (ra.x * normal.y - ra.y * normal.x) ** 2 * bodyA.invInertia + (rb.x * normal.y - rb.y * normal.x) ** 2 * bodyB.invInertia));

    jt = MathUtils.clamp(jt, -maxFriction, maxFriction);

    const frictionImpulse = { x: tangent.x * jt, y: tangent.y * jt };

    bodyA.velocity.x -= frictionImpulse.x * bodyA.invMass;
    bodyA.velocity.y -= frictionImpulse.y * bodyA.invMass;
    bodyA.angularVelocity -= (ra.x * frictionImpulse.y - ra.y * frictionImpulse.x) * bodyA.invInertia;

    bodyB.velocity.x += frictionImpulse.x * bodyB.invMass;
    bodyB.velocity.y += frictionImpulse.y * bodyB.invMass;
    bodyB.angularVelocity += (rb.x * frictionImpulse.y - rb.y * frictionImpulse.x) * bodyB.invInertia;
  }

  private solvePositionCorrection(manifold: CollisionManifold, contact: ContactPoint): void {
    const bodyA = manifold.bodyA;
    const bodyB = manifold.bodyB;
    const normal = manifold.normal;

    const ra = { x: contact.pointA.x - bodyA.position.x, y: contact.pointA.y - bodyA.position.y };
    const rb = { x: contact.pointB.x - bodyB.position.x, y: contact.pointB.y - bodyB.position.y };

    const penetration = contact.penetration - this.positionCorrectionSlop;
    if (penetration <= 0) return;

    const raCrossN = ra.x * normal.y - ra.y * normal.x;
    const rbCrossN = rb.x * normal.y - rb.y * normal.x;
    const invMassSum = bodyA.invMass + bodyB.invMass + raCrossN * raCrossN * bodyA.invInertia + rbCrossN * rbCrossN * bodyB.invInertia;

    if (invMassSum === 0) return;

    const correction = (penetration * this.positionCorrectionPercent) / invMassSum;
    const correctionVec = { x: normal.x * correction, y: normal.y * correction };

    bodyA.position.x -= correctionVec.x * bodyA.invMass;
    bodyA.position.y -= correctionVec.y * bodyA.invMass;
    bodyA.rotation -= (ra.x * correctionVec.y - ra.y * correctionVec.x) * bodyA.invInertia;

    bodyB.position.x += correctionVec.x * bodyB.invMass;
    bodyB.position.y += correctionVec.y * bodyB.invMass;
    bodyB.rotation += (rb.x * correctionVec.y - rb.y * correctionVec.x) * bodyB.invInertia;
  }

  raycast(origin: Vec2, direction: Vec2, maxDistance: number, filter?: CollisionFilter): RaycastResult {
    let closestHit: RaycastResult = { hit: false, point: { x: 0, y: 0 }, normal: { x: 0, y: 0 }, distance: maxDistance, body: null };

    for (const body of this.bodies.values()) {
      if (filter && !this.filterMatches(body, filter)) continue;

      const result = this.raycastBody(body, origin, direction, maxDistance);
      if (result.hit && result.distance < closestHit.distance) {
        closestHit = result;
      }
    }

    return closestHit;
  }

  private raycastBody(body: CollisionBody, origin: Vec2, direction: Vec2, maxDistance: number): RaycastResult {
    const shape = body.shape;
    const cos = Math.cos(body.rotation);
    const sin = Math.sin(body.rotation);

    const localOrigin = {
      x: cos * (origin.x - body.position.x) + sin * (origin.y - body.position.y),
      y: -sin * (origin.x - body.position.x) + cos * (origin.y - body.position.y),
    };
    const localDir = {
      x: cos * direction.x + sin * direction.y,
      y: -sin * direction.x + cos * direction.y,
    };

    let tmin = 0, tmax = maxDistance;

    switch (shape.type) {
      case CollisionShapeType.CIRCLE: {
        const r = shape.radius!;
        const oc = localOrigin;
        const a = localDir.x * localDir.x + localDir.y * localDir.y;
        const b = 2 * (oc.x * localDir.x + oc.y * localDir.y);
        const c = oc.x * oc.x + oc.y * oc.y - r * r;
        const disc = b * b - 4 * a * c;
        if (disc < 0) return { hit: false, point: { x: 0, y: 0 }, normal: { x: 0, y: 0 }, distance: maxDistance, body: null };
        const sqrtDisc = Math.sqrt(disc);
        const t = (-b - sqrtDisc) / (2 * a);
        if (t < tmin || t > tmax) return { hit: false, point: { x: 0, y: 0 }, normal: { x: 0, y: 0 }, distance: maxDistance, body: null };
        const hitPoint = { x: origin.x + direction.x * t, y: origin.y + direction.y * t };
        const normal = { x: hitPoint.x - body.position.x, y: hitPoint.y - body.position.y };
        const len = Math.hypot(normal.x, normal.y);
        return { hit: true, point: hitPoint, normal: { x: normal.x / len, y: normal.y / len }, distance: t, body };
      }
      case CollisionShapeType.BOX: {
        const hx = shape.halfExtents!.x;
        const hy = shape.halfExtents!.y;
        for (let i = 0; i < 2; i++) {
          const d = i === 0 ? localDir.x : localDir.y;
          const o = i === 0 ? localOrigin.x : localOrigin.y;
          const h = i === 0 ? hx : hy;
          if (Math.abs(d) < 0.0001) {
            if (o < -h || o > h) return { hit: false, point: { x: 0, y: 0 }, normal: { x: 0, y: 0 }, distance: maxDistance, body: null };
          } else {
            const t1 = (-h - o) / d;
            const t2 = (h - o) / d;
            if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
            tmin = Math.max(tmin, t1);
            tmax = Math.min(tmax, t2);
            if (tmin > tmax) return { hit: false, point: { x: 0, y: 0 }, normal: { x: 0, y: 0 }, distance: maxDistance, body: null };
          }
        }
        const hitPoint = { x: origin.x + direction.x * tmin, y: origin.y + direction.y * tmin };
        const localHit = { x: localOrigin.x + localDir.x * tmin, y: localOrigin.y + localDir.y * tmin };
        let normal: Vec2;
        if (Math.abs(localHit.x) > Math.abs(localHit.y)) {
          normal = { x: cos * (localHit.x > 0 ? 1 : -1), y: sin * (localHit.x > 0 ? 1 : -1) };
        } else {
          normal = { x: -sin * (localHit.y > 0 ? 1 : -1), y: cos * (localHit.y > 0 ? 1 : -1) };
        }
        return { hit: true, point: hitPoint, normal, distance: tmin, body };
      }
      case CollisionShapeType.POLYGON: {
        for (let i = 0; i < shape.vertices!.length; i++) {
          const v1 = shape.vertices![i];
          const v2 = shape.vertices![(i + 1) % shape.vertices!.length];
          const edge = { x: v2.x - v1.x, y: v2.y - v1.y };
          const normal = { x: -edge.y, y: edge.x };
          const len = Math.hypot(normal.x, normal.y);
          if (len < 0.0001) continue;
          normal.x /= len; normal.y /= len;

          const num = (v1.x - localOrigin.x) * normal.x + (v1.y - localOrigin.y) * normal.y;
          const den = localDir.x * normal.x + localDir.y * normal.y;

          if (Math.abs(den) < 0.0001) {
            if (num < 0) return { hit: false, point: { x: 0, y: 0 }, normal: { x: 0, y: 0 }, distance: maxDistance, body: null };
          } else {
            const t = num / den;
            if (den < 0) {
              if (t > tmin) tmin = t;
            } else {
              if (t < tmax) tmax = t;
            }
            if (tmin > tmax) return { hit: false, point: { x: 0, y: 0 }, normal: { x: 0, y: 0 }, distance: maxDistance, body: null };
          }
        }
        const hitPoint = { x: origin.x + direction.x * tmin, y: origin.y + direction.y * tmin };
        const localHit = { x: localOrigin.x + localDir.x * tmin, y: localOrigin.y + localDir.y * tmin };
        let bestNormal: Vec2 = { x: 0, y: 0 };
        let bestDist = -Infinity;
        for (let i = 0; i < shape.vertices!.length; i++) {
          const v1 = shape.vertices![i];
          const v2 = shape.vertices![(i + 1) % shape.vertices!.length];
          const edge = { x: v2.x - v1.x, y: v2.y - v1.y };
          const normal = { x: -edge.y, y: edge.x };
          const len = Math.hypot(normal.x, normal.y);
          if (len < 0.0001) continue;
          normal.x /= len; normal.y /= len;
          const dist = (localHit.x - v1.x) * normal.x + (localHit.y - v1.y) * normal.y;
          if (dist > bestDist) {
            bestDist = dist;
            bestNormal = normal;
          }
        }
        const worldNormal = { x: cos * bestNormal.x - sin * bestNormal.y, y: sin * bestNormal.x + cos * bestNormal.y };
        return { hit: true, point: hitPoint, normal: worldNormal, distance: tmin, body };
      }
    }

    return { hit: false, point: { x: 0, y: 0 }, normal: { x: 0, y: 0 }, distance: maxDistance, body: null };
  }

  private filterMatches(body: CollisionBody, filter: CollisionFilter): boolean {
    return true; // Simplified
  }

  getBodies(): CollisionBody[] {
    return Array.from(this.bodies.values());
  }

  getBody(id: number): CollisionBody | undefined {
    return this.bodies.get(id);
  }

  getManifolds(): CollisionManifold[] {
    return this.manifolds;
  }
}

export interface ContactListener {
  onContactBegin?: (manifold: CollisionManifold) => void;
  onContactEnd?: (bodyA: CollisionBody, bodyB: CollisionBody) => void;
  onTriggerEnter?: (bodyA: CollisionBody, bodyB: CollisionBody) => void;
  onTriggerExit?: (bodyA: CollisionBody, bodyB: CollisionBody) => void;
}

export interface BodyDef {
  position: Vec2;
  rotation?: number;
  velocity?: Vec2;
  angularVelocity?: number;
  mass?: number;
  density?: number;
  shape: ShapeDef;
  material?: PhysicsMaterial;
  isStatic?: boolean;
  isTrigger?: boolean;
  userData?: unknown;
}

export interface ShapeDef {
  type: CollisionShapeType;
  radius?: number;
  halfExtents?: Vec2;
  vertices?: Vec2[];
  halfHeight?: number;
  centerA?: Vec2;
  centerB?: Vec2;
}

type CircleShape = CollisionShape & { type: CollisionShapeType.CIRCLE; radius: number };
type BoxShape = CollisionShape & { type: CollisionShapeType.BOX; halfExtents: Vec2 };
type PolygonShape = CollisionShape & { type: CollisionShapeType.POLYGON; vertices: Vec2[]; normals: Vec2[] };
type CapsuleShape = CollisionShape & { type: CollisionShapeType.CAPSULE; radius: number; centerA: Vec2; centerB: Vec2 };
type EdgeShape = CollisionShape & { type: CollisionShapeType.EDGE; vertices: Vec2[] };

export function createBoxShape(halfExtents: Vec2): CollisionShape {
  return { type: CollisionShapeType.BOX, halfExtents };
}

export function createCircleShape(radius: number): CollisionShape {
  return { type: CollisionShapeType.CIRCLE, radius };
}

export function createPolygonShape(vertices: Vec2[]): CollisionShape {
  const normals: Vec2[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const next = (i + 1) % vertices.length;
    const edge = MathUtils.vec2Sub(vertices[next], vertices[i]);
    const normal = MathUtils.vec2Normalize({ x: -edge.y, y: edge.x });
    normals.push(normal);
  }
  return { type: CollisionShapeType.POLYGON, vertices, normals };
}

export function createCapsuleShape(radius: number, halfHeight: number): CollisionShape {
  return {
    type: CollisionShapeType.CAPSULE,
    radius,
    centerA: { x: 0, y: -halfHeight },
    centerB: { x: 0, y: halfHeight },
  };
}

export function createEdgeShape(vertices: Vec2[]): CollisionShape {
  return { type: CollisionShapeType.EDGE, vertices };
}

export function createDefaultMaterial(): PhysicsMaterial {
  return { ...DEFAULT_MATERIAL };
}

export function createVehicleMaterial(): PhysicsMaterial {
  return { restitution: 0.1, staticFriction: 0.9, dynamicFriction: 0.7 };
}

export function createDriftMaterial(): PhysicsMaterial {
  return { restitution: 0.05, staticFriction: 0.5, dynamicFriction: 0.3 };
}

export function createIceMaterial(): PhysicsMaterial {
  return { restitution: 0.01, staticFriction: 0.1, dynamicFriction: 0.05 };
}