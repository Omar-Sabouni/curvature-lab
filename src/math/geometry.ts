import type { ParameterRange, ParametricSurface, SurfaceGeometry, Vec3 } from './types';

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function finiteVector(vector: Vec3): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

export function evaluateGeometry(
  surface: ParametricSurface,
  u: number,
  v: number,
): SurfaceGeometry {
  const evaluation = surface.evaluate(u, v);
  const vectors = Object.values(evaluation);
  if (!vectors.every(finiteVector)) {
    throw new RangeError('Surface evaluation produced non-finite values.');
  }

  const { position, du, dv, duu, duv, dvv } = evaluation;
  const E = dot(du, du);
  const F = dot(du, dv);
  const G = dot(dv, dv);
  const normalVector = cross(du, dv);
  const areaElement = Math.hypot(normalVector.x, normalVector.y, normalVector.z);
  const determinant = E * G - F * F;

  if (!Number.isFinite(areaElement) || !Number.isFinite(determinant)) {
    throw new RangeError('Surface geometry is non-finite.');
  }
  if (areaElement < 1e-12 || determinant <= 0) {
    throw new RangeError('Surface parametrization is singular at this point.');
  }

  const normal = {
    x: normalVector.x / areaElement,
    y: normalVector.y / areaElement,
    z: normalVector.z / areaElement,
  };
  const e = dot(duu, normal);
  const f = dot(duv, normal);
  const g = dot(dvv, normal);
  const K = (e * g - f * f) / determinant;
  const H = (e * G - 2 * f * F + g * E) / (2 * determinant);
  const discriminant = H * H - K;
  const spread = discriminant <= 1e-12 * Math.max(1, H * H, Math.abs(K))
    ? 0
    : Math.sqrt(discriminant);
  const geometry = {
    position,
    normal,
    E,
    F,
    G,
    e,
    f,
    g,
    areaElement,
    K,
    H,
    k1: H - spread,
    k2: H + spread,
  };

  if (!Object.values(geometry).every((value) =>
    typeof value === 'number' ? Number.isFinite(value) : finiteVector(value)
  )) {
    throw new RangeError('Surface geometry is non-finite.');
  }

  return geometry;
}

export function clampParameter(value: number, range: ParameterRange): number {
  return Math.min(range.max, Math.max(range.min, value));
}
