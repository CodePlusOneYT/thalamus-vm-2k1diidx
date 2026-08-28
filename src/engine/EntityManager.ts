/**
 * EntityManager.ts
 * Centralized entity lifecycle management for the game engine.
 * Handles creation, updating, destruction, and querying of game entities.
 */

import { Entity } from '../entities/Entity.js';

export interface EntityQuery {
  /** Component types that must all be present */
  all?: (new (...args: unknown[]) => unknown)[];
  /** At least one of these component types must be present */
  any?: (new (...args: unknown[]) => unknown)[];
  /** None of these component types should be present */
  none?: (new (...args: unknown[]) => unknown)[];
}

export class EntityManager {
  private entities: Map<string, Entity> = new Map();
  private entitiesToAdd: Entity[] = [];
  private entitiesToRemove: Set<string> = new Set();
  private entityGroups: Map<string, Set<string>> = new Map();
  private componentIndex: Map<new (...args: unknown[]) => unknown, Set<string>> = new Map();
  private isUpdating: boolean = false;

  /**
   * Register an entity with the manager
   * @param entity The entity to register
   * @returns The entity's unique ID
   */
  add(entity: Entity): string {
    const id = entity.id;
    
    if (this.entities.has(id)) {
      console.warn(`Entity with ID ${id} already exists, replacing`);
      this.remove(id);
    }

    if (this.isUpdating) {
      this.entitiesToAdd.push(entity);
    } else {
      this.registerEntity(entity);
    }

    return id;
  }

