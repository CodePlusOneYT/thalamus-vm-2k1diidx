import { Entity } from './Entity';
import { Vector2, Vector3 } from '../physics/MathUtils';

export enum SegmentType {
  STRAIGHT = 'straight',
  CURVE_LEFT = 'curve_left',
  CURVE_RIGHT = 'curve_right',
  JUMP = 'jump',
  BOOST = 'boost',
  CHICANE = 'chicane',
  U_TURN = 'u_turn'
}

export interface TrackData {
  width: number;
  height: number;
  elevation: number;
  friction: number;
  bankAngle: number;
  boostMultiplier: number;
  driftBonus: number;
  segmentId: string;
}

export class TrackSegment extends Entity {
  public type: SegmentType;
  public data: TrackData;
  public position: Vector2;
  public next: TrackSegment | null = null;
  public previous: TrackSegment | null = null;
  private _geometry: ConvexPolygon[] = [];
  private _heightPoints: Vector3[] = [];
  private _segmentLength: number = 100;
  private _curvature: number = 0;
  private _tilt: number = 0;

  constructor(type: SegmentType, data: Partial<TrackData> = {}) {
    super();
    this.type = type;
    this.data = {
      width: 40,
      height: 0,
      elevation: 0,
      friction: 0.85,
      bankAngle: 0,
      boostMultiplier: 1.0,
      driftBonus: 0,
      segmentId: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    if (data.width !== undefined) this.data.width = data.width;
    if (data.height !== undefined) this.data.height = data.height;
    if (data.elevation !== undefined) this.data.elevation = data.elevation;
    if (data.friction !== undefined) this.data.friction = data.friction;
    if (data.bankAngle !== undefined) this.data.bankAngle = data.bankAngle;
    if (data.boostMultiplier !== undefined) this.data.boostMultiplier = data.boostMultiplier;
    if (data.driftBonus !== undefined) this.data.driftBonus = data.driftBonus;

    this.position = new Vector2(0, 0);
    this.generateGeometry();
  }

  public generateGeometry(): void {
    const halfWidth = this.data.width / 2;
    const length = this._segmentLength;
    const points: Vector3[] = [];

    switch (this.type) {
      case SegmentType.STRAIGHT:
        this._curvature = 0;
        this._tilt = 0;
        // Create straight rectangular segment
        for (let z = 0; z <= length; z += length / 4) {
          points.push(new Vector3(-halfWidth, 0, z));
          points.push(new Vector3(halfWidth, 0, z));
        }
        break;

      case SegmentType.CURVE_LEFT:
      case SegmentType.CURVE_RIGHT: {
        const curvatureDir = this.type === SegmentType.CURVE_LEFT ? 1 : -1;
        const radius = 300;
        const angle = Math.PI / 4 * curvatureDir; // 45 degree turn
        
        for (let t = 0; t <= 1; t += 1 / 16) {
          const currentAngle = angle * t * curvatureDir;
          const x = Math.sin(currentAngle) * radius;
          const z = radius * (1 - Math.cos(currentAngle)) + t * length;
          
          // Banking based on curve
          const bank = t * this.data.bankAngle * curvatureDir;
          
          points.push(new Vector3(x - halfWidth * Math.cos(bank), bank * 10, z));
          points.push(new Vector3(x + halfWidth * Math.cos(bank), bank * 10, z));
        }
        this._curvature = curvatureDir;
        this._tilt = this.data.bankAngle;
        break;
      }

      case SegmentType.JUMP:
        this._curvature = 0;
        this._tilt = 0;
        // Create ramp geometry
        for (let z = 0; z <= length; z += length / 8) {
          const rampHeight = Math.sin((z / length) * Math.PI / 2) * 15;
          points.push(new Vector3(-halfWidth, rampHeight, z));
          points.push(new Vector3(halfWidth, rampHeight, z));
        }
        break;

      case SegmentType.BOOST:
        this._curvature = 0;
        this._tilt = 0;
        // Boost section with visible markers
        for (let z = 0; z <= length; z += length / 4) {
          points.push(new Vector3(-halfWidth, 0, z));
          points.push(new Vector3(halfWidth, 0, z));
        }
        break;

      case SegmentType.CHICANE:
        this._curvature = 0;
        this._tilt = 0;
        // S-shaped chicane
        for (let z = 0; z <= length; z += length / 8) {
          const offset = Math.sin((z / length) * Math.PI * 2) * (halfWidth * 0.7);
          points.push(new Vector3(offset - halfWidth * 0.5, 0, z));
          points.push(new Vector3(offset + halfWidth * 0.5, 0, z));
        }
        break;

      case SegmentType.U_TURN:
        this._curvature = 0;
        this._tilt = 0;
        // 180 degree turn
        const uRadius = 150;
        for (let t = 0; t <= 1; t += 1 / 16) {
          const currentAngle = Math.PI * t;
          const x = Math.sin(currentAngle) * uRadius;
          const z = uRadius * (1 - Math.cos(currentAngle)) + t * length;
          
          const bank = t * this.data.bankAngle;
          points.push(new Vector3(x - halfWidth * Math.cos(bank), bank * 10, z));
          points.push(new Vector3(x + halfWidth * Math.cos(bank), bank * 10, z));
        }
        break;
    }

    this._heightPoints = points;
    this._geometry = this.buildConvexPolygons();
  }

  private buildConvexPolygons(): ConvexPolygon[] {
    const polygons: ConvexPolygon[] = [];
    const points = this._heightPoints;
    
    for (let i = 0; i < points.length - 2; i += 2) {
      polygons.push(new ConvexPolygon([
        points[i],
        points[i + 1],
        points[i + 2],
        points[i + 3]
      ]));
    }
    
    return polygons;
  }

  public getGeometry(): ConvexPolygon[] {
    return this._geometry;
  }

  public getHeightAtPosition(z: number): number {
    const sorted = [...this._heightPoints].sort((a, b) => a.z - b.z);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (z >= sorted[i].z && z <= sorted[i + 1].z) {
        const t = (z - sorted[i].z) / (sorted[i + 1].z - sorted[i].z);
        return sorted[i].y + (sorted[i + 1].y - sorted[i].y) * t;
      }
    }
    return 0;
  }

