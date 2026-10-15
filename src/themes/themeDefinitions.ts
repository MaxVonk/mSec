export interface ThemeColorSet {
  bgApp: string;        // mapped to slate-950
  bgCard: string;       // mapped to slate-900
  bgCardHover: string;  // mapped to slate-850 / slate-800
  border: string;       // mapped to slate-800
  borderFocus: string;  // mapped to slate-700
  accent: string;       // mapped to cyan-500
  accentLight: string;  // mapped to cyan-400
  accentDark: string;   // mapped to cyan-600
  accentSubtle: string; // mapped to cyan-950
  textPrimary: string;
  textSecondary: string;
}

export interface AppTheme {
  id: string;
  name: string;
  category: 'cyber' | 'dev' | 'tactical' | 'clean';
  author: string;
  description: string;
  swatches: string[];
  colors: ThemeColorSet;
}

export const THEMES: AppTheme[] = [
  {
    id: 'cyber-cyan',
    name: 'Cyber Cyan (Default)',
    category: 'cyber',
    author: 'mSec Core',
    description: 'Tactical command center palette with high-contrast cyan radar telemetry.',
    swatches: ['#020617', '#0f172a', '#06b6d4', '#22d3ee', '#10b981'],
    colors: {
      bgApp: '#020617',
      bgCard: '#0f172a',
      bgCardHover: '#1e293b',
      border: '#1e293b',
      borderFocus: '#334155',
      accent: '#06b6d4',
      accentLight: '#22d3ee',
      accentDark: '#0891b2',
      accentSubtle: '#083344',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8'
    }
  },
  {
    id: 'dracula-pro',
    name: 'Dracula Pro',
    category: 'dev',
    author: 'Zeno Rocha',
    description: 'Iconic dark palette for hackers featuring vivid magenta, violet, and electric cyan.',
    swatches: ['#282a36', '#343746', '#ff79c6', '#bd93f9', '#50fa7b'],
    colors: {
      bgApp: '#1e1f29',
      bgCard: '#282a36',
      bgCardHover: '#343746',
      border: '#44475a',
      borderFocus: '#6272a4',
      accent: '#bd93f9',
      accentLight: '#ff79c6',
      accentDark: '#9a6fd8',
      accentSubtle: '#3b244d',
      textPrimary: '#f8f8f2',
      textSecondary: '#6272a4'
    }
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night Storm',
    category: 'dev',
    author: 'enkia',
    description: 'Atmospheric neon aesthetics inspired by nighttime in downtown Shinjuku.',
    swatches: ['#1a1b26', '#24283b', '#7aa2f7', '#bb9af7', '#7dcfff'],
    colors: {
      bgApp: '#16161e',
      bgCard: '#1a1b26',
      bgCardHover: '#24283b',
      border: '#2f3549',
      borderFocus: '#414868',
      accent: '#7aa2f7',
      accentLight: '#7dcfff',
      accentDark: '#3d59a1',
      accentSubtle: '#1f2335',
      textPrimary: '#c0caf5',
      textSecondary: '#565f89'
    }
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    category: 'dev',
    author: 'Catppuccin',
    description: 'Soothing dark pastel palette with warm, gentle lavender & sky hues.',
    swatches: ['#181825', '#1e1e2e', '#cba6f7', '#89dceb', '#a6e3a1'],
    colors: {
      bgApp: '#11111b',
      bgCard: '#181825',
      bgCardHover: '#1e1e2e',
      border: '#313244',
      borderFocus: '#45475a',
      accent: '#cba6f7',
      accentLight: '#f5c2e7',
      accentDark: '#b4befe',
      accentSubtle: '#27203d',
      textPrimary: '#cdd6f4',
      textSecondary: '#6c7086'
    }
  },
  {
    id: 'nordic-frost',
    name: 'Nordic Frost',
    category: 'clean',
    author: 'Arctic Ice Studio',
    description: 'Arctic, north-bluish clean palette engineered for zero eye-strain during overnight shifts.',
    swatches: ['#2e3440', '#3b4252', '#88c0d0', '#81a1c1', '#a3be8c'],
    colors: {
      bgApp: '#242933',
      bgCard: '#2e3440',
      bgCardHover: '#3b4252',
      border: '#434c5e',
      borderFocus: '#4c566a',
      accent: '#88c0d0',
      accentLight: '#8fbcbb',
      accentDark: '#5e81ac',
      accentSubtle: '#2a3b48',
      textPrimary: '#eceff4',
      textSecondary: '#7b88a1'
    }
  },
  {
    id: 'monokai-pro',
    name: 'Monokai Pro',
    category: 'dev',
    author: 'Wimer Hazenberg',
    description: 'Refined high-focus dark theme with expressive amber, rose, and green accents.',
    swatches: ['#221f22', '#2d2a2e', '#ffd866', '#ff6188', '#a9dc76'],
    colors: {
      bgApp: '#19181a',
      bgCard: '#221f22',
      bgCardHover: '#2d2a2e',
      border: '#403e41',
      borderFocus: '#5b595c',
      accent: '#ffd866',
      accentLight: '#78dce8',
      accentDark: '#fc9867',
      accentSubtle: '#3d3725',
      textPrimary: '#fcfcfa',
      textSecondary: '#727072'
    }
  },
  {
    id: 'crimson-alert',
    name: 'Crimson Defense HUD',
    category: 'tactical',
    author: 'SOC Red Team',
    description: 'Emergency response tactical dark theme bathed in high-alert red and amber warnings.',
    swatches: ['#17070a', '#220b10', '#ef4444', '#f87171', '#fbbf24'],
    colors: {
      bgApp: '#0d0406',
      bgCard: '#17070a',
      bgCardHover: '#2a0d13',
      border: '#45131c',
      borderFocus: '#691a27',
      accent: '#ef4444',
      accentLight: '#f87171',
      accentDark: '#b91c1c',
      accentSubtle: '#3b0b12',
      textPrimary: '#fef2f2',
      textSecondary: '#994a56'
    }
  },
  {
    id: 'matrix-terminal',
    name: 'Matrix Phosphor Terminal',
    category: 'tactical',
    author: 'Cypher Engine',
    description: 'Vintage 1990s monochrome phosphor CRT terminal glowing on jet-black glass.',
    swatches: ['#000000', '#051508', '#22c55e', '#4ade80', '#86efac'],
    colors: {
      bgApp: '#010502',
      bgCard: '#051508',
      bgCardHover: '#0a230f',
      border: '#123919',
      borderFocus: '#1b5626',
      accent: '#22c55e',
      accentLight: '#4ade80',
      accentDark: '#16a34a',
      accentSubtle: '#092b10',
      textPrimary: '#dcfce7',
      textSecondary: '#4d8a57'
    }
  },
  {
    id: 'synthwave-84',
    name: "Synthwave '84",
    category: 'cyber',
    author: 'Robb Owen',
    description: 'Radical retro-futuristic purple twilight with hot pink lasers and electric neon grids.',
    swatches: ['#1a102f', '#261545', '#f72585', '#4cc9f0', '#fee440'],
    colors: {
      bgApp: '#140c26',
      bgCard: '#20113b',
      bgCardHover: '#2e1854',
      border: '#452077',
      borderFocus: '#652cae',
      accent: '#f72585',
      accentLight: '#4cc9f0',
      accentDark: '#7209b7',
      accentSubtle: '#380c44',
      textPrimary: '#fff1f8',
      textSecondary: '#8d6ca7'
    }
  },
  {
    id: 'github-dark-dimmed',
    name: 'GitHub Dark Dimmed',
    category: 'clean',
    author: 'GitHub',
    description: 'Balanced enterprise dark dimmed aesthetic modeled after GitHub Enterprise Cloud.',
    swatches: ['#1c2128', '#22272e', '#539bf5', '#57ab5a', '#f47067'],
    colors: {
      bgApp: '#181c22',
      bgCard: '#22272e',
      bgCardHover: '#2d333b',
      border: '#373e47',
      borderFocus: '#444c56',
      accent: '#539bf5',
      accentLight: '#6cb6ff',
      accentDark: '#316dca',
      accentSubtle: '#1d2c42',
      textPrimary: '#adbac7',
      textSecondary: '#636e7b'
    }
  }
];

export const DEFAULT_THEME_ID = 'cyber-cyan';

export function getThemeById(id: string): AppTheme {
  return THEMES.find(t => t.id === id) || THEMES[0];
}

