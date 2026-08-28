import { Vector2, Vector3, Quaternion, Matrix4 } from '../physics/MathUtils';

/**
 * Entity Component System (ECS) Foundation
 * Base class for all game entities with transform, components, and lifecycle management
 */
export type EntityType = 'vehicle' | 'track' | 'particle' | 'camera' | 'obstacle' | 'collectible' | 'decoration';

export interface TransformComponent {
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
}

export interface PhysicsComponent {
  mass: number;
  friction: number;
  restitution: number;
  isDynamic: boolean;
}

export interface RenderableComponent {
  visible: boolean;
  layer: number;
  zIndex: number;
}

export interface ScriptComponent {
  enabled: boolean;
  onUpdate(deltaTime: number): void;
  onFixedUpdate(deltaTime: number): void;
  onDestroy(): void;
}

export abstract class Entity {
  public readonly id: string;
  public readonly type: EntityType;
  
  private _transform: TransformComponent;
  private _physics: PhysicsComponent;
  private _renderable: RenderableComponent;
  private _script?: ScriptComponent;
  private _parent: Entity | null = null;
  private _children: Set<Entity> = new Set();
  private _isActive: boolean = true;
  private _isDestroyed: boolean = false;

  constructor(type: EntityType, initialPosition: Vector3 = new Vector3(0, 0, 0)) {
    this.id = `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.type = type;
    
    this._transform = {
      position: initialPosition.clone(),
      rotation: Quaternion.identity(),
      scale: Vector3.one()
    };
    
    this._physics = {
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      isDynamic: true
    };
    
    this._renderable = {
      visible: true,
      layer: 0,
      zIndex: 0
    };
  }

  // Transform getters/setters
  get transform(): Readonly<TransformComponent> {
    return this._transform;
  }

  set position(value: Vector3) {
    this._transform.position.set(value.x, value.y, value.z);
  }

  get position(): Vector3 {
    return this._transform.position;
  }

  set rotation(value: Quaternion) {
    this._transform.rotation.copy(value);
  }

  get rotation(): Quaternion {
    return this._transform.rotation;
  }

  set scale(value: Vector3) {
    this._transform.scale.set(value.x, value.y, value.z);
  }

  get scale(): Vector3 {
    return this._transform.scale;
  }

  // World transforms
  get worldPosition(): Vector3 {
    const result = new Vector3();
    const rotated = this.transform.position.clone();
    this.transform.rotation.applyToVector(rotated);
    result.add(rotated.multiplyScalar(this.transform.scale));
    if (this._parent) {
      result.add(this._parent.worldPosition);
    }
    return result;
  }

  get worldRotation(): Quaternion {
    let result = this.transform.rotation.clone();
    if (this._parent) {
      const parentRot = this._parent.worldRotation;
      result.multiply(parentRot);
    }
    return result;
  }

  get worldScale(): Vector3 {
    let result = this.transform.scale.clone();
    if (this._parent) {
      const parentScale = this._parent.worldScale;
      result.multiply(parentScale);
    }
    return result;
  }

  // Physics component
  get physics(): Readonly<PhysicsComponent> {
    return this._physics;
  }

  setMass(mass: number): void {
    this._physics.mass = Math.max(0, mass);
  }

  setFriction(friction: number): void {
    this._physics.friction = Math.max(0, Math.min(1, friction));
  }

  setRestitution(restitution: number): void {
    this._physics.restitution = Math.max(0, Math.min(1, restitution));
  }

  // Renderable component
  get renderable(): Readonly<RenderableComponent> {
    return this._renderable;
  }

  setVisible(visible: boolean): void {
    this._renderable.visible = visible;
  }

  setLayer(layer: number): void {
    this._renderable.layer = layer;
  }

  setZIndex(zIndex: number): void {
    this._renderable.zIndex = zIndex;
  }

  // Script component
  setScript(script: ScriptComponent): void {
    this._script = script;
  }

  getScript(): ScriptComponent | undefined {
    return this._script;
  }

  // Lifecycle
  update(deltaTime: number): void {
    if (!this._isActive || this._isDestroyed) return;
    this._script?.onUpdate(deltaTime);
  }

  fixedUpdate(deltaTime: number): void {
    if (!this._isActive || this._isDestroyed) return;
    this._script?.onFixedUpdate(deltaTime);
  }

  destroy(): void {
    if (this._isDestroyed) return;
    
    this._isDestroyed = true;
    this._script?.onDestroy();
    
    // Destroy children first
    for (const child of this._children) {
      child.destroy();
    }
    this._children.clear();
    
    // Remove from parent
    if (this._parent) {
      this._parent.removeChild(this);
    }
  }

  // Parent-child hierarchy
  attach(parent: Entity): void {
    if (this._parent) {
      this._parent.removeChild(this);
    }
    this._parent = parent;
    parent.addChild(this);
  }

  addChild(child: Entity): void {
    if (child._parent) {
      child._parent.removeChild(child);
    }
    child._parent = this;
    this._children.add(child);
  }

  removeChild(child: Entity): void {
    this._children.delete(child);
    child._parent = null;
  }

  getChild(id: string): Entity | null {
    for (const child of this._children) {
      if (child.id === id) {
        return child;
      }
    }
    return null;
  }

  getAllChildren(type?: EntityType): Entity[] {
    const results: Entity[] = [];
    for (const child of this._children) {
      if (!type || child.type === type) {
        results.push(child);
      }
      results.push(...child.getAllChildren(type));
    }
    return results;
  }

  // State management
  isActive(): boolean {
    return this._isActive && !this._isDestroyed;
  }

  activate(): void {
    this._isActive = true;
  }

  deactivate(): void {
    this._isActive = false;
  }

  // Clone (for entity pooling or duplication)
  clone(): Entity {
    const cloned = new Entity(this.type, this.position.clone());
    cloned.transform.rotation.copy(this.rotation);
    cloned.transform.scale.copy(this.scale);
    cloned.physics.mass = this.physics.mass;
    cloned.physics.friction = this.physics.friction;
    cloned.physics.restitution = this.physics.restitution;
    cloned.renderable.visible = this.renderable.visible;
    cloned.renderable.layer = this.renderable.layer;
    cloned.renderable.zIndex = this.renderable.zIndex;
    return cloned;
  }

  // Debug info
  toString(): string {
    return `Entity(${this.type}, ${this.id}, pos:${this.position.toString()}, active:${this._isActive})`;
  }
}
