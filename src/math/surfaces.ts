import type { ParametricSurface, SurfaceEvaluation, SurfaceId } from './types';

const torus: ParametricSurface = {
  id: 'torus',
  name: 'Torus',
  equation: 'X(u,v) = ((2 + 0.7 cos v) cos u, (2 + 0.7 cos v) sin u, 0.7 sin v)',
  domain: {
    u: { min: -Math.PI, max: Math.PI, periodic: true },
    v: { min: -Math.PI, max: Math.PI, periodic: true },
  },
  initial: { u: 0.6, v: 0.8 },
  resolution: { u: 96, v: 64 },
  evaluate(u, v): SurfaceEvaluation {
    const R = 2;
    const r = 0.7;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    const cv = Math.cos(v);
    const sv = Math.sin(v);
    const radius = R + r * cv;

    return {
      position: { x: radius * cu, y: radius * su, z: r * sv },
      du: { x: -radius * su, y: radius * cu, z: 0 },
      dv: { x: -r * sv * cu, y: -r * sv * su, z: r * cv },
      duu: { x: -radius * cu, y: -radius * su, z: 0 },
      duv: { x: r * sv * su, y: -r * sv * cu, z: 0 },
      dvv: { x: -r * cv * cu, y: -r * cv * su, z: -r * sv },
    };
  },
};

const sphere: ParametricSurface = {
  id: 'sphere',
  name: 'Sphere',
  equation: 'X(u,v) = (cos v cos u, cos v sin u, sin v)',
  domain: {
    u: { min: -Math.PI, max: Math.PI, periodic: true },
    v: { min: -Math.PI / 2 + 0.03, max: Math.PI / 2 - 0.03 },
  },
  initial: { u: 0.7, v: 0.25 },
  resolution: { u: 96, v: 64 },
  evaluate(u, v): SurfaceEvaluation {
    const cu = Math.cos(u);
    const su = Math.sin(u);
    const cv = Math.cos(v);
    const sv = Math.sin(v);

    return {
      position: { x: cv * cu, y: cv * su, z: sv },
      du: { x: -cv * su, y: cv * cu, z: 0 },
      dv: { x: -sv * cu, y: -sv * su, z: cv },
      duu: { x: -cv * cu, y: -cv * su, z: 0 },
      duv: { x: sv * su, y: -sv * cu, z: 0 },
      dvv: { x: -cv * cu, y: -cv * su, z: -sv },
    };
  },
};

const saddle: ParametricSurface = {
  id: 'hyperbolic-paraboloid',
  name: 'Saddle',
  equation: 'X(u,v) = (u, v, (u² - v²) / 2)',
  domain: {
    u: { min: -1.6, max: 1.6 },
    v: { min: -1.6, max: 1.6 },
  },
  initial: { u: 0.55, v: -0.4 },
  resolution: { u: 72, v: 72 },
  evaluate(u, v): SurfaceEvaluation {
    return {
      position: { x: u, y: v, z: (u * u - v * v) / 2 },
      du: { x: 1, y: 0, z: u },
      dv: { x: 0, y: 1, z: -v },
      duu: { x: 0, y: 0, z: 1 },
      duv: { x: 0, y: 0, z: 0 },
      dvv: { x: 0, y: 0, z: -1 },
    };
  },
};

const catenoid: ParametricSurface = {
  id: 'catenoid',
  name: 'Catenoid',
  equation: 'X(u,v) = (cosh v cos u, cosh v sin u, v)',
  domain: {
    u: { min: -Math.PI, max: Math.PI, periodic: true },
    v: { min: -1.5, max: 1.5 },
  },
  initial: { u: 0.65, v: 0.45 },
  resolution: { u: 96, v: 64 },
  evaluate(u, v): SurfaceEvaluation {
    const cu = Math.cos(u);
    const su = Math.sin(u);
    const ch = Math.cosh(v);
    const sh = Math.sinh(v);

    return {
      position: { x: ch * cu, y: ch * su, z: v },
      du: { x: -ch * su, y: ch * cu, z: 0 },
      dv: { x: sh * cu, y: sh * su, z: 1 },
      duu: { x: -ch * cu, y: -ch * su, z: 0 },
      duv: { x: -sh * su, y: sh * cu, z: 0 },
      dvv: { x: ch * cu, y: ch * su, z: 0 },
    };
  },
};

export const SURFACES: readonly ParametricSurface[] = [torus, sphere, saddle, catenoid];

export function getSurface(id: SurfaceId): ParametricSurface {
  const surface = SURFACES.find((candidate) => candidate.id === id);
  if (!surface) throw new RangeError(`Unknown surface: ${id}`);
  return surface;
}
