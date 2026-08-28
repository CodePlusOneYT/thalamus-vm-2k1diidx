/**
 * VehiclePhysics.ts
 * Advanced vehicle physics simulation for Card Drive & Drift
 * Handles drivetrain, suspension, tire forces, aerodynamics, and drift mechanics
 */

import { Vector2, MathUtils } from './MathUtils.js';

export interface VehicleConfig {
  // Mass and inertia
  mass: number;                    // kg
  inertia: number;                 // kg*m^2 (yaw inertia)
  
  // Dimensions
  wheelbase: number;               // Distance between front and rear axles (m)
  trackWidth: number;              // Distance between left and right wheels (m)
  cgHeight: number;                // Center of gravity height (m)
  cgToFront: number;               // CG distance from front axle (m)
  
  // Engine
  maxEngineTorque: number;         // Nm
  maxEngineRPM: number;            // RPM
  idleRPM: number;                 // RPM
  redlineRPM: number;              // RPM
  engineInertia: number;           // kg*m^2
  torqueCurve: [number, number][]; // [RPM, torque multiplier 0-1]
  
  // Transmission
  gearRatios: number[];            // Gear ratios (including reverse at index 0)
  finalDriveRatio: number;         // Differential ratio
  shiftUpRPM: number;              // RPM to shift up
  shiftDownRPM: number;            // RPM to shift down
  clutchStrength: number;          // Clutch torque capacity (Nm)
  transmissionEfficiency: number;  // 0-1
  
  // Differential
  diffType: 'open' | 'lsd' | 'locked'; // Differential type
  lsdPreload: number;              // LSD preload torque (Nm)
  lsdRampAngle: number;            // LSD ramp angle (degrees)
  
  // Suspension (per wheel)
  springRate: number;              // N/m
  damperRateBump: number;          // N*s/m (compression)
  damperRateRebound: number;       // N*s/m (extension)
  springPreload: number;           // N
  maxSuspensionTravel: number;     // m
  suspensionRestLength: number;    // m
  
  // Anti-roll bars
  frontAntiRollBar: number;        // Nm/rad
  rearAntiRollBar: number;         // Nm/rad
  
  // Tires (Pacejka Magic Formula coefficients)
  tireConfig: {
    // Longitudinal (acceleration/braking)
    Bx: number; Cx: number; Dx: number; Ex: number;
    // Lateral (cornering)
    By: number; Cy: number; Dy: number; Ey: number;
    // Aligning moment
    Bz: number; Cz: number; Dz: number; Ez: number;
    // Combined slip
    BxAlpha: number; ByAlpha: number;
    // Load sensitivity
    Fz0: number;                   // Nominal load (N)
    loadSensitivity: number;       // How grip changes with load
    // Camber
    camberStiffness: number;       // N/deg
    // Slip angle at peak grip (degrees)
    peakSlipAngle: number;
    // Slip ratio at peak grip
    peakSlipRatio: number;
    // Drift characteristics
    driftSlipAngle: number;        // Slip angle for sustained drift (deg)
    driftFalloff: number;          // How quickly grip drops past peak
  };
  
  // Aerodynamics
  dragCoefficient: number;         // Cd
  frontalArea: number;             // m^2
  liftCoefficientFront: number;    // Cl front
  liftCoefficientRear: number;     // Cl rear
  aeroBalance: number;             // 0-1 (front downforce bias)
  
  // Brakes
  brakeForceFront: number;         // N (max)
  brakeForceRear: number;          // N (max)
  brakeBias: number;               // 0-1 (front bias)
  absEnabled: boolean;
  absSlipThreshold: number;        // Slip ratio for ABS activation
  
  // Steering
  maxSteerAngle: number;           // Radians
  steerRatio: number;              // Steering wheel : wheel ratio
  ackermannFactor: number;         // 0-1 (Ackermann geometry)
  speedSensitivity: number;        // Steering reduction at speed
  
  // Drift assist / physics
  driftAssist: number;             // 0-1 (counter-steer assist)
  handbrakeForce: number;          // N (rear only)
  handbrakeLockup: number;         // 0-1 (rear lockup amount)
}

export interface WheelState {
  // Position relative to vehicle center
  localPosition: Vector2;
  
  // Suspension
  suspensionLength: number;        // Current length (m)
  suspensionVelocity: number;      // m/s (positive = extending)
  suspensionForce: number;         // N
  isGrounded: boolean;
  groundNormal: Vector2;
  groundMaterial: number;          // Material index for friction/sound
  
  // Wheel rotation
  rotationAngle: number;           // Radians
  angularVelocity: number;         // Rad/s
  radius: number;                  // m
  width: number;                   // m
  
  // Slip
  slipRatio: number;               // Longitudinal slip (-1 to 1)
  slipAngle: number;               // Lateral slip angle (radians)
  camberAngle: number;             // Radians
  
  // Forces
  longitudinalForce: number;       // N (forward/backward)
  lateralForce: number;            // N (sideways)
  aligningMoment: number;          // Nm (self-aligning torque)
  verticalLoad: number;            // N (normal force)
  
  // Temperature and wear
  temperature: number;             // Celsius
  wear: number;                    // 0-1
  
  // Input
  brakePressure: number;           // 0-1
  driveTorque: number;             // Nm (from engine)
  steeringAngle: number;           // Radians
}

export interface VehicleState {
  // Chassis
  position: Vector2;
  velocity: Vector2;
  angularVelocity: number;         // Yaw rate (rad/s)
  heading: number;                 // Radians
  
  // Engine
  engineRPM: number;
  engineTorque: number;
  throttle: number;                // 0-1
  currentGear: number;             // 0 = neutral, -1 = reverse, 1+ = forward
  clutchSlip: number;              // 0-1
  
  // Wheels (FL, FR, RL, RR)
  wheels: WheelState[];
  
  // Derived
  speed: number;                   // m/s
  speedKPH: number;                // km/h
  slipAngle: number;               // Vehicle body slip angle (radians)
  lateralG: number;                // Lateral acceleration (g)
  longitudinalG: number;           // Longitudinal acceleration (g)
  
  // Drift state
  isDrifting: boolean;
  driftAngle: number;              // Degrees
  driftScore: number;              // Current drift combo score
  driftMultiplier: number;         // Score multiplier
  counterSteerAngle: number;       // Degrees
  
