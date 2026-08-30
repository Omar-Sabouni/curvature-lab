import { getSurface, SURFACES } from '../math/surfaces';
import type { ParameterRange, ParametricSurface, SurfaceGeometry, SurfaceId } from '../math/types';
import {
  SurfaceScene,
  type ColorScale,
  type CurvatureField,
  type SceneSelection,
} from '../render/SurfaceScene';

type Axis = 'u' | 'v';
type CurvatureKey = 'K' | 'H' | 'k1' | 'k2';

export const FIELD_LABELS: Record<CurvatureField, string> = {
  K: 'Gaussian curvature K',
  H: 'Mean curvature H',
  k1: 'Minimum principal curvature k₁',
  k2: 'Maximum principal curvature k₂',
  none: 'No curvature color',
};

export const SURFACE_NOTES: Record<SurfaceId, string> = {
  torus: 'K < 0 on the inside,\nK > 0 on the outside',
  sphere: 'K = 1 everywhere.\nBoring, but correct.',
  'hyperbolic-paraboloid': 'a saddle:\nK < 0 everywhere',
  catenoid: 'H = 0 everywhere.\nIt is a soap film.',
};

export const EXPLORER_SHELL = `
  <div class="app-shell">
    <header class="site-header">
      <h1>Curvature Lab</h1>
      <a class="home-link" href="https://omar-sabouni.github.io/">Omar Sabouni</a>
    </header>
    <main class="workspace">
      <section class="viewport-wrap" aria-labelledby="viewport-heading">
        <h2 class="sr-only" id="viewport-heading">Surface plot</h2>
        <figure class="figure">
          <div class="viewport" id="surface-viewport"></div>
          <p class="margin-note" aria-hidden="true">
            <span class="margin-note-text"></span>
            <svg viewBox="0 0 160 120" width="160" height="120" focusable="false"><path d="M150 4 C 140 40, 110 70, 70 88 S 24 108, 10 112" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M24 100 L 9 112 L 26 117" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </p>
          <figcaption>
            <span class="fig-label">Figure 1.</span> <span class="figure-title"></span>
            Drag to turn it, click to pick a point.
            <span class="data-legend" id="curvature-legend" data-field="K" role="group" aria-label="Curvature color scale">
              <span class="legend-title" hidden>Gaussian curvature K</span>
              <span class="legend-stop"><span class="legend-swatch legend-swatch-negative" aria-hidden="true"></span><span>Negative</span> to <output class="legend-min">—</output>,</span>
              <span class="legend-stop"><span class="legend-swatch legend-swatch-zero" aria-hidden="true"></span><span>Near zero</span>,</span>
              <span class="legend-stop"><span class="legend-swatch legend-swatch-positive" aria-hidden="true"></span><span>Positive</span> to <output class="legend-max">—</output>.</span>
            </span>
          </figcaption>
        </figure>
      </section>

      <aside class="sidebar" aria-label="Surface controls and curvature values">
        <div class="controls">
          <label for="surface-select">Surface</label>
          <select id="surface-select" aria-controls="surface-viewport surface-equation"></select>
          <label for="field-select">Colour by</label>
          <select id="field-select" aria-controls="surface-viewport curvature-legend">
            <option value="K">Gaussian curvature K</option>
            <option value="H">Mean curvature H</option>
            <option value="k1">Principal curvature k₁</option>
            <option value="k2">Principal curvature k₂</option>
            <option value="none">Nothing</option>
          </select>
          <label for="u-slider"><i>u</i></label>
          <span class="slider"><input id="u-slider" type="range" aria-label="Surface parameter u" aria-describedby="parameter-instructions" aria-controls="surface-viewport" /><output for="u-slider" class="u-value">—</output></span>
          <label for="v-slider"><i>v</i></label>
          <span class="slider"><input id="v-slider" type="range" aria-label="Surface parameter v" aria-describedby="parameter-instructions" aria-controls="surface-viewport" /><output for="v-slider" class="v-value">—</output></span>
        </div>
        <p class="surface-equation" id="surface-equation" aria-live="polite"></p>
        <p class="readout" aria-label="Curvature at the selected point">
          <span><i>K</i> = <span class="value-K">—</span></span>
          <span><i>H</i> = <span class="value-H">—</span></span>
          <span><i>k</i><sub>1</sub> = <span class="value-k1">—</span></span>
          <span><i>k</i><sub>2</sub> = <span class="value-k2">—</span></span>
        </p>
        <button class="reset-view" type="button" aria-controls="surface-viewport">Reset view</button>
      </aside>
    </main>
    <p class="sr-only" id="parameter-instructions">Arrow keys move the point along u or v.</p>
    <p class="sr-only selection-status" role="status" aria-live="polite"></p>
  </div>`;

