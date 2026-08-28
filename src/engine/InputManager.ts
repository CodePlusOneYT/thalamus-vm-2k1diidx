/**
 * InputManager - Handles keyboard, touch, and mouse input for the Card Drive & Drift game
 * Provides unified input state management with proper mobile support
 */
export class InputManager {
  private keys: Set<string>;
  private mouseX: number;
  private mouseY: number;
  private mouseDown: boolean;
  private touchStartX: number;
  private touchStartY: number;
  private touchCurrentX: number;
  private touchCurrentY: number;
  private touchActive: boolean;
  
  // Game-specific input states
  private throttlePressed: boolean;
  private brakePressed: boolean;
  private driftLeftPressed: boolean;
  private driftRightPressed: boolean;
  private nitroPressed: boolean;
  private pausePressed: boolean;
  private restartPressed: boolean;
  private cameraTogglePressed: boolean;

  constructor() {
    this.keys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchCurrentX = 0;
    this.touchCurrentY = 0;
    this.touchActive = false;
    
    this.throttlePressed = false;
    this.brakePressed = false;
    this.driftLeftPressed = false;
    this.driftRightPressed = false;
    this.nitroPressed = false;
    this.pausePressed = false;
    this.restartPressed = false;
    this.cameraTogglePressed = false;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Keyboard events
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));
    
    // Mouse events
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('mousedown', () => this.onMouseDown());
    document.addEventListener('mouseup', () => this.onMouseUp());
    document.addEventListener('mouseleave', () => this.onMouseLeave());
    
    // Touch events
    document.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    document.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    document.addEventListener('touchend', () => this.onTouchEnd());
    document.addEventListener('touchcancel', () => this.onTouchCancel());
  }

  private onKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    this.keys.add(key);
    
    // Prevent default for game controls
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(key)) {
      event.preventDefault();
    }

    // Update game-specific states
    switch (key) {
      case 'w':
      case 'arrowup':
        this.throttlePressed = true;
        break;
      case 's':
      case 'arrowdown':
        this.brakePressed = true;
        break;
      case 'a':
      case 'arrowleft':
        this.driftLeftPressed = true;
        break;
      case 'd':
      case 'arrowright':
        this.driftRightPressed = true;
        break;
      case 'shift':
      case ' ':
        this.nitroPressed = true;
        break;
      case 'p':
        this.pausePressed = true;
        break;
      case 'r':
        this.restartPressed = true;
        break;
      case 'c':
        this.cameraTogglePressed = true;
        break;
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    this.keys.delete(key);
    
    // Clear game-specific states
    switch (key) {
      case 'w':
      case 'arrowup':
        this.throttlePressed = false;
        break;
      case 's':
      case 'arrowdown':
        this.brakePressed = false;
        break;
      case 'a':
      case 'arrowleft':
        this.driftLeftPressed = false;
        break;
      case 'd':
      case 'arrowright':
        this.driftRightPressed = false;
        break;
      case 'shift':
      case ' ':
        this.nitroPressed = false;
        break;
    }
  }

  private onMouseMove(event: MouseEvent): void {
    this.mouseX = event.clientX;
    this.mouseY = event.clientY;
  }

  private onMouseDown(): void {
    this.mouseDown = true;
  }

  private onMouseUp(): void {
    this.mouseDown = false;
  }

  private onMouseLeave(): void {
    this.mouseDown = false;
  }

  private onTouchStart(event: TouchEvent): void {
    event.preventDefault();
    if (event.touches.length > 0) {
      this.touchActive = true;
      this.touchStartX = event.touches[0].clientX;
      this.touchStartY = event.touches[0].clientY;
      
      // Mobile control mapping
      if (this.touchStartX < window.innerWidth / 3) {
        this.throttlePressed = true;
      } else if (this.touchStartX > (window.innerWidth / 3) * 2) {
        this.brakePressed = true;
      } else {
        this.driftLeftPressed = true;
      }
    }
  }

  private onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    if (event.touches.length > 0) {
      this.touchCurrentX = event.touches[0].clientX;
      this.touchCurrentY = event.touches[0].clientY;
    }
  }

  private onTouchEnd(): void {
    this.touchActive = false;
    this.throttlePressed = false;
    this.brakePressed = false;
    this.driftLeftPressed = false;
    this.driftRightPressed = false;
  }

  private onTouchCancel(): void {
    this.onTouchEnd();
  }

  // Public API - Get individual input states
  isThrottlePressed(): boolean { return this.throttlePressed; }
  isBrakePressed(): boolean { return this.brakePressed; }
  isDriftLeftPressed(): boolean { return this.driftLeftPressed; }
  isDriftRightPressed(): boolean { return this.driftRightPressed; }
  isNitroPressed(): boolean { return this.nitroPressed; }
  isPausePressed(): boolean { return this.pausePressed; }
  isRestartPressed(): boolean { return this.restartPressed; }
  isCameraTogglePressed(): boolean { return this.cameraTogglePressed; }

  // Get combined steering value (-1 to 1)
  getSteeringValue(): number {
    const leftVal = this.driftLeftPressed ? 1 : 0;
    const rightVal = this.driftRightPressed ? 1 : 0;
    return leftVal - rightVal;
  }

  // Get movement value (throttle vs brake)
  getMovementValue(): number {
    const throttleVal = this.throttlePressed ? 1 : 0;
    const brakeVal = this.brakePressed ? 1 : 0;
    return throttleVal - brakeVal;
  }

  // Check if any key is pressed
  isKeyPressed(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  // Get all currently pressed keys
  getPressedKeys(): Set<string> {
    return new Set(this.keys);
  }

  // Reset all inputs (useful for scene transitions)
  reset(): void {
    this.keys.clear();
    this.throttlePressed = false;
    this.brakePressed = false;
    this.driftLeftPressed = false;
    this.driftRightPressed = false;
    this.nitroPressed = false;
    this.pausePressed = false;
    this.restartPressed = false;
    this.cameraTogglePressed = false;
  }

  // Cleanup
  destroy(): void {
    document.removeEventListener('keydown', (e) => this.onKeyDown(e));
    document.removeEventListener('keyup', (e) => this.onKeyUp(e));
    document.removeEventListener('mousemove', (e) => this.onMouseMove(e));
    document.removeEventListener('mousedown', () => this.onMouseDown());
    document.removeEventListener('mouseup', () => this.onMouseUp());
    document.removeEventListener('mouseleave', () => this.onMouseLeave());
    document.removeEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    document.removeEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    document.removeEventListener('touchend', () => this.onTouchEnd());
    document.removeEventListener('touchcancel', () => this.onTouchCancel());
  }
}