  // Damage/wear
  engineHealth: number;            // 0-1
  transmissionHealth: number;      // 0-1
  tireWear: number[];              // Per tire 0-1
}

export interface VehicleInput {
  throttle: number;                // 0-1
  brake: number;                   // 0-1
  steering: number;                // -1 to 1
  handbrake: boolean;
  clutch: number;                  // 0-1 (0 = engaged, 1 = disengaged)
  shiftUp: boolean;
  shiftDown: boolean;
}

export class VehiclePhysics {
  private config: VehicleConfig;
  private state: VehicleState;
  private airDensity = 1.225;      // kg/m^3 at sea level
  private gravity = 9.81;
  
  // Drift detection
  private driftThreshold = 0.15;   // Radians (~8.5 deg)
  private driftExitThreshold = 0.08; // Radians (~4.5 deg)
  private driftTime = 0;
  private lastDriftAngle = 0;
  
  // Audio/VFX callbacks
  public onEngineSound?: (rpm: number, load: number) => void;
  public onTireSqueal?: (wheelIndex: number, intensity: number) => void;
  public onCollision?: (impulse: number) => void;
  public onDriftStart?: () => void;
  public onDriftEnd?: (score: number) => void;
  
  constructor(config: VehicleConfig) {
    this.config = this.validateConfig(config);
    this.state = this.createInitialState();
  }
  
  private validateConfig(config: VehicleConfig): VehicleConfig {
    // Ensure all required fields have sensible defaults
    const defaults: Partial<VehicleConfig> = {
      mass: 1400,
      inertia: 2800,
      wheelbase: 2.6,
      trackWidth: 1.6,
      cgHeight: 0.5,
      cgToFront: 1.3,
      maxEngineTorque: 400,
      maxEngineRPM: 8000,
      idleRPM: 800,
      redlineRPM: 7500,
      engineInertia: 0.5,
      torqueCurve: [
        [0, 0.4], [1000, 0.6], [2000, 0.8], [3000, 0.95],
        [4000, 1.0], [5000, 0.98], [6000, 0.9], [7000, 0.75], [8000, 0.5]
      ],
      gearRatios: [-3.5, 0, 3.8, 2.2, 1.5, 1.1, 0.9],
      finalDriveRatio: 3.7,
      shiftUpRPM: 6800,
      shiftDownRPM: 3000,
      clutchStrength: 500,
      transmissionEfficiency: 0.92,
      diffType: 'lsd',
      lsdPreload: 50,
      lsdRampAngle: 45,
      springRate: 35000,
      damperRateBump: 3000,
      damperRateRebound: 4500,
      springPreload: 2000,
      maxSuspensionTravel: 0.15,
      suspensionRestLength: 0.3,
      frontAntiRollBar: 15000,
      rearAntiRollBar: 10000,
      tireConfig: {
        Bx: 10, Cx: 1.9, Dx: 1.0, Ex: 0.97,
        By: 10, Cy: 1.9, Dy: 1.0, Ey: 0.97,
        Bz: 10, Cz: 2.0, Dz: 0.08, Ez: 0.9,
        BxAlpha: 0.0, ByAlpha: 0.0,
        Fz0: 3500,
        loadSensitivity: 0.8,
        camberStiffness: 1000,
        peakSlipAngle: 8,
        peakSlipRatio: 0.15,
        driftSlipAngle: 25,
        driftFalloff: 0.3
      },
      dragCoefficient: 0.32,
      frontalArea: 2.2,
      liftCoefficientFront: -0.1,
      liftCoefficientRear: -0.15,
      aeroBalance: 0.5,
      brakeForceFront: 8000,
      brakeForceRear: 6000,
      brakeBias: 0.65,
      absEnabled: true,
      absSlipThreshold: 0.2,
      maxSteerAngle: MathUtils.degToRad(35),
      steerRatio: 16,
      ackermannFactor: 0.3,
      speedSensitivity: 0.5,
      driftAssist: 0.3,
      handbrakeForce: 4000,
      handbrakeLockup: 0.9
    };
    
    return { ...defaults, ...config } as VehicleConfig;
  }
  
  private createInitialState(): VehicleState {
    const wheels: WheelState[] = [
      // Front Left
      { localPosition: new Vector2(-this.config.trackWidth / 2, this.config.cgToFront), suspensionLength: this.config.suspensionRestLength, suspensionVelocity: 0, suspensionForce: 0, isGrounded: false, groundNormal: new Vector2(0, 1), groundMaterial: 0, rotationAngle: 0, angularVelocity: 0, radius: 0.33, width: 0.22, slipRatio: 0, slipAngle: 0, camberAngle: 0, longitudinalForce: 0, lateralForce: 0, aligningMoment: 0, verticalLoad: 0, temperature: 20, wear: 0, brakePressure: 0, driveTorque: 0, steeringAngle: 0 },
      // Front Right
      { localPosition: new Vector2(this.config.trackWidth / 2, this.config.cgToFront), suspensionLength: this.config.suspensionRestLength, suspensionVelocity: 0, suspensionForce: 0, isGrounded: false, groundNormal: new Vector2(0, 1), groundMaterial: 0, rotationAngle: 0, angularVelocity: 0, radius: 0.33, width: 0.22, slipRatio: 0, slipAngle: 0, camberAngle: 0, longitudinalForce: 0, lateralForce: 0, aligningMoment: 0, verticalLoad: 0, temperature: 20, wear: 0, brakePressure: 0, driveTorque: 0, steeringAngle: 0 },
      // Rear Left
      { localPosition: new Vector2(-this.config.trackWidth / 2, this.config.cgToFront - this.config.wheelbase), suspensionLength: this.config.suspensionRestLength, suspensionVelocity: 0, suspensionForce: 0, isGrounded: false, groundNormal: new Vector2(0, 1), groundMaterial: 0, rotationAngle: 0, angularVelocity: 0, radius: 0.33, width: 0.24, slipRatio: 0, slipAngle: 0, camberAngle: 0, longitudinalForce: 0, lateralForce: 0, aligningMoment: 0, verticalLoad: 0, temperature: 20, wear: 0, brakePressure: 0, driveTorque: 0, steeringAngle: 0 },
      // Rear Right
      { localPosition: new Vector2(this.config.trackWidth / 2, this.config.cgToFront - this.config.wheelbase), suspensionLength: this.config.suspensionRestLength, suspensionVelocity: 0, suspensionForce: 0, isGrounded: false, groundNormal: new Vector2(0, 1), groundMaterial: 0, rotationAngle: 0, angularVelocity: 0, radius: 0.33, width: 0.24, slipRatio: 0, slipAngle: 0, camberAngle: 0, longitudinalForce: 0, lateralForce: 0, aligningMoment: 0, verticalLoad: 0, temperature: 20, wear: 0, brakePressure: 0, driveTorque: 0, steeringAngle: 0 }
    ];
    
    return {
      position: new Vector2(0, 0),
      velocity: new Vector2(0, 0),
      angularVelocity: 0,
      heading: 0,
      engineRPM: this.config.idleRPM,
      engineTorque: 0,
      throttle: 0,
      currentGear: 1,
      clutchSlip: 0,
      wheels,
      speed: 0,
      speedKPH: 0,
      slipAngle: 0,
      lateralG: 0,
      longitudinalG: 0,
      isDrifting: false,
      driftAngle: 0,
      driftScore: 0,
      driftMultiplier: 1,
      counterSteerAngle: 0,
      engineHealth: 1,
      transmissionHealth: 1,
      tireWear: [0, 0, 0, 0]
    };
  }
  