export function surfacePlotLabel(surface: ParametricSurface, field: CurvatureField): string {
  const colorDescription = field === 'none'
    ? 'shown in a uniform color'
    : `colored by ${FIELD_LABELS[field]}`;
  return `${surface.name} three-dimensional surface plot, ${colorDescription}; selected point and unit normal shown.`;
}

export function legendAccessibilityLabel(field: CurvatureField, scale: ColorScale): string {
  if (field === 'none') {
    return 'Surface shown in a uniform color; curvature remains available as numeric values.';
  }
  return `${FIELD_LABELS[field]}; negative values extend to ${format(scale.min)}, near zero is neutral, and positive values extend to ${format(scale.max)}.`;
}

function typeset(value: string): string {
  return value.replace('-', '\u2212');
}

function format(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1e-12) return '0';
  const magnitude = Math.abs(value);
  if (magnitude >= 1e4 || magnitude < 1e-3) return value.toExponential(2);
  return Number(value.toPrecision(4)).toString();
}

export class ExplorerApp {
  private readonly events = new AbortController();
  private readonly scene: SurfaceScene;
  private readonly shell: HTMLElement;
  private readonly surfaceSelect: HTMLSelectElement;
  private readonly fieldSelect: HTMLSelectElement;
  private readonly sliders: Record<Axis, HTMLInputElement>;
  private readonly parameterValues: Record<Axis, HTMLOutputElement>;
  private readonly curvatureValues: Record<CurvatureKey, HTMLElement>;
  private readonly surfaceEquation: HTMLElement;
  private readonly legend: HTMLElement;
  private readonly legendTitle: HTMLElement;
  private readonly legendMin: HTMLElement;
  private readonly legendMax: HTMLElement;
  private readonly selectionStatus: HTMLElement;
  private readonly figureTitle: HTMLElement;
  private readonly marginNote: HTMLElement;
  private surface: ParametricSurface;
  private field: CurvatureField = 'K';
  private disposed = false;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = EXPLORER_SHELL;
    this.shell = this.find('.app-shell');
    this.surfaceSelect = this.find('#surface-select');
    this.fieldSelect = this.find('#field-select');
    this.sliders = { u: this.find('#u-slider'), v: this.find('#v-slider') };
    this.parameterValues = { u: this.find('.u-value'), v: this.find('.v-value') };
    this.curvatureValues = {
      K: this.find('.value-K'),
      H: this.find('.value-H'),
      k1: this.find('.value-k1'),
      k2: this.find('.value-k2'),
    };
    this.surfaceEquation = this.find('.surface-equation');
    this.legend = this.find('.data-legend');
    this.legendTitle = this.find('.legend-title');
    this.legendMin = this.find('.legend-min');
    this.legendMax = this.find('.legend-max');
    this.selectionStatus = this.find('.selection-status');
    this.figureTitle = this.find('.figure-title');
    this.marginNote = this.find('.margin-note-text');

    for (const surface of SURFACES) {
      this.surfaceSelect.add(new Option(surface.name, surface.id));
    }
    this.surface = getSurface('torus');
    this.surfaceSelect.value = this.surface.id;
    this.configureSurface();