  /**
   * Internal registration without deferral
   */
  private registerEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
    this.indexEntityComponents(entity);
    entity.onAddedToManager(this);
    entity.awake();
  }

  /**
   * Remove an entity by ID
   * @param id The entity ID to remove
   * @returns True if entity was found and removed
   */
  remove(id: string): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;

    if (this.isUpdating) {
      this.entitiesToRemove.add(id);
    } else {
      this.unregisterEntity(entity);
    }

    return true;
  }

  /**
   * Internal unregistration without deferral
   */
  private unregisterEntity(entity: Entity): void {
    entity.onRemovedFromManager(this);
    entity.destroy();
    this.deindexEntityComponents(entity);
    this.entities.delete(entity.id);
    
    // Remove from all groups
    for (const group of this.entityGroups.values()) {
      group.delete(entity.id);
    }
  }

  /**
   * Get an entity by ID
   */
  get(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  /**
   * Check if an entity exists
   */
  has(id: string): boolean {
    return this.entities.has(id);
  }

  /**
   * Get all entities
   */
  getAll(): Entity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Get count of active entities
   */
  getCount(): number {
    return this.entities.size;
  }

  /**
   * Query entities by component composition
   */
  query(query: EntityQuery): Entity[] {
    let candidates: Set<string> | undefined;

    // Start with entities that have ALL required components
    if (query.all && query.all.length > 0) {
      for (const componentType of query.all) {
        const indexed = this.componentIndex.get(componentType);
        if (!indexed || indexed.size === 0) {
          return []; // No entities have this component
        }
        if (!candidates) {
          candidates = new Set(indexed);
        } else {
          // Intersection
          for (const id of candidates) {
            if (!indexed.has(id)) {
              candidates.delete(id);
            }
          }
        }
        if (candidates.size === 0) return [];
      }
    } else {
      // No 'all' constraint - start with all entities
      candidates = new Set(this.entities.keys());
    }

    // Filter by ANY components
    if (query.any && query.any.length > 0 && candidates) {
      const anySet = new Set<string>();
      for (const componentType of query.any) {
        const indexed = this.componentIndex.get(componentType);
        if (indexed) {
          for (const id of indexed) {
            anySet.add(id);
          }
        }
      }
      // Intersection with candidates
      for (const id of candidates) {
        if (!anySet.has(id)) {
          candidates.delete(id);
        }
      }
    }

    // Filter by NONE components
    if (query.none && query.none.length > 0 && candidates) {
      for (const componentType of query.none) {
        const indexed = this.componentIndex.get(componentType);
        if (indexed) {
          for (const id of indexed) {
            candidates.delete(id);
          }
        }
      }
    }

    if (!candidates) return [];

    return Array.from(candidates)
      .map(id => this.entities.get(id))
      .filter((e): e is Entity => e !== undefined);
  }

  /**
   * Get first entity matching query
   */
  queryFirst(query: EntityQuery): Entity | undefined {
    const results = this.query(query);
    return results[0];
  }

  /**
   * Add entity to a named group
   */
  addToGroup(entityId: string, groupName: string): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) return false;

    let group = this.entityGroups.get(groupName);
    if (!group) {
      group = new Set();
      this.entityGroups.set(groupName, group);
    }
    group.add(entityId);
    return true;
  }

  /**
   * Remove entity from a group
   */
  removeFromGroup(entityId: string, groupName: string): boolean {
    const group = this.entityGroups.get(groupName);
    if (!group) return false;
    return group.delete(entityId);
  }

  /**
   * Get all entities in a group
   */
  getGroup(groupName: string): Entity[] {
    const group = this.entityGroups.get(groupName);
    if (!group) return [];
    return Array.from(group)
      .map(id => this.entities.get(id))
      .filter((e): e is Entity => e !== undefined);
  }

  /**
   * Check if entity is in group
   */
  inGroup(entityId: string, groupName: string): boolean {
    const group = this.entityGroups.get(groupName);
    return group?.has(entityId) ?? false;
  }

  /**
   * Clear a group
   */
  clearGroup(groupName: string): void {
    this.entityGroups.delete(groupName);
  }

  /**
   * Update all entities
   * @param deltaTime Time since last update in seconds
   */
  update(deltaTime: number): void {
    this.isUpdating = true;

    // Update all active entities
    for (const entity of this.entities.values()) {
      if (entity.active) {
        entity.update(deltaTime);
      }
    }

    // Late update pass
    for (const entity of this.entities.values()) {
      if (entity.active) {
        entity.lateUpdate(deltaTime);
      }
    }

    this.isUpdating = false;
    this.processDeferredOperations();
  }

  /**
   * Fixed timestep update for physics
   * @param fixedDeltaTime Fixed time step in seconds
   */
  fixedUpdate(fixedDeltaTime: number): void {
    this.isUpdating = true;

    for (const entity of this.entities.values()) {
      if (entity.active) {
        entity.fixedUpdate(fixedDeltaTime);
      }
    }

    this.isUpdating = false;
    this.processDeferredOperations();
  }

  /**
   * Process deferred add/remove operations
   */
  private processDeferredOperations(): void {
    // Process removals first
    for (const id of this.entitiesToRemove) {
      const entity = this.entities.get(id);
      if (entity) {
        this.unregisterEntity(entity);
      }
    }
    this.entitiesToRemove.clear();

    // Process additions
    for (const entity of this.entitiesToAdd) {
      this.registerEntity(entity);
    }
    this.entitiesToAdd.length = 0;
  }

  /**
   * Index entity's components for fast querying
   */
  private indexEntityComponents(entity: Entity): void {
    for (const componentType of entity.getComponentTypes()) {
      let index = this.componentIndex.get(componentType);
      if (!index) {
        index = new Set();
        this.componentIndex.set(componentType, index);
      }
      index.add(entity.id);
    }
  }

  /**
   * Remove entity from component indices
   */
  private deindexEntityComponents(entity: Entity): void {
    for (const componentType of entity.getComponentTypes()) {
      const index = this.componentIndex.get(componentType);
      if (index) {
        index.delete(entity.id);
        if (index.size === 0) {
          this.componentIndex.delete(componentType);
        }
      }
    }
  }

  /**
   * Refresh component index for an entity (call after adding/removing components)
   */
  refreshEntityIndex(entity: Entity): void {
    this.deindexEntityComponents(entity);
    this.indexEntityComponents(entity);
  }

  /**
   * Destroy all entities and clear the manager
   */
  clear(): void {
    // Destroy all entities immediately
    for (const entity of this.entities.values()) {
      entity.onRemovedFromManager(this);
      entity.destroy();
    }
    this.entities.clear();
    this.entityGroups.clear();
    this.componentIndex.clear();
    this.entitiesToAdd.length = 0;
    this.entitiesToRemove.clear();
  }

  /**
   * Get debug info
   */
  getDebugInfo(): object {
    return {
      entityCount: this.entities.size,
      groupCount: this.entityGroups.size,
      componentTypeCount: this.componentIndex.size,
      pendingAdditions: this.entitiesToAdd.length,
      pendingRemovals: this.entitiesToRemove.size,
      groups: Object.fromEntries(
        Array.from(this.entityGroups.entries()).map(([name, set]) => [name, set.size])
      ),
      components: Object.fromEntries(
        Array.from(this.componentIndex.entries()).map(([type, set]) => [type.name, set.size])
      ),
    };
  }
}