  public getBankAngleAtPosition(z: number): number {
    if (this.type === SegmentType.CURVE_LEFT || this.type === SegmentType.CURVE_RIGHT) {
      return this._tilt * (z / this._segmentLength) * this._curvature;
    }
    return 0;
  }

  public getFrictionAtPosition(): number {
    return this.data.friction;
  }

  public getBoostMultiplier(): number {
    return this.data.boostMultiplier;
  }

  public setNext(segment: TrackSegment): void {
    this.next = segment;
    segment.previous = this;
  }

  public setPrevious(segment: TrackSegment): void {
    this.previous = segment;
    segment.next = this;
  }

  public update(deltaTime: number): void {
    // Track segments don't move, but can have dynamic effects
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.save();
    
    const color = this.getColorByType();
    ctx.fillStyle = color;
    ctx.strokeStyle = this.getDarkerColor(color);
    ctx.lineWidth = 2;

    // Draw each polygon of the segment
    for (const poly of this._geometry) {
      ctx.beginPath();
      
      const vertices = poly.vertices.map(v => {
        const screenPos = camera.worldToScreen(v.x, v.y, v.z);
        return { x: screenPos.x, y: screenPos.y };
      });

      if (vertices.length > 0) {
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let i = 1; i < vertices.length; i++) {
          ctx.lineTo(vertices[i].x, vertices[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // Draw track markings
    this.drawTrackMarkings(ctx, camera);

    ctx.restore();
  }

  private getColorByType(): string {
    switch (this.type) {
      case SegmentType.STRAIGHT:
        return '#2c3e50';
      case SegmentType.CURVE_LEFT:
      case SegmentType.CURVE_RIGHT:
        return '#34495e';
      case SegmentType.JUMP:
        return '#e74c3c';
      case SegmentType.BOOST:
        return '#f39c12';
      case SegmentType.CHICANE:
        return '#9b59b6';
      case SegmentType.U_TURN:
        return '#8e44ad';
      default:
        return '#2c3e50';
    }
  }

  private getDarkerColor(color: string): string {
    return adjustColorBrightness(color, -30);
  }

  private drawTrackMarkings(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.save();
    ctx.globalAlpha = 0.5;
    
    // Center line
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 30]);
    
    ctx.beginPath();
    let firstPoint = true;
    
    for (let i = 0; i < this._heightPoints.length - 1; i += 2) {
      const midY = (this._heightPoints[i].y + this._heightPoints[i + 1].y) / 2;
      const midZ = (this._heightPoints[i].z + this._heightPoints[i + 1].z) / 2;
      const screenPos = camera.worldToScreen(0, midY, midZ);
      
      if (firstPoint) {
        ctx.moveTo(screenPos.x, screenPos.y);
        firstPoint = false;
      } else {
        ctx.lineTo(screenPos.x, screenPos.y);
      }
    }
    
    ctx.stroke();
    
    // Edge lines
    ctx.setLineDash([]);
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 4;
    
    ctx.beginPath();
    firstPoint = true;
    
    for (const point of this._heightPoints) {
      const screenPos = camera.worldToScreen(point.x, point.y, point.z);
      if (firstPoint) {
        ctx.moveTo(screenPos.x, screenPos.y);
        firstPoint = false;
      } else {
        ctx.lineTo(screenPos.x, screenPos.y);
      }
    }
    
    ctx.stroke();
    ctx.restore();
  }

  public containsPoint(position: Vector2): boolean {
    const zDist = Math.abs(position.y - this.position.y);
    return zDist < this._segmentLength * 0.5;
  }

  public clone(): TrackSegment {
    const clone = new TrackSegment(this.type, { ...this.data });
    clone.position = new Vector2(this.position.x, this.position.y);
    clone.generateGeometry();
    return clone;
  }
}

// Helper function to adjust color brightness
function adjustColorBrightness(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  
  return '#' + (0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
}

// Convex Polygon class for collision detection
class ConvexPolygon {
  public vertices: Vector3[];

  constructor(vertices: Vector3[]) {
    this.vertices = vertices;
  }

  public getCenter(): Vector3 {
    const sum = new Vector3(0, 0, 0);
    for (const v of this.vertices) {
      sum.add(v);
    }
    return sum.divide(this.vertices.length);
  }

  public normal(): Vector3 {
    const a = this.vertices[1].clone().subtract(this.vertices[0]);
    const b = this.vertices[2].clone().subtract(this.vertices[0]);
    return a.cross(b).normalize();
  }

  public area(): number {
    const n = this.normal();
    const sum = new Vector3(0, 0, 0);
    
    for (let i = 0; i < this.vertices.length; i++) {
      const v1 = this.vertices[i];
      const v2 = this.vertices[(i + 1) % this.vertices.length];
      const cross = v1.clone().cross(v2);
      sum.add(cross);
    }
    
    return sum.length() * 0.5;
  }
}