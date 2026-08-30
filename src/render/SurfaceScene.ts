import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { evaluateGeometry } from '../math/geometry';
import type { ParametricSurface, SurfaceGeometry } from '../math/types';

export type CurvatureField = 'K' | 'H' | 'k1' | 'k2' | 'none';

export interface ColorScale {
  min: number;
  max: number;
}

export interface SceneSelection {
  u: number;
  v: number;
  geometry: SurfaceGeometry;
}

export interface SurfaceSceneOptions {
  onSelect?: (selection: SceneSelection) => void;
  onScale?: (scale: ColorScale) => void;
}

type ParameterRange = ParametricSurface['domain']['u'] & { periodic?: boolean };

const BACKGROUND = '#ffffff';
const NEGATIVE = new THREE.Color('#2b6cb0');
const NEUTRAL = new THREE.Color('#e6e9e6');
const POSITIVE = new THREE.Color('#c0392b');
const DEFAULT_SCALE: ColorScale = { min: 0, max: 0 };

function finiteVector({ x, y, z }: { x: number; y: number; z: number }): boolean {
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);
}

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const position = fraction * (sorted.length - 1);
  const lower = Math.floor(position);
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[Math.min(lower + 1, sorted.length - 1)] * weight;
}

function normalizeParameter(value: number, range: ParameterRange): number {
  const span = range.max - range.min;
  if (range.periodic && span > 0) {
    return range.min + ((((value - range.min) % span) + span) % span);
  }
  return THREE.MathUtils.clamp(value, range.min, range.max);
}

