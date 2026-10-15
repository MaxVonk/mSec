import { describe, it } from 'node:test';
import assert from 'node:assert';
import { THEMES, DEFAULT_THEME_ID, getThemeById } from '../src/themes/themeDefinitions.js';

describe('VS Code-Style Theme Engine Suite', () => {
  it('should load all 10 curated developer and tactical themes', () => {
    assert.strictEqual(THEMES.length, 10, 'Expected exactly 10 themes in catalog');
  });

  it('should include popular themes: cyber-cyan, dracula-pro, tokyo-night, catppuccin-mocha, nordic-frost, monokai-pro, crimson-alert, matrix-terminal', () => {
    const ids = THEMES.map(t => t.id);
    const expected = [
      'cyber-cyan',
      'dracula-pro',
      'tokyo-night',
      'catppuccin-mocha',
      'nordic-frost',
      'monokai-pro',
      'crimson-alert',
      'matrix-terminal',
      'synthwave-84',
      'github-dark-dimmed'
    ];

    for (const exp of expected) {
      assert.ok(ids.includes(exp), `Expected theme "${exp}" to be present`);
    }
  });

  it('should ensure each theme has unique ID and non-empty name/author/description', () => {
    const ids = new Set<string>();
    for (const theme of THEMES) {
      assert.ok(!ids.has(theme.id), `Duplicate theme id found: ${theme.id}`);
      ids.add(theme.id);

      assert.ok(theme.name.trim().length > 0, `Theme ${theme.id} name is empty`);
      assert.ok(theme.author.trim().length > 0, `Theme ${theme.id} author is empty`);
      assert.ok(theme.description.trim().length > 0, `Theme ${theme.id} description is empty`);
    }
  });

  it('should validate each theme has 5 swatch colors and valid color tokens', () => {
    for (const theme of THEMES) {
      assert.strictEqual(theme.swatches.length, 5, `Theme ${theme.id} must have 5 swatches`);
      for (const swatch of theme.swatches) {
        assert.ok(swatch.startsWith('#'), `Swatch ${swatch} in theme ${theme.id} must be hex`);
      }

      const { colors } = theme;
      assert.ok(colors.bgApp.startsWith('#'), `bgApp must be hex in ${theme.id}`);
      assert.ok(colors.bgCard.startsWith('#'), `bgCard must be hex in ${theme.id}`);
      assert.ok(colors.border.startsWith('#'), `border must be hex in ${theme.id}`);
      assert.ok(colors.accent.startsWith('#'), `accent must be hex in ${theme.id}`);
      assert.ok(colors.textPrimary.startsWith('#'), `textPrimary must be hex in ${theme.id}`);
    }
  });

  it('should retrieve theme by ID or fallback to default', () => {
    const dracula = getThemeById('dracula-pro');
    assert.strictEqual(dracula.name, 'Dracula Pro');

    const fallback = getThemeById('non-existent-theme-xyz');
    assert.strictEqual(fallback.id, DEFAULT_THEME_ID);
  });
});