  /**
   * Main physics update - call once per physics timestep
   */
  update(dt: number, input: VehicleInput, groundQuery: (pos: Vector2) => { height: number; normal: Vector2; material: number; friction: number }): void {
    // Update engine and drivetrain
    this.updateEngine(dt, input);
    this.updateTransmission(dt, input);
    this.updateDifferential(dt);
    
    // Calculate weight transfer and suspension forces
    this.updateSuspension(dt, groundQuery);
    
    // Calculate tire forces (Pacejka Magic Formula)
    this.updateTireForces(dt);
    
    // Apply forces to chassis
    this.updateChassisDynamics(dt);
    
    // Update drift state
    this.updateDriftState(dt);
    
    // Update derived values
    this.updateDerivedValues();
    
    // Audio/VFX triggers
    this.triggerAudioVFX();
  }
  
  private updateEngine(dt: number, input: VehicleInput): void {
    const cfg = this.config;
    const state = this.state;
    
    // Throttle input with smoothing
    state.throttle = MathUtils.lerp(state.throttle, input.throttle, 1 - Math.exp(-dt * 10));
    
    // Engine torque curve lookup
    const torqueMultiplier = this.interpolateCurve(cfg.torqueCurve, state.engineRPM / cfg.maxEngineRPM);
    const maxTorque = cfg.maxEngineTorque * torqueMultiplier * state.engineHealth;
    const targetTorque = maxTorque * state.throttle;
    
    // Engine inertia simulation
    const engineInertiaTorque = cfg.engineInertia * (state.engineRPM * MathUtils.RPM_TO_RAD) / dt;
    state.engineTorque = MathUtils.lerp(state.engineTorque, targetTorque, 1 - Math.exp(-dt * 20));
    
    // Engine RPM from wheel speeds (through drivetrain)
    let wheelRPM = 0;
    let drivenWheels = 0;
    for (let i = 2; i < 4; i++) { // Rear wheels for RWD
      if (state.wheels[i].isGrounded) {
        wheelRPM += state.wheels[i].angularVelocity * MathUtils.RAD_TO_RPM;
        drivenWheels++;
      }
    }
    if (drivenWheels > 0) {
      wheelRPM /= drivenWheels;
    }
    
    const gearRatio = this.getCurrentGearRatio();
    const targetEngineRPM = Math.abs(wheelRPM * gearRatio * cfg.finalDriveRatio);
    
    // Clutch simulation
    if (input.clutch > 0.5) {
      // Clutch disengaged - engine revs freely
      state.clutchSlip = 1;
      const netTorque = state.engineTorque - engineInertiaTorque * 0.1;
      const alpha = netTorque / cfg.engineInertia;
      state.engineRPM += alpha * MathUtils.RAD_TO_RPM * dt;
    } else {
      // Clutch engaged - engine connected to wheels
      state.clutchSlip = 0;
      const rpmDiff = targetEngineRPM - state.engineRPM;
      const clutchTorque = MathUtils.clamp(rpmDiff * 0.1 * cfg.clutchStrength, -cfg.clutchStrength, cfg.clutchStrength);
      const netTorque = state.engineTorque - clutchTorque;
      const alpha = netTorque / cfg.engineInertia;
      state.engineRPM += alpha * MathUtils.RAD_TO_RPM * dt;
      
      // Apply clutch torque to driven wheels
      const torquePerWheel = clutchTorque * gearRatio * cfg.finalDriveRatio * cfg.transmissionEfficiency / 2;
      state.wheels[2].driveTorque += torquePerWheel;
      state.wheels[3].driveTorque += torquePerWheel;
    }
    
    // Rev limiter
    if (state.engineRPM > cfg.redlineRPM) {
      state.engineRPM = cfg.redlineRPM;
      state.engineTorque *= 0.5;
    }
    
    // Idle control
    if (state.engineRPM < cfg.idleRPM && state.throttle < 0.05) {
      state.engineRPM = MathUtils.lerp(state.engineRPM, cfg.idleRPM, 1 - Math.exp(-dt * 5));
    }
    
    state.engineRPM = MathUtils.clamp(state.engineRPM, 0, cfg.maxEngineRPM * 1.1);
  }
  
  private updateTransmission(dt: number, input: VehicleInput): void {
    const cfg = this.config;
    const state = this.state;
    
    // Auto-shift logic (can be overridden for manual)
    if (input.shiftUp && state.currentGear < cfg.gearRatios.length - 1) {
      this.shiftGear(state.currentGear + 1);
    } else if (input.shiftDown && state.currentGear > -1) {
      this.shiftGear(state.currentGear - 1);
    } else if (state.currentGear > 0) {
      // Auto upshift
      if (state.engineRPM > cfg.shiftUpRPM && state.currentGear < cfg.gearRatios.length - 1) {
        this.shiftGear(state.currentGear + 1);
      }
      // Auto downshift
      else if (state.engineRPM < cfg.shiftDownRPM && state.currentGear > 1) {
        this.shiftGear(state.currentGear - 1);
      }
    }
  }
  
