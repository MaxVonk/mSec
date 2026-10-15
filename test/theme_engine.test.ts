import { describe, it } from 'node:test';
import assert from 'node:assert';
import { THEMES, DEFAULT_THEME_ID, getThemeById } from '../src/themes/themeDefinitions.js';

describe('VS Code-Style Theme Engine Suite', () => {
  it('should load all 15 curated developer, tactical, and clean light themes', () => {
    assert.strictEqual(THEMES.length, 15, 'Expected exactly 15 themes in catalog');
  });

  it('should include 10 dark themes and 5 light themes', () => {
    const darkThemes = THEMES.filter(t => t.type === 'dark');
    const lightThemes = THEMES.filter(t => t.type === 'light');
    assert.strictEqual(darkThemes.length, 10, 'Expected 10 dark themes');
    assert.strictEqual(lightThemes.length, 5, 'Expected 5 light themes');
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
      'github-dark-dimmed',
      'github-light',
      'catppuccin-latte',
      'nord-light',
      'solarized-light',
      'quiet-light'
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

  it('should retrieve light themes by ID and fallback cleanly', () => {
    const githubLight = getThemeById('github-light');
    assert.strictEqual(githubLight.name, 'GitHub Light');
    assert.strictEqual(githubLight.type, 'light');
    assert.strictEqual(githubLight.category, 'light');

    const catppuccinLatte = getThemeById('catppuccin-latte');
    assert.strictEqual(catppuccinLatte.type, 'light');

    const fallback = getThemeById('non-existent-theme-xyz');
    assert.strictEqual(fallback.id, DEFAULT_THEME_ID);
  });
});
