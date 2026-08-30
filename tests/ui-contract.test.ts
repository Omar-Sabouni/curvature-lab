import { describe, expect, it } from 'vitest';

import {
  EXPLORER_SHELL,
  legendAccessibilityLabel,
  surfacePlotLabel,
} from '../src/ui/ExplorerApp';
import { getSurface } from '../src/math/surfaces';

describe('explorer accessibility contract', () => {
  it('keeps source order aligned with the responsive visual order', () => {
    expect(EXPLORER_SHELL.indexOf('class="viewport-wrap"')).toBeLessThan(
      EXPLORER_SHELL.indexOf('class="sidebar"'),
    );
  });

  it('provides a keyboard path and signed, non-color scale labels', () => {
    expect(EXPLORER_SHELL).toContain('id="parameter-instructions"');
    expect(EXPLORER_SHELL.match(/aria-describedby="parameter-instructions"/g)).toHaveLength(2);
    expect(EXPLORER_SHELL).toContain('<span>Negative</span>');
    expect(EXPLORER_SHELL).toContain('<span>Near zero</span>');
    expect(EXPLORER_SHELL).toContain('<span>Positive</span>');
  });

  it('describes the current plot and scale without relying on color alone', () => {
    const torus = getSurface('torus');
    expect(surfacePlotLabel(torus, 'K')).toContain('colored by Gaussian curvature K');
    expect(surfacePlotLabel(torus, 'none')).toContain('uniform color');
    expect(legendAccessibilityLabel('K', { min: -2, max: 2 })).toContain(
      'negative values extend to -2, near zero is neutral, and positive values extend to 2',
    );
  });
});
