export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ParameterRange {
  min: number;
  max: number;
  periodic?: boolean;
}

export interface SurfaceDomain {
  u: ParameterRange;
  v: ParameterRange;
}

export interface SurfaceEvaluation {
  position: Vec3;
  du: Vec3;
  dv: Vec3;
  duu: Vec3;
  duv: Vec3;
  dvv: Vec3;
}

export type SurfaceId =
  | 'torus'
  | 'sphere'
  | 'hyperbolic-paraboloid'
  | 'catenoid';

export interface ParametricSurface {
  id: SurfaceId;
  name: string;
  equation: string;
  domain: SurfaceDomain;
  initial: { u: number; v: number };
  resolution: { u: number; v: number };
  evaluate(u: number, v: number): SurfaceEvaluation;
}

export interface SurfaceGeometry {
  position: Vec3;
  normal: Vec3;
  E: number;
  F: number;
  G: number;
  e: number;
  f: number;
  g: number;
  areaElement: number;
  K: number;
  H: number;
  k1: number;
  k2: number;
}
