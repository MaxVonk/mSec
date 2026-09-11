import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, ShieldAlert, Crosshair, Monitor, FileText, Users, Volume2, VolumeX, Play, ArrowRight, CornerDownLeft } from 'lucide-react';
import { UnifiedIncident, UserSessionProfile } from '../../types';
import { audioService } from '../../utils/audioService';

interface CommandItem {
  id: string;
  category: 'NAVIGATION' | 'INCIDENT' | 'ACTION';
  title: string;
  subtitle?: string;
  badge?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: UnifiedIncident[];
  currentUser?: UserSessionProfile;
  onSelectIncident: (inc: UnifiedIncident) => void;
  onOpenMitre: () => void;
  onOpenWarRoom: () => void;
  onOpenShiftHandover: () => void;
  onOpenUserManagement: () => void;
  onOpenPlaybooks: (incident?: UnifiedIncident) => void;
  onOpenConnectors: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  incidents,
  currentUser,
  onSelectIncident,
  onOpenMitre,
  onOpenWarRoom,
  onOpenShiftHandover,
  onOpenUserManagement,
  onOpenPlaybooks,
  onOpenConnectors
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      audioService.playCommandOpen();
    }
  }, [isOpen]);

  const items = useMemo(() => {
    const list: CommandItem[] = [];

    // 1. Navigation Commands
    list.push(
      {
        id: 'nav-warroom',
        category: 'NAVIGATION',
        title: 'Open SOC War Room HUD',
        subtitle: 'Fullscreen tactical wallboard with alert velocity and live ticker',
        badge: 'HUD',
        icon: <Monitor className="w-4 h-4 text-emerald-400" />,
        action: onOpenWarRoom
      },
      {
        id: 'nav-mitre',
        category: 'NAVIGATION',
        title: 'Open MITRE ATT&CK Matrix',
        subtitle: 'Enterprise 14-tactic matrix with heatmaps & incident correlation',
        badge: 'MITRE',
        icon: <Crosshair className="w-4 h-4 text-purple-400" />,
        action: onOpenMitre
      },
      {
        id: 'nav-handover',
        category: 'NAVIGATION',
        title: 'Generate Shift Handover Briefing',
        subtitle: 'SOC shift executive report, KPI telemetry, and PDF/Markdown export',
        badge: 'Report',
        icon: <FileText className="w-4 h-4 text-amber-400" />,
        action: onOpenShiftHandover
      },
      {
        id: 'nav-playbooks',
        category: 'ACTION',
        title: 'Launch SOAR Containment Playbook',
        subtitle: 'Interactive stepped runbooks: Host isolation, Identity lockout, Phishing purge',
        badge: 'SOAR',
        icon: <Play className="w-4 h-4 text-cyan-400 fill-current" />,
        action: () => onOpenPlaybooks()
      },
      {
        id: 'action-mute',
        category: 'ACTION',
        title: audioService.isMuted() ? 'Unmute Tactical Cyber Audio' : 'Mute Tactical Cyber Audio',
        subtitle: 'Toggle synthesized Web Audio alert chimes and warning sirens',
        badge: audioService.isMuted() ? 'MUTED' : 'ACTIVE',
        icon: audioService.isMuted() ? (
          <VolumeX className="w-4 h-4 text-rose-400" />
        ) : (
          <Volume2 className="w-4 h-4 text-emerald-400" />
        ),
        action: () => {
          audioService.toggleMute();
        }
      }
    );

    if (currentUser?.role === 'ADMIN') {
      list.push(
        {
          id: 'nav-users',
          category: 'NAVIGATION',
          title: 'User Management Administration',
          subtitle: 'Create accounts, assign roles, reset passwords, and toggle access',
          badge: 'Admin',
          icon: <Users className="w-4 h-4 text-indigo-400" />,
          action: onOpenUserManagement
        },
        {
          id: 'nav-connectors',
          category: 'NAVIGATION',
          title: 'Configure Ingestion & Webhooks',
          subtitle: 'Sentinel / Defender automated poller intervals & Teams / Slack notifications',
          badge: 'Admin',
          icon: <ShieldAlert className="w-4 h-4 text-cyan-400" />,
          action: onOpenConnectors
        }
      );
    }

    // 2. Incident Search
    incidents.forEach(inc => {
      const user = inc.entities?.find(e => e.type === 'USER')?.value || '';
      const ip = inc.entities?.find(e => e.type === 'IP')?.value || '';
      list.push({
        id: `inc-${inc.id}`,
        category: 'INCIDENT',
        title: `${inc.id}: ${inc.title}`,
        subtitle: `${inc.severity} Severity • Source: ${inc.provider} ${user ? `• Target: ${user}` : ''} ${ip ? `• IP: ${ip}` : ''}`,
        badge: inc.severity,
        icon: <ShieldAlert className={`w-4 h-4 ${inc.severity === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'}`} />,
        action: () => onSelectIncident(inc)
      });
    });

    if (!query.trim()) return list;

    const lower = query.toLowerCase();
    return list.filter(
      item =>
        item.title.toLowerCase().includes(lower) ||
        item.subtitle?.toLowerCase().includes(lower) ||
        item.badge?.toLowerCase().includes(lower)
    );
  }, [query, incidents, currentUser, onOpenMitre, onOpenWarRoom, onOpenShiftHandover, onOpenUserManagement, onOpenPlaybooks, onOpenConnectors, onSelectIncident]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, items.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = items[selectedIndex];
      if (current) {
        audioService.playInfoChime();
        current.action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900/95 border border-cyan-500/30 rounded-2xl shadow-[0_0_60px_rgba(6,182,212,0.2)] overflow-hidden flex flex-col text-slate-100"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Bar Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 bg-slate-950/70">
          <Search className="w-5 h-5 text-cyan-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command, incident ID, user, IP, or tactic... (Ctrl + K)"
            className="w-full bg-transparent border-none outline-none text-sm text-white placeholder-slate-500 focus:ring-0"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800/80 rounded border border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {items.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching commands or incidents found for "{query}".
            </div>
          ) : (
            items.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    audioService.playInfoChime();
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-cyan-950/50 border border-cyan-500/40 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      : 'border border-transparent hover:bg-slate-800/50 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate flex items-center gap-2">
                        <span>{item.title}</span>
                        {item.badge && (
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                              item.badge === 'CRITICAL'
                                ? 'bg-red-500/20 text-red-300'
                                : item.badge === 'HIGH'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <div className="text-xs text-slate-400 truncate mt-0.5">{item.subtitle}</div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center text-slate-500 text-xs">
                    {isSelected ? (
                      <span className="flex items-center gap-1 text-cyan-400 font-mono text-[11px]">
                        Execute <CornerDownLeft className="w-3 h-3" />
                      </span>
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 opacity-40" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Keyboard Hints */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">↓</kbd> to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">↵</kbd> to select
            </span>
          </div>
          <span className="font-mono text-cyan-400">mSec Command Palette</span>
        </div>
      </div>
    </div>
  );
};