  private shiftGear(newGear: number): void {
    const state = this.state;
    const cfg = this.config;
    
    if (newGear === state.currentGear) return;
    
    // Simulate shift time and clutch slip
    state.currentGear = newGear;
    state.clutchSlip = 0.5; // Temporary slip during shift
    
    // Rev matching for downshifts
    if (newGear < state.currentGear && newGear > 0) {
      const targetRPM = this.calculateEngineRPMForGear(newGear);
      state.engineRPM = MathUtils.lerp(state.engineRPM, targetRPM, 0.3);
    }
  }
  
  private calculateEngineRPMForGear(gear: number): number {
    let wheelRPM = 0;
    let count = 0;
    for (let i = 2; i < 4; i++) {
      if (this.state.wheels[i].isGrounded) {
        wheelRPM += this.state.wheels[i].angularVelocity * MathUtils.RAD_TO_RPM;
        count++;
      }
    }
    if (count === 0) return this.config.idleRPM;
    wheelRPM /= count;
    return Math.abs(wheelRPM * this.config.gearRatios[gear] * this.config.finalDriveRatio);
  }
  
  private getCurrentGearRatio(): number {
    const gear = this.state.currentGear;
    if (gear >= 0 && gear < this.config.gearRatios.length) {
      return this.config.gearRatios[gear];
    }
    return 1;
  }
  
  private updateDifferential(dt: number): void {
    const cfg = this.config;
    const state = this.state;
    const rl = state.wheels[2];
    const rr = state.wheels[3];
    
    if (cfg.diffType === 'open') {
      // Open diff - equal torque, speeds can differ
      return;
    }
    
    const speedDiff = rl.angularVelocity - rr.angularVelocity;
    const avgSpeed = (rl.angularVelocity + rr.angularVelocity) / 2;
    
    if (cfg.diffType === 'locked') {
      // Fully locked - force same speed
      const lockTorque = speedDiff * cfg.lsdPreload * 10;
      rl.driveTorque -= lockTorque;
      rr.driveTorque += lockTorque;
    } else if (cfg.diffType === 'lsd') {
      // Limited slip - torque bias based on speed difference
      const rampFactor = Math.tan(MathUtils.degToRad(cfg.lsdRampAngle));
      const biasTorque = cfg.lsdPreload + Math.abs(rl.driveTorque + rr.driveTorque) * rampFactor;
      const lockTorque = MathUtils.clamp(speedDiff * biasTorque, -biasTorque, biasTorque);
      rl.driveTorque -= lockTorque;
      rr.driveTorque += lockTorque;
    }
  }
  
  private updateSuspension(dt: number, groundQuery: (pos: Vector2) => { height: number; normal: Vector2; material: number; friction: number }): void {
    const cfg = this.config;
    const state = this.state;
    
    // Transform wheel positions to world
    const cosH = Math.cos(state.heading);
    const sinH = Math.sin(state.heading);
    
    // Calculate weight transfer from acceleration
    const accelLocal = new Vector2(
      state.velocity.x * cosH + state.velocity.y * sinH,
      -state.velocity.x * sinH + state.velocity.y * cosH
    );
    // Note: We need acceleration, not velocity. This is simplified.
    
    for (let i = 0; i < 4; i++) {
      const wheel = state.wheels[i];
      
      // World position of wheel contact point
      const worldX = state.position.x + wheel.localPosition.x * cosH - wheel.localPosition.y * sinH;
      const worldY = state.position.y + wheel.localPosition.x * sinH + wheel.localPosition.y * cosH;
      
      const ground = groundQuery(new Vector2(worldX, worldY));
      
      // Suspension compression
      const targetLength = cfg.suspensionRestLength;
      const currentLength = Math.max(0, cfg.suspensionRestLength - (ground.height - worldY + wheel.radius));
      const compression = targetLength - currentLength;
      
      // Spring force
      let springForce = compression * cfg.springRate + cfg.springPreload;
      
      // Damper force
      const compressionVelocity = (currentLength - wheel.suspensionLength) / dt;
      const damperRate = compressionVelocity > 0 ? cfg.damperRateBump : cfg.damperRateRebound;
      const damperForce = compressionVelocity * damperRate;
      
      wheel.suspensionForce = springForce + damperForce;
      wheel.suspensionLength = currentLength;
      wheel.suspensionVelocity = compressionVelocity;
      
      // Ground contact
      wheel.isGrounded = currentLength > 0.01 && ground.height > worldY - wheel.radius - 0.1;
      wheel.groundNormal = ground.normal;
      wheel.groundMaterial = ground.material;
      
      // Vertical load (includes weight transfer)
      const staticLoad = (cfg.mass * this.gravity) * (i < 2 ? (1 - cfg.cgToFront / cfg.wheelbase) : (cfg.cgToFront / cfg.wheelbase)) / 2;
      const aeroLoad = this.calculateAeroLoad(i) / 4;
      wheel.verticalLoad = Math.max(0, wheel.suspensionForce + staticLoad + aeroLoad);
    }
    
    // Anti-roll bars
    this.applyAntiRollBars();
  }
  
  private calculateAeroLoad(wheelIndex: number): number {
    const cfg = this.config;
    const state = this.state;
    const speed = state.speed;
    const dynamicPressure = 0.5 * this.airDensity * speed * speed;
    
    const frontDownforce = dynamicPressure * cfg.frontalArea * -cfg.liftCoefficientFront;
    const rearDownforce = dynamicPressure * cfg.frontalArea * -cfg.liftCoefficientRear;
    
    return wheelIndex < 2 ? frontDownforce : rearDownforce;
  }
  
  private applyAntiRollBars(): void {
    const cfg = this.config;
    const state = this.state;
    
    // Front anti-roll
    const frontCompressionDiff = state.wheels[0].suspensionLength - state.wheels[1].suspensionLength;
    const frontRollTorque = frontCompressionDiff * cfg.frontAntiRollBar;
    state.wheels[0].suspensionForce += frontRollTorque / cfg.trackWidth;
    state.wheels[1].suspensionForce -= frontRollTorque / cfg.trackWidth;
    
    // Rear anti-roll
    const rearCompressionDiff = state.wheels[2].suspensionLength - state.wheels[3].suspensionLength;
    const rearRollTorque = rearCompressionDiff * cfg.rearAntiRollBar;
    state.wheels[2].suspensionForce += rearRollTorque / cfg.trackWidth;
    state.wheels[3].suspensionForce -= rearRollTorque / cfg.trackWidth;
  }
  
