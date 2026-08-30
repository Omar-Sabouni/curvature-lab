# Curvature Lab

Curvature Lab is a small browser tool for exploring differential geometry on parametric surfaces. Choose a surface, color it by a curvature measure, and select a point to inspect its local values.

The app includes a torus, sphere, hyperbolic paraboloid, and catenoid. Drag to rotate the surface, scroll to zoom, and use the `u` and `v` controls for precise point selection.

## Mathematics

Each surface provides analytic first and second derivatives. From those, the app computes the first and second fundamental forms and reports:

- Gaussian curvature `K`
- mean curvature `H`
- minimum principal curvature `k₁`
- maximum principal curvature `k₂`

The color range is scaled to the sampled surface. The selected point is marked and its unit normal is shown in the viewport.

This is a visual explorer, not a symbolic algebra system or a general-purpose geometry library. It operates on four fixed, regular parameterizations.

## Run

```bash
npm install
npm run dev
```
