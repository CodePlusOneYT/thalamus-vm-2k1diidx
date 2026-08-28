/**
 * SceneManager - Handles scene transitions and manages active game scenes
 * Card Drive & Drift Game Engine
 */

import { Entity } from '../entities/Entity.js';
import { EntityManager } from './EntityManager.js';
import { InputManager } from './InputManager.js';

export type SceneState = 'menu' | 'garage' | 'race' | 'results' | 'loading';

export interface Scene {
  name: string;
  state: SceneState;
  
  /** Called when scene becomes active */
  onEnter(): void;
  
  /** Called every frame while scene is active */
  onUpdate(deltaTime: number): void;
  
  /** Called when scene becomes inactive */
  onExit(): void;
  
  /** Called when input events occur while scene is active */
  onInput(event: InputEvent): void;
}

export class SceneManager {
  private static instance: SceneManager;
  
  private currentScene: Scene | null = null;
  private previousScene: Scene | null = null;
  private pendingScene: Scene | null = null;
  private transitionProgress: number = 0;
  private isTransitioning: boolean = false;
  private transitionDuration: number = 0.3; // seconds
  
  private readonly scenes: Map<string, () => Scene> = new Map();
  private readonly entityManagers: Map<SceneState, EntityManager> = new Map();
  
  private constructor() {}
  
  /** Get singleton instance */
  static getInstance(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager();
    }
    return SceneManager.instance;
  }
  
  /** Register a scene factory function */
  registerScene(sceneName: string, factory: () => Scene): void {
    this.scenes.set(sceneName, factory);
    
    // Create entity manager for this scene's state
    const sceneInstance = factory();
    if (!this.entityManagers.has(sceneInstance.state)) {
      this.entityManagers.set(sceneInstance.state, new EntityManager());
    }
  }
  
  /** Switch to a new scene by name */
  async switchScene(sceneName: string, options?: {
    duration?: number;
    instant?: boolean;
  }): Promise<void> {
    const factory = this.scenes.get(sceneName);
    if (!factory) {
      console.error(`SceneManager: Scene "${sceneName}" not registered`);
      return;
    }
    
    const newScene = factory();
    const newState = newScene.state;
    
    // Validate transition
    if (!this.isValidTransition(newState)) {
      console.warn(`SceneManager: Invalid transition to ${newState}`);
      return;
    }
    
    const instant = options?.instant ?? false;
    const duration = options?.duration ?? this.transitionDuration;
    
    if (instant || this.currentScene === null) {
      // Instant transition or first scene
      await this.performInstantSwitch(newScene, newState);
      return;
    }
    
    // Scheduled transition with fade effect
    this.pendingScene = newScene;
    this.isTransitioning = true;
    this.transitionProgress = 0;
    
    const startTime = performance.now();
    const startTransition = () => {
      const now = performance.now();
      const elapsed = (now - startTime) / 1000;
      
      if (elapsed >= duration) {
        this.transitionProgress = 1;
        this.completeTransition();
      } else {
        this.transitionProgress = Math.min(elapsed / duration, 1);
        requestAnimationFrame(startTransition);
      }
    };
    
    requestAnimationFrame(startTransition);
  }
  
  private isValidTransition(targetState: SceneState): boolean {
    const validTransitions: Record<SceneState, SceneState[]> = {
      menu: ['garage', 'race'],
      garage: ['menu', 'race'],
      race: ['results', 'menu', 'garage'],
      results: ['menu', 'garage', 'race'],
      loading: ['menu', 'garage', 'race']
    };
    
    if (this.currentScene === null) {
      return true; // First scene can be any
    }
    
    const allowed = validTransitions[this.currentScene.state];
    return allowed?.includes(targetState) ?? false;
  }
  
  private async performInstantSwitch(newScene: Scene, newState: SceneState): Promise<void> {
    if (this.currentScene !== null) {
      this.cleanupCurrentScene();
    }
    
    this.previousScene = this.currentScene;
    this.currentScene = newScene;
    
    // Clean up old scene entities
    this.entityManagers.get(newState)?.clear();
    
    newScene.onEnter();
    
    this.isTransitioning = false;
    this.pendingScene = null;
  }
  
  private completeTransition(): void {
    if (this.pendingScene) {
      this.cleanupCurrentScene();
      this.previousScene = this.currentScene;
      this.currentScene = this.pendingScene;
      this.pendingScene = null;
      
      const newState = this.currentScene.state;
      this.entityManagers.get(newState)?.clear();
      
      this.currentScene.onEnter();
    }
    
    this.isTransitioning = false;
    this.transitionProgress = 0;
  }
  
  private cleanupCurrentScene(): void {
    if (this.currentScene) {
      this.currentScene.onExit();
      this.currentScene = null;
    }
  }
  
  /** Get the currently active scene */
  getCurrentScene(): Scene | null {
    return this.currentScene;
  }
  
  /** Get the entity manager for a specific scene state */
  getEntityManager(state: SceneState): EntityManager | undefined {
    return this.entityManagers.get(state);
  }
  
  /** Check if a transition is currently happening */
  isTransition(): boolean {
    return this.isTransitioning;
  }
  
  /** Get transition progress (0-1) */
  getTransitionProgress(): number {
    return this.transitionProgress;
  }
  
  /** Update the scene manager (call every frame) */
  update(deltaTime: number): void {
    if (this.isTransitioning && this.currentScene) {
      this.currentScene.onUpdate(deltaTime);
    } else if (this.currentScene) {
      this.currentScene.onUpdate(deltaTime);
    }
  }
  
  /** Handle input events */
  handleInput(event: InputEvent): void {
    if (this.currentScene) {
      this.currentScene.onInput(event);
    }
  }
  
  /** Reset all scenes and managers */
  reset(): void {
    this.cleanupCurrentScene();
    this.entityManagers.forEach(manager => manager.clear());
    this.entityManagers.clear();
    this.scenes.clear();
    this.isTransitioning = false;
    this.transitionProgress = 0;
  }
}

/** Input event types */
export class InputEvent {
  type: 'keydown' | 'keyup' | 'touchstart' | 'touchend' | 'mousemove' | 'mousedown' | 'mouseup';
  key?: string;
  button?: number;
  x?: number;
  y?: number;
  
  constructor(type: InputEvent['type'], data?: Partial<InputEvent>) {
    this.type = type;
    Object.assign(this, data);
  }
}

export default SceneManager;