  private updateTireForces(dt: number): void {
    const cfg = this.config;
    const state = this.state;
    const tire = cfg.tireConfig;
    
    // Vehicle velocity in local space
    const cosH = Math.cos(state.heading);
    const sinH = Math.sin(state.heading);
    const localVel = new Vector2(
      state.velocity.x * cosH + state.velocity.y * sinH,
      -state.velocity.x * sinH + state.velocity.y * cosH
    );
    
    for (let i = 0; i < 4; i++) {
      const wheel = state.wheels[i];
      if (!wheel.isGrounded) {
        wheel.longitudinalForce = 0;
        wheel.lateralForce = 0;
        wheel.aligningMoment = 0;
        wheel.slipRatio = 0;
        wheel.slipAngle = 0;
        continue;
      }
      
      // Wheel velocity in world space
      const wheelWorldVel = new Vector2(
        state.velocity.x - state.angularVelocity * wheel.localPosition.y,
        state.velocity.y + state.angularVelocity * wheel.localPosition.x
      );
      
      // Transform to wheel local space (accounting for steering)
      const steerAngle = wheel.steeringAngle;
      const cosS = Math.cos(steerAngle);
      const sinS = Math.sin(steerAngle);
      
      const localWheelVel = new Vector2(
        wheelWorldVel.x * cosS + wheelWorldVel.y * sinS,
        -wheelWorldVel.x * sinS + wheelWorldVel.y * cosS
      );
      
      // Slip ratio (longitudinal)
      const wheelSpeed = wheel.angularVelocity * wheel.radius;
      const longSlip = wheelSpeed - localWheelVel.x;
      wheel.slipRatio = MathUtils.clamp(longSlip / Math.max(0.1, Math.abs(localWheelVel.x) + 0.1), -2, 2);
      
      // Slip angle (lateral)
      wheel.slipAngle = Math.atan2(localWheelVel.y, Math.max(0.1, Math.abs(localWheelVel.x)));
      
      // Camber angle (simplified - from suspension geometry)
      wheel.camberAngle = (wheel.suspensionLength - cfg.suspensionRestLength) * 0.5; // Simplified
      
      // Pacejka Magic Formula
      const Fz = wheel.verticalLoad / tire.Fz0; // Normalized load
      const loadFactor = Math.pow(Fz, tire.loadSensitivity);
      
      // Longitudinal force (Fx)
      const Bx = tire.Bx * loadFactor;
      const Cx = tire.Cx;
      const Dx = tire.Dx * wheel.verticalLoad * loadFactor;
      const Ex = tire.Ex;
      
      const slipRatioAdj = wheel.slipRatio * (1 + tire.BxAlpha * Math.abs(wheel.slipAngle));
      const Fx = Dx * Math.sin(Cx * Math.atan(Bx * slipRatioAdj - Ex * (Bx * slipRatioAdj - Math.atan(Bx * slipRatioAdj))));
      
      // Lateral force (Fy)
      const By = tire.By * loadFactor;
      const Cy = tire.Cy;
      const Dy = tire.Dy * wheel.verticalLoad * loadFactor;
      const Ey = tire.Ey;
      
      const slipAngleAdj = wheel.slipAngle + tire.ByAlpha * wheel.slipRatio;
      const camberForce = wheel.camberAngle * tire.camberStiffness;
      const Fy = Dy * Math.sin(Cy * Math.atan(By * slipAngleAdj - Ey * (By * slipAngleAdj - Math.atan(By * slipAngleAdj)))) + camberForce;
      
      // Aligning moment (Mz)
      const Bz = tire.Bz;
      const Cz = tire.Cz;
      const Dz = tire.Dz * wheel.verticalLoad * wheel.radius * loadFactor;
      const Ez = tire.Ez;
      
      wheel.aligningMoment = Dz * Math.sin(Cz * Math.atan(Bz * slipAngleAdj - Ez * (Bz * slipAngleAdj - Math.atan(Bz * slipAngleAdj))));
      
      // Apply brake force
      const brakeForce = wheel.brakePressure * (i < 2 ? cfg.brakeForceFront : cfg.brakeForceRear);
      if (cfg.absEnabled && Math.abs(wheel.slipRatio) > cfg.absSlipThreshold && wheel.slipRatio * localWheelVel.x < 0) {
        // ABS active - modulate brake
        wheel.brakePressure *= 0.95;
      }
      wheel.longitudinalForce = Fx - brakeForce * Math.sign(wheel.angularVelocity) + wheel.driveTorque / wheel.radius;
      wheel.lateralForce = Fy;
      
      // Friction circle / ellipse combination
      this.combineForces(wheel, tire);
      
      // Update wheel rotation
      const netTorque = wheel.driveTorque - wheel.longitudinalForce * wheel.radius - brakeForce * wheel.radius;
      const wheelInertia = 1.5; // kg*m^2 approximate
      wheel.angularVelocity += (netTorque / wheelInertia) * dt;
      
      // Handbrake
      if (this.state.wheels[2] === wheel || this.state.wheels[3] === wheel) {
        // Handbrake handled in input processing
      }
      
      // Temperature simulation
      const slipEnergy = (Math.abs(wheel.slipRatio) + Math.abs(wheel.slipAngle)) * Math.abs(wheel.verticalLoad) * dt;
      wheel.temperature += slipEnergy * 0.001;
      wheel.temperature = MathUtils.lerp(wheel.temperature, 20, 1 - Math.exp(-dt * 0.1)); // Cool down
      
      // Wear
      wheel.wear += slipEnergy * 0.00001;
    }
  }
  
  private combineForces(wheel: WheelState, tire: VehicleConfig['tireConfig']): void {
    // Friction ellipse combination
    const FxMax = Math.abs(wheel.longitudinalForce);
    const FyMax = Math.abs(wheel.lateralForce);
    const Fz = wheel.verticalLoad;
    
    // Simplified friction circle
    const mu = 1.0; // Base friction coefficient (varies by material)
    const Fmax = mu * Fz;
    
    const totalForce = Math.sqrt(wheel.longitudinalForce * wheel.longitudinalForce + wheel.lateralForce * wheel.lateralForce);
    if (totalForce > Fmax && totalForce > 0.001) {
      const scale = Fmax / totalForce;
      wheel.longitudinalForce *= scale;
      wheel.lateralForce *= scale;
    }
    
    // Drift falloff - reduce lateral grip at high slip angles
    const slipAngleDeg = Math.abs(wheel.slipAngle) * MathUtils.RAD_TO_DEG;
    if (slipAngleDeg > tire.peakSlipAngle) {
      const falloff = 1 - (slipAngleDeg - tire.peakSlipAngle) / (tire.driftSlipAngle - tire.peakSlipAngle) * tire.driftFalloff;
      wheel.lateralForce *= MathUtils.clamp(falloff, 0.1, 1);
    }
  }
  
