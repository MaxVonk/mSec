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
  category: 'cyber' | 'dev' | 'tactical' | 'clean' | 'light';
  type: 'dark' | 'light';
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
    type: 'dark',
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
    type: 'dark',
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
    type: 'dark',
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
    type: 'dark',
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
    type: 'dark',
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
    type: 'dark',
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
    type: 'dark',
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
    type: 'dark',
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
    type: 'dark',
    author: 'Robb Owen',
    description: 'Radical retro-futuristic purple twilight with hot pink lasers and electric neon grids.',
    swatches: ['#140c26', '#20113b', '#f72585', '#4cc9f0', '#fee440'],
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
    type: 'dark',
    author: 'GitHub',
    description: 'Balanced enterprise dark dimmed aesthetic modeled after GitHub Enterprise Cloud.',
    swatches: ['#181c22', '#22272e', '#539bf5', '#57ab5a', '#f47067'],
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
  },
  /* =========================================================================
     LIGHT THEMES
     ========================================================================= */
  {
    id: 'github-light',
    name: 'GitHub Light',
    category: 'light',
    type: 'light',
    author: 'GitHub',
    description: 'Crisp, modern daylight theme with clean neutral canvas, slate typography, and GitHub blue accents.',
    swatches: ['#f6f8fa', '#ffffff', '#0969da', '#218bff', '#1a7f37'],
    colors: {
      bgApp: '#f6f8fa',
      bgCard: '#ffffff',
      bgCardHover: '#f3f4f6',
      border: '#d0d7de',
      borderFocus: '#0969da',
      accent: '#0969da',
      accentLight: '#218bff',
      accentDark: '#0550ae',
      accentSubtle: '#ddf4ff',
      textPrimary: '#1f2328',
      textSecondary: '#57606a'
    }
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    category: 'light',
    type: 'light',
    author: 'Catppuccin',
    description: 'Warm, soothing pastel light palette with delicate lavender and sapphire accents.',
    swatches: ['#eff1f5', '#ffffff', '#8839ef', '#1e66f5', '#40a02b'],
    colors: {
      bgApp: '#eff1f5',
      bgCard: '#ffffff',
      bgCardHover: '#e6e9ef',
      border: '#ccd0da',
      borderFocus: '#8839ef',
      accent: '#8839ef',
      accentLight: '#7287fd',
      accentDark: '#7025d9',
      accentSubtle: '#eed8f7',
      textPrimary: '#4c4f69',
      textSecondary: '#6c6f85'
    }
  },
  {
    id: 'nord-light',
    name: 'Nord Snow Storm',
    category: 'light',
    type: 'light',
    author: 'Arctic Ice Studio',
    description: 'Frosted arctic snow storm ambiance with calm icy blues and slate typography.',
    swatches: ['#eceff4', '#ffffff', '#5e81ac', '#88c0d0', '#a3be8c'],
    colors: {
      bgApp: '#eceff4',
      bgCard: '#ffffff',
      bgCardHover: '#e5e9f0',
      border: '#d8dee9',
      borderFocus: '#5e81ac',
      accent: '#5e81ac',
      accentLight: '#81a1c1',
      accentDark: '#4c698f',
      accentSubtle: '#dce5ef',
      textPrimary: '#2e3440',
      textSecondary: '#4c566a'
    }
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    category: 'light',
    type: 'light',
    author: 'Ethan Schoonover',
    description: 'Scientifically calibrated cream daylight palette with balanced solar amber and cyan contrast.',
    swatches: ['#fdf6e3', '#fbf7ed', '#268bd2', '#b58900', '#2aa198'],
    colors: {
      bgApp: '#fdf6e3',
      bgCard: '#fbf7ed',
      bgCardHover: '#eee8d5',
      border: '#ded7c2',
      borderFocus: '#268bd2',
      accent: '#268bd2',
      accentLight: '#2aa198',
      accentDark: '#17669d',
      accentSubtle: '#daedf8',
      textPrimary: '#073642',
      textSecondary: '#586e75'
    }
  },
  {
    id: 'quiet-light',
    name: 'Quiet Light',
    category: 'light',
    type: 'light',
    author: 'Studio Classic',
    description: 'Soft lavender-tinted light theme with muted purples and gentle contrast for reduced eye strain.',
    swatches: ['#f5f3f7', '#ffffff', '#7a3e9d', '#4b83cd', '#388a34'],
    colors: {
      bgApp: '#f5f3f7',
      bgCard: '#ffffff',
      bgCardHover: '#ede8f2',
      border: '#ded7e6',
      borderFocus: '#7a3e9d',
      accent: '#7a3e9d',
      accentLight: '#9c51c7',
      accentDark: '#5f2e7c',
      accentSubtle: '#f2e4fa',
      textPrimary: '#282330',
      textSecondary: '#655d70'
    }
  }
];

export const DEFAULT_THEME_ID = 'cyber-cyan';

export function getThemeById(id: string): AppTheme {
  return THEMES.find(t => t.id === id) || THEMES[0];
}
