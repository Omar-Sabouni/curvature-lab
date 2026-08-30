import { describe, expect, it } from 'vitest';
import { clampParameter, evaluateGeometry } from '../src/math/geometry';
import { getSurface, SURFACES } from '../src/math/surfaces';

const scalarFields = [
  'E', 'F', 'G', 'e', 'f', 'g', 'areaElement', 'K', 'H', 'k1', 'k2',
] as const;

describe('surface geometry', () => {
  it('has the known curvature of the unit sphere', () => {
    const geometry = evaluateGeometry(getSurface('sphere'), 0.4, -0.3);

    expect(geometry.K).toBeCloseTo(1, 12);
    expect(geometry.H).toBeCloseTo(-1, 12);
    expect(geometry.k1).toBeCloseTo(-1, 12);
    expect(geometry.k2).toBeCloseTo(-1, 12);
    expect(Math.hypot(
      geometry.position.x,
      geometry.position.y,
      geometry.position.z,
    )).toBeCloseTo(1, 12);
  });

  it('has negative Gaussian curvature at the saddle point', () => {
    const geometry = evaluateGeometry(getSurface('hyperbolic-paraboloid'), 0, 0);

    expect(geometry.K).toBeCloseTo(-1, 12);
    expect(geometry.H).toBeCloseTo(0, 12);
    expect(geometry.k1).toBeCloseTo(-1, 12);
    expect(geometry.k2).toBeCloseTo(1, 12);
  });

  it('changes Gaussian-curvature sign across the torus', () => {
    const torus = getSurface('torus');

    expect(evaluateGeometry(torus, 0, 0).K).toBeGreaterThan(0);
    expect(evaluateGeometry(torus, 0, Math.PI).K).toBeLessThan(0);
  });

  it('keeps the catenoid mean curvature at zero', () => {
    const catenoid = getSurface('catenoid');

    for (const [u, v] of [[0, 0], [0.8, 0.5], [-1.2, -0.9]] as const) {
      const geometry = evaluateGeometry(catenoid, u, v);
      expect(Math.abs(geometry.H)).toBeLessThan(1e-12);
      expect(geometry.K).toBeLessThan(0);
    }
  });

  it('returns finite values at ordinary samples on every built-in surface', () => {
    for (const surface of SURFACES) {
      const { u, v } = surface.initial;
      const geometry = evaluateGeometry(surface, u, v);

      expect(Object.values(geometry.position).every(Number.isFinite), surface.id).toBe(true);
      expect(Object.values(geometry.normal).every(Number.isFinite), surface.id).toBe(true);
      for (const field of scalarFields) {
        expect(Number.isFinite(geometry[field]), `${surface.id}.${field}`).toBe(true);
      }
    }
  });

  it('clamps parameters and rejects singular or non-finite geometry', () => {
    const range = { min: -1, max: 1 };
    expect(clampParameter(-2, range)).toBe(-1);
    expect(clampParameter(0.25, range)).toBe(0.25);
    expect(clampParameter(2, range)).toBe(1);
    expect(() => evaluateGeometry(getSurface('sphere'), 0, Math.PI / 2)).toThrow(/singular/);
    expect(() => evaluateGeometry(getSurface('sphere'), Number.NaN, 0)).toThrow(/non-finite/);
  });
});