  private updateChassisDynamics(dt: number): void {
    const cfg = this.config;
    const state = this.state;
    
    // Sum forces and torques from all wheels
    let totalForceX = 0;
    let totalForceY = 0;
    let totalTorque = 0;
    
    const cosH = Math.cos(state.heading);
    const sinH = Math.sin(state.heading);
    
    for (let i = 0; i < 4; i++) {
      const wheel = state.wheels[i];
      if (!wheel.isGrounded) continue;
      
      // Transform wheel forces to world space
      const steerAngle = wheel.steeringAngle;
      const cosS = Math.cos(steerAngle);
      const sinS = Math.sin(steerAngle);
      
      // Wheel local forces to vehicle local
      const localFx = wheel.longitudinalForce * cosS - wheel.lateralForce * sinS;
      const localFy = wheel.longitudinalForce * sinS + wheel.lateralForce * cosS;
      
      // Vehicle local to world
      const worldFx = localFx * cosH - localFy * sinH;
      const worldFy = localFx * sinH + localFy * cosH;
      
      totalForceX += worldFx;
      totalForceY += worldFy;
      
      // Torque from lateral forces (yaw moment)
      const leverX = wheel.localPosition.x * cosH - wheel.localPosition.y * sinH;
      const leverY = wheel.localPosition.x * sinH + wheel.localPosition.y * cosH;
      totalTorque += leverX * worldFy - leverY * worldFx;
      
      // Aligning torque from front wheels
      if (i < 2) {
        totalTorque += wheel.aligningMoment * cosS;
      }
    }
    
    // Aerodynamic forces
    const aero = this.calculateAerodynamicForces();
    totalForceX += aero.x;
    totalForceY += aero.y;
    
    // Apply to chassis
    const ax = totalForceX / cfg.mass;
    const ay = totalForceY / cfg.mass;
    const alpha = totalTorque / cfg.inertia;
    
    state.velocity.x += ax * dt;
    state.velocity.y += ay * dt;
    state.angularVelocity += alpha * dt;
    
    // Angular damping (simulates tire scrub)
    state.angularVelocity *= Math.pow(0.98, dt * 60);
  }
  
  private calculateAerodynamicForces(): Vector2 {
    const cfg = this.config;
    const state = this.state;
    const speed = state.speed;
    
    if (speed < 1) return new Vector2(0, 0);
    
    const dynamicPressure = 0.5 * this.airDensity * speed * speed;
    const drag = dynamicPressure * cfg.frontalArea * cfg.dragCoefficient;
    const downforceFront = dynamicPressure * cfg.frontalArea * -cfg.liftCoefficientFront;
    const downforceRear = dynamicPressure * cfg.frontalArea * -cfg.liftCoefficientRear;
    
    // Drag opposes velocity
    const velNorm = state.velocity.normalize();
    return new Vector2(-velNorm.x * drag, -velNorm.y * drag);
  }
  
  private updateDriftState(dt: number): void {
    const state = this.state;
    const cfg = this.config;
    
    // Vehicle slip angle (body slip)
    const velAngle = Math.atan2(state.velocity.y, state.velocity.x);
    state.slipAngle = MathUtils.normalizeAngle(velAngle - state.heading);
    const slipAngleDeg = Math.abs(state.slipAngle) * MathUtils.RAD_TO_DEG;
    
    // Drift detection
    const wasDrifting = state.isDrifting;
    state.isDrifting = slipAngleDeg > this.driftThreshold * MathUtils.RAD_TO_DEG && state.speed > 5;
    
    if (state.isDrifting) {
      state.driftAngle = slipAngleDeg;
      state.driftTime += dt;
      
      // Counter-steer angle
      const frontSlipAvg = (Math.abs(state.wheels[0].slipAngle) + Math.abs(state.wheels[1].slipAngle)) / 2;
      state.counterSteerAngle = (frontSlipAvg - Math.abs(state.slipAngle)) * MathUtils.RAD_TO_DEG;
      
      // Drift scoring
      const speedFactor = MathUtils.clamp(state.speed / 30, 0.5, 2);
      const angleFactor = MathUtils.clamp(slipAngleDeg / 45, 0.5, 2);
      const timeFactor = MathUtils.clamp(state.driftTime / 5, 0.5, 3);
      
      state.driftScore += speedFactor * angleFactor * timeFactor * dt * 10;
      state.driftMultiplier = 1 + Math.floor(state.driftTime / 2) * 0.1;
      
      if (!wasDrifting && this.onDriftStart) {
        this.onDriftStart();
      }
    } else if (wasDrifting && this.onDriftEnd) {
      this.onDriftEnd(state.driftScore);
      state.driftScore = 0;
      state.driftMultiplier = 1;
      state.driftTime = 0;
    }
    
    // Lateral/longitudinal G forces
    const localVel = new Vector2(
      state.velocity.x * Math.cos(state.heading) + state.velocity.y * Math.sin(state.heading),
      -state.velocity.x * Math.sin(state.heading) + state.velocity.y * Math.cos(state.heading)
    );
    state.lateralG = Math.abs(localVel.y) * Math.abs(state.angularVelocity) / this.gravity;
    state.longitudinalG = localVel.x / this.gravity; // Simplified
  }
  
  private updateDerivedValues(): void {
    const state = this.state;
    state.speed = state.velocity.length();
    state.speedKPH = state.speed * 3.6;
  }
  