export class SurfaceScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1_000);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  private readonly marker = new THREE.Mesh(
    new THREE.SphereGeometry(1, 18, 12),
    new THREE.MeshBasicMaterial({ color: 0x1a1a1a, depthTest: false }),
  );
  private readonly normalGeometry = new THREE.BufferGeometry();
  private readonly normalLine = new THREE.Line(
    this.normalGeometry,
    new THREE.LineBasicMaterial({ color: 0x1a1a1a, depthTest: false }),
  );

  private surface: ParametricSurface | null = null;
  private mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | null = null;
  private samples: Array<SurfaceGeometry | null> = [];
  private field: CurvatureField = 'K';
  private surfaceRadius = 1;
  private disposed = false;
  private pointerDown: { x: number; y: number } | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: SurfaceSceneOptions = {},
  ) {
    const background = getComputedStyle(container).getPropertyValue('--scene-background').trim();
    this.scene.background = new THREE.Color(background || BACKGROUND);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.setAttribute('aria-label', 'Three-dimensional parametric surface plot');
    this.renderer.domElement.setAttribute('aria-describedby', 'viewport-caption');
    this.container.appendChild(this.renderer.domElement);

    this.camera.position.set(4, 3, 5);
    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.minDistance = 0.05;
    this.controls.addEventListener('change', this.render);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 1.5));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.15);
    keyLight.position.set(4, 6, 5);
    this.scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
    fillLight.position.set(-5, 1, -3);
    this.scene.add(fillLight);

    this.marker.visible = false;
    this.marker.renderOrder = 3;
    this.normalLine.visible = false;
    this.normalLine.renderOrder = 2;
    this.scene.add(this.marker, this.normalLine);

    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.container);
    this.resize();
  }

  setSurface(surface: ParametricSurface): void {
    this.surface = surface;
    this.marker.visible = false;
    this.normalLine.visible = false;

    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
    }

    const geometry = this.createSurfaceGeometry(surface);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.name = surface.id;
    this.scene.add(this.mesh);
    this.updateColors();
    this.resetView();
    this.select(surface.initial.u, surface.initial.v);
  }

  setField(field: CurvatureField): void {
    if (field === this.field) return;
    this.field = field;
    this.updateColors();
  }

  setAccessibleLabel(label: string): void {
    this.renderer.domElement.setAttribute('aria-label', label);
  }

  select(u: number, v: number): void {
    if (!this.surface || !Number.isFinite(u) || !Number.isFinite(v)) return;
    const selectedU = normalizeParameter(u, this.surface.domain.u);
    const selectedV = normalizeParameter(v, this.surface.domain.v);

    let geometry: SurfaceGeometry;
    try {
      geometry = evaluateGeometry(this.surface, selectedU, selectedV);
    } catch {
      return;
    }

    const position = geometry.position;
    const normal = geometry.normal;
    if (!finiteVector(position) || !finiteVector(normal)) return;

    const markerSize = Math.max(this.surfaceRadius * 0.018, 0.004);
    this.marker.position.set(position.x, position.y, position.z);
    this.marker.scale.setScalar(markerSize);
    this.marker.visible = true;

    const normalLength = Math.max(this.surfaceRadius * 0.22, 0.05);
    this.normalGeometry.setFromPoints([
      new THREE.Vector3(position.x, position.y, position.z),
      new THREE.Vector3(
        position.x + normal.x * normalLength,
        position.y + normal.y * normalLength,
        position.z + normal.z * normalLength,
      ),
    ]);
    this.normalLine.visible = true;
    this.options.onSelect?.({ u: selectedU, v: selectedV, geometry });
    this.render();
  }

  resetView(): void {
    if (!this.mesh) return;
    const bounds = new THREE.Box3().setFromObject(this.mesh);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    if (!Number.isFinite(sphere.radius)) return;

    this.surfaceRadius = Math.max(sphere.radius, 0.01);
    const halfVerticalFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const halfHorizontalFov = Math.atan(Math.tan(halfVerticalFov) * this.camera.aspect);
    const halfFov = Math.min(halfVerticalFov, halfHorizontalFov);
    const distance = (this.surfaceRadius / Math.tan(halfFov)) * 1.02;
    const direction = new THREE.Vector3(1.15, 0.78, 1.25).normalize();
    this.controls.target.copy(sphere.center);
    this.camera.position.copy(sphere.center).addScaledVector(direction, distance);
    this.camera.near = Math.max(distance / 500, 0.001);
    this.camera.far = Math.max(distance * 50, 100);
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = Math.max(this.surfaceRadius * 0.08, 0.01);
    this.controls.maxDistance = Math.max(this.surfaceRadius * 20, 10);
    this.controls.update();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.controls.removeEventListener('change', this.render);
    this.controls.dispose();
    this.mesh?.geometry.dispose();
    this.material.dispose();
    this.marker.geometry.dispose();
    this.marker.material.dispose();
    this.normalGeometry.dispose();
    (this.normalLine.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private createSurfaceGeometry(surface: ParametricSurface): THREE.BufferGeometry {
    const uSegments = THREE.MathUtils.clamp(Math.round(surface.resolution.u), 24, 144);
    const vSegments = THREE.MathUtils.clamp(Math.round(surface.resolution.v), 24, 144);
    const columns = uSegments + 1;
    const vertexCount = columns * (vSegments + 1);
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const valid = new Uint8Array(vertexCount);
    this.samples = new Array<SurfaceGeometry | null>(vertexCount).fill(null);

    for (let row = 0; row <= vSegments; row += 1) {
      const vFraction = row / vSegments;
      const v = THREE.MathUtils.lerp(surface.domain.v.min, surface.domain.v.max, vFraction);
      for (let column = 0; column <= uSegments; column += 1) {
        const uFraction = column / uSegments;
        const u = THREE.MathUtils.lerp(surface.domain.u.min, surface.domain.u.max, uFraction);
        const index = row * columns + column;
        uvs[index * 2] = uFraction;
        uvs[index * 2 + 1] = vFraction;

        try {
          const sample = evaluateGeometry(surface, u, v);
          if (!finiteVector(sample.position) || !finiteVector(sample.normal)) continue;
          const offset = index * 3;
          positions[offset] = sample.position.x;
          positions[offset + 1] = sample.position.y;
          positions[offset + 2] = sample.position.z;
          normals[offset] = sample.normal.x;
          normals[offset + 1] = sample.normal.y;
          normals[offset + 2] = sample.normal.z;
          this.samples[index] = sample;
          valid[index] = 1;
        } catch {
          // Keep a finite position at a chart singularity (for example a sphere pole).
          const position = surface.evaluate(u, v).position;
          if (!finiteVector(position)) continue;
          const offset = index * 3;
          positions[offset] = position.x;
          positions[offset + 1] = position.y;
          positions[offset + 2] = position.z;
          valid[index] = 1;
        }
      }
    }

    const indices: number[] = [];
    for (let row = 0; row < vSegments; row += 1) {
      for (let column = 0; column < uSegments; column += 1) {
        const a = row * columns + column;
        const b = a + 1;
        const d = a + columns;
        const c = d + 1;
        if (valid[a] && valid[b] && valid[c] && valid[d]) {
          indices.push(a, b, d, b, c, d);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const normalAttribute = geometry.getAttribute('normal');
    this.samples.forEach((sample, index) => {
      if (sample) normalAttribute.setXYZ(index, sample.normal.x, sample.normal.y, sample.normal.z);
    });
    geometry.computeBoundingSphere();
    return geometry;
  }

  private updateColors(): void {
    const colorAttribute = this.mesh?.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (!colorAttribute) return;

    const field = this.field;
    const values = field === 'none'
      ? []
      : this.samples
        .map((sample) => sample?.[field])
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const magnitudes = values.map(Math.abs).sort((a, b) => a - b);
    const measuredLimit = percentile(magnitudes, 0.95);
    const limit = measuredLimit > 1e-12 ? measuredLimit : 0;
    const scale = limit > 0 ? { min: -limit, max: limit } : DEFAULT_SCALE;
    const color = new THREE.Color();

    for (let index = 0; index < this.samples.length; index += 1) {
      const value = field === 'none' ? null : this.samples[index]?.[field];
      if (value === null || value === undefined || !Number.isFinite(value) || limit === 0) {
        color.copy(NEUTRAL);
      } else if (value < 0) {
        color.copy(NEUTRAL).lerp(NEGATIVE, Math.min(-value / limit, 1));
      } else {
        color.copy(NEUTRAL).lerp(POSITIVE, Math.min(value / limit, 1));
      }
      colorAttribute.setXYZ(index, color.r, color.g, color.b);
    }
    colorAttribute.needsUpdate = true;
    this.options.onScale?.(field === 'none' ? DEFAULT_SCALE : scale);
    this.render();
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button === 0) this.pointerDown = { x: event.clientX, y: event.clientY };
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const start = this.pointerDown;
    this.pointerDown = null;
    if (!start || !this.mesh || !this.surface || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;

    const bounds = this.renderer.domElement.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.mesh, false)[0];
    if (!hit?.uv) return;
    this.select(
      THREE.MathUtils.lerp(this.surface.domain.u.min, this.surface.domain.u.max, hit.uv.x),
      THREE.MathUtils.lerp(this.surface.domain.v.min, this.surface.domain.v.max, hit.uv.y),
    );
  };

  private readonly resize = (): void => {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.render();
  };

  private readonly render = (): void => {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  };
}