    try {
      this.scene = new SurfaceScene(this.find('.viewport'), {
        onSelect: (selection) => this.updateSelection(selection),
        onScale: (scale) => this.updateLegend(scale),
      });
      this.bindControls();
      this.scene.setField(this.field);
      this.scene.setSurface(this.surface);
      this.updateSurfacePlotLabel();
    } catch (error) {
      this.events.abort();
      this.shell.remove();
      throw error;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.events.abort();
    this.scene.dispose();
    this.shell.remove();
  }

  private find<T extends Element>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing ExplorerApp element: ${selector}`);
    return element;
  }

  private bindControls(): void {
    const signal = this.events.signal;
    this.surfaceSelect.addEventListener('change', () => {
      this.surface = getSurface(this.surfaceSelect.value as SurfaceId);
      this.configureSurface();
      this.scene.setSurface(this.surface);
      this.updateSurfacePlotLabel();
    }, { signal });
    this.fieldSelect.addEventListener('change', () => {
      this.field = this.fieldSelect.value as CurvatureField;
      this.legend.dataset.field = this.field;
      this.legendTitle.textContent = FIELD_LABELS[this.field];
      if (this.field === 'none') this.updateLegend({ min: 0, max: 0 });
      this.scene.setField(this.field);
      this.updateSurfacePlotLabel();
    }, { signal });
    for (const axis of ['u', 'v'] as const) {
      this.sliders[axis].addEventListener('input', () => {
        this.scene.select(Number(this.sliders.u.value), Number(this.sliders.v.value));
      }, { signal });
    }
    this.find<HTMLButtonElement>('.reset-view').addEventListener(
      'click',
      () => this.scene.resetView(),
      { signal },
    );
  }

  private configureSurface(): void {
    this.surfaceEquation.textContent = this.surface.equation;
    for (const axis of ['u', 'v'] as const) {
      const range = this.surface.domain[axis];
      const divisions = this.surface.resolution[axis];
      const slider = this.sliders[axis];
      slider.min = String(range.min);
      slider.max = String(range.max);
      slider.step = String((range.max - range.min) / divisions);
      slider.value = String(this.surface.initial[axis]);
      slider.dataset.periodic = String(Boolean(range.periodic));
      slider.setAttribute('aria-valuetext', format(this.surface.initial[axis]));
      this.parameterValues[axis].value = format(this.surface.initial[axis]);
    }
  }

  private updateSelection({ u, v, geometry }: SceneSelection): void {
    this.setParameter('u', u, this.surface.domain.u);
    this.setParameter('v', v, this.surface.domain.v);
    for (const key of ['K', 'H', 'k1', 'k2'] as const) {
      this.curvatureValues[key].textContent = typeset(format(geometry[key]));
    }
    this.selectionStatus.textContent = `${this.surface.name}, u ${format(u)}, v ${format(v)}. ${this.curvatureText(geometry)}`;
  }

  private setParameter(axis: Axis, value: number, range: ParameterRange): void {
    const bounded = Math.min(range.max, Math.max(range.min, value));
    this.sliders[axis].value = String(bounded);
    this.sliders[axis].setAttribute('aria-valuetext', format(bounded));
    this.parameterValues[axis].value = format(bounded);
  }

  private curvatureText(geometry: SurfaceGeometry): string {
    return `K ${format(geometry.K)}, H ${format(geometry.H)}, k₁ ${format(geometry.k1)}, k₂ ${format(geometry.k2)}.`;
  }

  private updateLegend(scale: ColorScale): void {
    const noScale = this.field === 'none';
    this.legendMin.textContent = noScale ? '—' : typeset(format(scale.min));
    this.legendMax.textContent = noScale ? '—' : typeset(format(scale.max));
    this.legend.setAttribute('aria-label', legendAccessibilityLabel(this.field, scale));
  }

  private updateSurfacePlotLabel(): void {
    this.scene.setAccessibleLabel(surfacePlotLabel(this.surface, this.field));
    this.figureTitle.textContent = this.field === 'none'
      ? `${this.surface.name}.`
      : `${this.surface.name}, coloured by ${FIELD_LABELS[this.field]}.`;
    this.marginNote.textContent = SURFACE_NOTES[this.surface.id];
  }
}