  private triggerAudioVFX(): void {
    const state = this.state;
    
    // Engine sound
    if (this.onEngineSound) {
      const load = state.throttle;
      this.onEngineSound(state.engineRPM, load);
    }
    
    // Tire squeal
    for (let i = 0; i < 4; i++) {
      const wheel = state.wheels[i];
      if (wheel.isGrounded) {
        const slipIntensity = Math.max(
          Math.abs(wheel.slipRatio) / this.config.tireConfig.peakSlipRatio,
          Math.abs(wheel.slipAngle) / MathUtils.degToRad(this.config.tireConfig.peakSlipAngle)
        );
        if (slipIntensity > 0.5 && this.onTireSqueal) {
          this.onTireSqueal(i, MathUtils.clamp(slipIntensity, 0, 1));
        }
      }
    }
  }
  
  private interpolateCurve(curve: [number, number][], x: number): number {
    x = MathUtils.clamp(x, 0, 1);
    for (let i = 0; i < curve.length - 1; i++) {
      const [x1, y1] = curve[i];
      const [x2, y2] = curve[i + 1];
      if (x >= x1 && x <= x2) {
        const t = (x - x1) / (x2 - x1);
        return MathUtils.lerp(y1, y2, t);
      }
    }
    return curve[curve.length - 1][1];
  }
  
  // Public API
  getState(): Readonly<VehicleState> {
    return this.state;
  }
  
  getConfig(): Readonly<VehicleConfig> {
    return this.config;
  }
  
  setPosition(pos: Vector2, heading: number): void {
    this.state.position = pos.clone();
    this.state.heading = heading;
    this.state.velocity.set(0, 0);
    this.state.angularVelocity = 0;
  }
  
  applyImpulse(impulse: Vector2, worldPoint: Vector2): void {
    const state = this.state;
    const cfg = this.config;
    
    state.velocity.x += impulse.x / cfg.mass;
    state.velocity.y += impulse.y / cfg.mass;
    
    const relX = worldPoint.x - state.position.x;
    const relY = worldPoint.y - state.position.y;
    state.angularVelocity += (relX * impulse.y - relY * impulse.x) / cfg.inertia;
    
    if (this.onCollision) {
      this.onCollision(impulse.length());
    }
  }
  
  // Input processing helper
  processInput(rawInput: { throttle: number; brake: number; steer: number; handbrake: boolean; shiftUp: boolean; shiftDown: boolean; clutch: number }): VehicleInput {
    const cfg = this.config;
    const state = this.state;
    
    // Speed-sensitive steering
    const speedFactor = MathUtils.clamp(1 - state.speedKPH / 200 * cfg.speedSensitivity, 0.3, 1);
    const maxSteer = cfg.maxSteerAngle * speedFactor;
    
    // Ackermann steering geometry
    const steerInput = MathUtils.clamp(rawInput.steer, -1, 1);
    const targetSteer = steerInput * maxSteer;
    
    // Drift assist - counter-steer help
    let assistSteer = targetSteer;
    if (cfg.driftAssist > 0 && state.isDrifting) {
      const assistAmount = cfg.driftAssist * state.slipAngle * 0.5;
      assistSteer = MathUtils.clamp(targetSteer - assistAmount, -maxSteer, maxSteer);
    }
    
    // Smooth steering
    const steerRate = 3; // rad/s
    for (let i = 0; i < 2; i++) {
      const wheel = state.wheels[i];
      wheel.steeringAngle = MathUtils.moveTowards(wheel.steeringAngle, assistSteer, steerRate * (1/60));
    }
    
    // Ackermann correction for inner/outer wheel
    if (Math.abs(assistSteer) > 0.01) {
      const turnRadius = cfg.wheelbase / Math.tan(Math.abs(assistSteer));
      const sign = Math.sign(assistSteer);
      const innerAngle = Math.atan(cfg.wheelbase / (turnRadius - sign * cfg.trackWidth / 2));
      const outerAngle = Math.atan(cfg.wheelbase / (turnRadius + sign * cfg.trackWidth / 2));
      state.wheels[0].steeringAngle = sign > 0 ? innerAngle : outerAngle;
      state.wheels[1].steeringAngle = sign > 0 ? outerAngle : innerAngle;
    }
    
    // Brake distribution
    const brakePressure = MathUtils.clamp(rawInput.brake, 0, 1);
    state.wheels[0].brakePressure = brakePressure * cfg.brakeBias;
    state.wheels[1].brakePressure = brakePressure * cfg.brakeBias;
    state.wheels[2].brakePressure = brakePressure * (1 - cfg.brakeBias);
    state.wheels[3].brakePressure = brakePressure * (1 - cfg.brakeBias);
    
    // Handbrake (rear only)
    if (rawInput.handbrake) {
      state.wheels[2].brakePressure = Math.max(state.wheels[2].brakePressure, cfg.handbrakeLockup);
      state.wheels[3].brakePressure = Math.max(state.wheels[3].brakePressure, cfg.handbrakeLockup);
    }
    
    return {
      throttle: MathUtils.clamp(rawInput.throttle, 0, 1),
      brake: brakePressure,
      steering: assistSteer,
      handbrake: rawInput.handbrake,
      clutch: MathUtils.clamp(rawInput.clutch, 0, 1),
      shiftUp: rawInput.shiftUp,
      shiftDown: rawInput.shiftDown
    };
  }
  
  // Preset configurations for different car types
  static createDriftCar(): VehicleConfig {
    return {
      mass: 1300,
      inertia: 2500,
      wheelbase: 2.55,
      trackWidth: 1.55,
      cgHeight: 0.48,
      cgToFront: 1.25,
      maxEngineTorque: 500,
      maxEngineRPM: 8500,
      idleRPM: 900,
      redlineRPM: 8000,
      engineInertia: 0.4,
      torqueCurve: [
        [0, 0.3], [1500, 0.5], [3000, 0.8], [4500, 1.0],
        [5500, 1.0], [6500, 0.95], [7500, 0.8], [8500, 0.5]
      ],
      gearRatios: [-3.8, 0, 3.5, 2.3, 1.6, 1.2, 1.0],
      finalDriveRatio: 4.1,
      shiftUpRPM: 7500,
      shiftDownRPM: 3500,
      clutchStrength: 600,
      transmissionEfficiency: 0.9,
      diffType: 'locked',
      lsdPreload: 100,
      lsdRampAngle: 60,
      springRate: 45000,
      damperRateBump: 4000,
      damperRateRebound: 6000,
      springPreload: 2500,
      maxSuspensionTravel: 0.12,
      suspensionRestLength: 0.28,
      frontAntiRollBar: 20000,
      rearAntiRollBar: 8000,
      tireConfig: {
        Bx: 12, Cx: 1.8, Dx: 1.1, Ex: 0.95,
        By: 12, Cy: 1.8, Dy: 1.1, Ey: 0.95,
        Bz: 12, Cz: 2.1, Dz: 0.1, Ez: 0.85,
        BxAlpha: 0.0, ByAlpha: 0.0,
        Fz0: 3200,
        loadSensitivity: 0.75,
        camberStiffness: 1200,
        peakSlipAngle: 10,
        peakSlipRatio: 0.18,
        driftSlipAngle: 40,
        driftFalloff: 0.2
      },
      dragCoefficient: 0.35,
      frontalArea: 2.1,
      liftCoefficientFront: -0.2,
      liftCoefficientRear: -0.3,
      aeroBalance: 0.4,
      brakeForceFront: 9000,
      brakeForceRear: 7000,
      brakeBias: 0.6,
      absEnabled: false, // Drift cars often disable ABS
      absSlipThreshold: 0.25,
      maxSteerAngle: MathUtils.degToRad(50), // More lock for drift
      steerRatio: 14,
      ackermannFactor: 0.2,
      speedSensitivity: 0.3,
      driftAssist: 0.2,
      handbrakeForce: 5000,
      handbrakeLockup: 1.0
    };
  }
  
