import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Palette, 
  Search, 
  Check, 
  X, 
  Sparkles, 
  Eye, 
  Terminal, 
  Moon, 
  Sun,
  ShieldAlert, 
  Layers, 
  CornerDownLeft 
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { AppTheme } from '../../themes/themeDefinitions';

export const ThemeSelectorModal: React.FC = () => {
  const {
    currentThemeId,
    previewThemeId,
    setTheme,
    setPreviewTheme,
    isThemeSelectorOpen,
    setIsThemeSelectorOpen,
    allThemes
  } = useTheme();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'cyber' | 'dev' | 'tactical' | 'clean' | 'light'>('all');
  const [focusedIndex, setFocusedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter themes based on search query and category
  const filteredThemes = useMemo(() => {
    return allThemes.filter(t => {
      const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
      const q = query.toLowerCase().trim();
      const matchesQuery = 
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.author.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [allThemes, query, selectedCategory]);

  // Reset focus and preview state when modal opens
  useEffect(() => {
    if (isThemeSelectorOpen) {
      setQuery('');
      const currentIndex = allThemes.findIndex(t => t.id === currentThemeId);
      setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // Revert preview on close if not committed
      setPreviewTheme(null);
    }
  }, [isThemeSelectorOpen, currentThemeId, allThemes, setPreviewTheme]);

  // Live preview when focused item changes via keyboard navigation
  useEffect(() => {
    if (isThemeSelectorOpen && filteredThemes.length > 0) {
      const safeIndex = Math.min(focusedIndex, filteredThemes.length - 1);
      const targetTheme = filteredThemes[safeIndex];
      if (targetTheme) {
        setPreviewTheme(targetTheme.id);
      }
    }
  }, [focusedIndex, filteredThemes, isThemeSelectorOpen, setPreviewTheme]);

  // Handle keyboard navigation (Arrow Up, Down, Enter, Esc)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev < filteredThemes.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : filteredThemes.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredThemes[focusedIndex]) {
        handleApply(filteredThemes[focusedIndex].id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleApply = (themeId: string) => {
    setTheme(themeId);
    setIsThemeSelectorOpen(false);
  };

  const handleCancel = () => {
    setPreviewTheme(null);
    setIsThemeSelectorOpen(false);
  };

  if (!isThemeSelectorOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150 cursor-pointer"
      onClick={handleCancel}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 relative cursor-default animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header / Search Input */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Palette className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-white tracking-tight">Select Color Theme</h2>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono">
                VS Code Palette Engine
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 rounded border border-slate-700">
                Alt + T
              </kbd>
              <button
                type="button"
                onClick={handleCancel}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Cancel & Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setFocusedIndex(0);
              }}
              placeholder="Search theme name, author, or palette... (↑/↓ to live preview)"
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-sans transition-all"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 mt-3 overflow-x-auto no-scrollbar text-xs">
            {[
              { id: 'all', label: 'All Presets' },
              { id: 'light', label: '☀️ Light Themes' },
              { id: 'dev', label: 'Developer Hits' },
              { id: 'cyber', label: 'Cyber & Neon' },
              { id: 'tactical', label: 'Tactical Red/Green' },
              { id: 'clean', label: 'Clean Dimmed' }
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id as any);
                  setFocusedIndex(0);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Theme List */}
        <div ref={listRef} className="max-h-96 overflow-y-auto p-2 space-y-1.5">
          {filteredThemes.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching themes found for "{query}".
            </div>
          ) : (
            filteredThemes.map((t, idx) => {
              const isFocused = idx === focusedIndex;
              const isCommittedActive = t.id === currentThemeId;

              return (
                <div
                  key={t.id}
                  onMouseEnter={() => {
                    setFocusedIndex(idx);
                    setPreviewTheme(t.id);
                  }}
                  onClick={() => handleApply(t.id)}
                  className={`w-full p-3 rounded-xl border transition-all text-left flex items-center justify-between gap-3 cursor-pointer ${
                    isFocused
                      ? 'bg-slate-800 border-cyan-500/60 shadow-md ring-1 ring-cyan-500/40'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/40 hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white tracking-wide">
                        {t.name}
                      </span>
                      {t.type === 'light' ? (
                        <span className="px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-semibold flex items-center gap-0.5">
                          <Sun className="w-2.5 h-2.5" />
                          <span>Light</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold flex items-center gap-0.5">
                          <Moon className="w-2.5 h-2.5" />
                          <span>Dark</span>
                        </span>
                      )}
                      {isCommittedActive && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/80 text-[10px] font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-500">
                        by {t.author}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                      {t.description}
                    </p>
                  </div>

                  {/* Swatch color preview dots */}
                  <div className="flex items-center gap-1 shrink-0 p-1 bg-slate-950/80 rounded-lg border border-slate-800">
                    {t.swatches.map((color, cIdx) => (
                      <span
                        key={cIdx}
                        className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-sm"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-4 py-2.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] border border-slate-700 font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] border border-slate-700 font-mono">↓</kbd>
              <span>live preview</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] border border-slate-700 font-mono">↵</kbd>
              <span>apply</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] border border-slate-700 font-mono">esc</kbd>
              <span>cancel</span>
            </span>
          </div>

          <button
            type="button"
            onClick={handleCancel}
            className="text-slate-400 hover:text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