  static createGripCar(): VehicleConfig {
    return {
      mass: 1450,
      inertia: 3000,
      wheelbase: 2.65,
      trackWidth: 1.65,
      cgHeight: 0.45,
      cgToFront: 1.35,
      maxEngineTorque: 450,
      maxEngineRPM: 8000,
      idleRPM: 800,
      redlineRPM: 7800,
      engineInertia: 0.5,
      torqueCurve: [
        [0, 0.4], [2000, 0.7], [3500, 0.95], [5000, 1.0],
        [6000, 0.98], [7000, 0.85], [8000, 0.6]
      ],
      gearRatios: [-3.4, 0, 3.6, 2.1, 1.4, 1.05, 0.85],
      finalDriveRatio: 3.5,
      shiftUpRPM: 7200,
      shiftDownRPM: 3200,
      clutchStrength: 550,
      transmissionEfficiency: 0.93,
      diffType: 'lsd',
      lsdPreload: 80,
      lsdRampAngle: 50,
      springRate: 50000,
      damperRateBump: 3500,
      damperRateRebound: 5000,
      springPreload: 3000,
      maxSuspensionTravel: 0.1,
      suspensionRestLength: 0.25,
      frontAntiRollBar: 25000,
      rearAntiRollBar: 15000,
      tireConfig: {
        Bx: 14, Cx: 1.7, Dx: 1.2, Ex: 0.98,
        By: 14, Cy: 1.7, Dy: 1.2, Ey: 0.98,
        Bz: 14, Cz: 2.2, Dz: 0.12, Ez: 0.9,
        BxAlpha: 0.0, ByAlpha: 0.0,
        Fz0: 3600,
        loadSensitivity: 0.85,
        camberStiffness: 1500,
        peakSlipAngle: 6,
        peakSlipRatio: 0.12,
        driftSlipAngle: 20,
        driftFalloff: 0.5
      },
      dragCoefficient: 0.3,
      frontalArea: 2.0,
      liftCoefficientFront: -0.3,
      liftCoefficientRear: -0.4,
      aeroBalance: 0.55,
      brakeForceFront: 10000,
      brakeForceRear: 8000,
      brakeBias: 0.7,
      absEnabled: true,
      absSlipThreshold: 0.15,
      maxSteerAngle: MathUtils.degToRad(30),
      steerRatio: 15,
      ackermannFactor: 0.4,
      speedSensitivity: 0.6,
      driftAssist: 0.5,
      handbrakeForce: 3000,
      handbrakeLockup: 0.7
    };
  }
  
  static createStarterCar(): VehicleConfig {
    return {
      mass: 1200,
      inertia: 2200,
      wheelbase: 2.5,
      trackWidth: 1.5,
      cgHeight: 0.5,
      cgToFront: 1.2,
      maxEngineTorque: 250,
      maxEngineRPM: 7000,
      idleRPM: 800,
      redlineRPM: 6500,
      engineInertia: 0.6,
      torqueCurve: [
        [0, 0.5], [1500, 0.7], [3000, 0.9], [4000, 1.0],
        [5000, 0.9], [6000, 0.7], [7000, 0.4]
      ],
      gearRatios: [-3.2, 0, 3.4, 2.0, 1.3, 1.0, 0.8],
      finalDriveRatio: 3.9,
      shiftUpRPM: 6000,
      shiftDownRPM: 2500,
      clutchStrength: 400,
      transmissionEfficiency: 0.88,
      diffType: 'open',
      lsdPreload: 0,
      lsdRampAngle: 45,
      springRate: 25000,
      damperRateBump: 2000,
      damperRateRebound: 3000,
      springPreload: 1500,
      maxSuspensionTravel: 0.18,
      suspensionRestLength: 0.35,
      frontAntiRollBar: 8000,
      rearAntiRollBar: 6000,
      tireConfig: {
        Bx: 8, Cx: 2.0, Dx: 0.9, Ex: 0.97,
        By: 8, Cy: 2.0, Dy: 0.9, Ey: 0.97,
        Bz: 8, Cz: 1.8, Dz: 0.06, Ez: 0.95,
        BxAlpha: 0.0, ByAlpha: 0.0,
        Fz0: 3000,
        loadSensitivity: 0.9,
        camberStiffness: 800,
        peakSlipAngle: 10,
        peakSlipRatio: 0.2,
        driftSlipAngle: 30,
        driftFalloff: 0.4
      },
      dragCoefficient: 0.35,
      frontalArea: 2.3,
      liftCoefficientFront: -0.05,
      liftCoefficientRear: -0.05,
      aeroBalance: 0.5,
      brakeForceFront: 6000,
      brakeForceRear: 4500,
      brakeBias: 0.65,
      absEnabled: true,
      absSlipThreshold: 0.2,
      maxSteerAngle: MathUtils.degToRad(35),
      steerRatio: 18,
      ackermannFactor: 0.5,
      speedSensitivity: 0.7,
      driftAssist: 0.6,
      handbrakeForce: 2500,
      handbrakeLockup: 0.6
    };
  }
}

export default VehiclePhysics;