import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  Cpu,
  Mail,
  TrendingUp,
  Globe,
  Settings2,
  FileText,
  Settings,
  Users,
  Search,
  RefreshCw,
  Database,
  Monitor,
  ChevronRight,
  ChevronLeft,
  Shield,
  LogOut,
  Activity
} from 'lucide-react';
import { UserSessionProfile } from '../../types';

export type MainNavView =
  | 'dashboard'
  | 'incidents'
  | 'entities'
  | 'phishpilot'
  | 'analytics'
  | 'mitre'
  | 'playbooks'
  | 'reports'
  | 'settings'
  | 'users';

interface SidebarProps {
  activeView: MainNavView;
  onSelectView: (view: MainNavView) => void;
  incidentCount: number;
  currentUser: UserSessionProfile | null;
  onOpenWarRoom: () => void;
  onOpenCommandPalette: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onResetDemo: () => void;
  onLogout: () => void;
  demoMode?: boolean;
  onOpenSyncLog?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  incidentCount,
  currentUser,
  onOpenWarRoom,
  onOpenCommandPalette,
  onRefresh,
  isRefreshing,
  onResetDemo,
  onLogout,
  demoMode,
  onOpenSyncLog
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleNav = (view: MainNavView) => {
    onSelectView(view);
  };

  return (
    <aside
      className={`bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0 z-40 transition-all duration-200 select-none ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="px-4 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20 text-white shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 truncate">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight text-white font-mono">mSec</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/80 font-bold">
                  SOC HUB
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Unified SecOps & PhishPilot</p>
            </div>
          )}
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Omnisearch & Quick Actions Bar */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-800/60 space-y-2">
        {/* Search / Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          title="Open Command Palette (Ctrl + K)"
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/70 text-xs text-slate-300 transition-all cursor-pointer shadow-sm hover:border-cyan-500/50 ${
            isCollapsed ? 'justify-center px-2' : ''
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            {!isCollapsed && <span className="text-slate-400 truncate">Search commands...</span>}
          </div>
          {!isCollapsed && (
            <kbd className="px-1.5 py-0.2 text-[10px] font-mono bg-slate-900 border border-slate-700 rounded text-slate-400">
              Ctrl K
            </kbd>
          )}
        </button>

        {/* Quick Tactical Controls */}
        <div className={`grid gap-1.5 ${isCollapsed ? 'grid-cols-2' : (demoMode !== false ? 'grid-cols-3' : 'grid-cols-2')}`}>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh Security Feeds"
            className="p-2 flex items-center justify-center rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-750 text-slate-300 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {demoMode !== false && (
            <button
              onClick={onResetDemo}
              title="Reset Demo Dataset (M365 & Sentinel)"
              className="p-2 flex items-center justify-center rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-750 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onOpenWarRoom}
            title="Launch Fullscreen SOC War Room HUD"
            className="p-2 flex items-center justify-center rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-800/70 text-emerald-400 transition-colors cursor-pointer"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Navigation Scrollable Body (Strictly real features!) */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 text-xs font-medium text-slate-400 scrollbar-thin">
        {/* Group: Core Operations */}
        <div>
          {!isCollapsed && (
            <div className="px-3 pb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Core Operations
            </div>
          )}
          <div className="space-y-1">
            <button
              onClick={() => handleNav('incidents')}
              title="Dashboard & Incidents"
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                activeView === 'incidents' || activeView === 'dashboard'
                  ? 'bg-slate-800/90 text-white font-semibold shadow-sm border border-slate-700/80'
                  : 'hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeView === 'incidents' || activeView === 'dashboard' ? 'text-cyan-400' : 'text-slate-400'}`} />
                {!isCollapsed && <span className="font-semibold text-white">Dashboard & Incidents</span>}
              </div>
              {!isCollapsed && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold font-mono rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {incidentCount}
                </span>
              )}
            </button>

            <button
              onClick={() => handleNav('entities')}
              title="Assets & Entities"
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all cursor-pointer ${
                activeView === 'entities'
                  ? 'bg-slate-800/90 text-white font-semibold shadow-sm border border-slate-700/80'
                  : 'hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Cpu className={`w-4 h-4 shrink-0 ${activeView === 'entities' ? 'text-cyan-400' : 'text-slate-400'}`} />
              {!isCollapsed && <span>Assets & Entities</span>}
            </button>
          </div>
        </div>

        {/* Group: Cyber Intelligence */}
        <div>
          {!isCollapsed && (
            <div className="px-3 pb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Cyber Intelligence
            </div>
          )}
          <div className="space-y-1">
            <button
              onClick={() => handleNav('phishpilot')}
              title="Threat Notices (PhishPilot)"
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all cursor-pointer ${
                activeView === 'phishpilot'
                  ? 'bg-slate-800/90 text-white font-semibold shadow-sm border border-slate-700/80'
                  : 'hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Mail className={`w-4 h-4 shrink-0 ${activeView === 'phishpilot' ? 'text-cyan-400' : 'text-slate-400'}`} />
              {!isCollapsed && <span>Threat Notices (PhishPilot)</span>}
            </button>

            <button
              onClick={() => handleNav('analytics')}
              title="Threat Insights"
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all cursor-pointer ${
                activeView === 'analytics'
                  ? 'bg-slate-800/90 text-white font-semibold shadow-sm border border-slate-700/80'
                  : 'hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <TrendingUp className={`w-4 h-4 shrink-0 ${activeView === 'analytics' ? 'text-cyan-400' : 'text-slate-400'}`} />
              {!isCollapsed && <span>Threat Insights</span>}
            </button>

            <button
              onClick={() => handleNav('mitre')}
              title="MITRE ATT&CK Matrix"
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all cursor-pointer ${
                activeView === 'mitre'
                  ? 'bg-purple-950/80 text-purple-200 font-semibold shadow-sm border border-purple-800/80'
                  : 'hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Globe className={`w-4 h-4 shrink-0 ${activeView === 'mitre' ? 'text-purple-400' : 'text-purple-400/80'}`} />
              {!isCollapsed && <span>MITRE ATT&CK Matrix</span>}
            </button>
          </div>
        </div>

        {/* Group: Automation & Response */}
        <div>
          {!isCollapsed && (
            <div className="px-3 pb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Automation & Response
            </div>
          )}
          <div className="space-y-1">
            <button
              onClick={() => handleNav('playbooks')}
              title="Automations & Playbooks"
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all cursor-pointer ${
                activeView === 'playbooks'
                  ? 'bg-slate-800/90 text-white font-semibold shadow-sm border border-slate-700/80'
                  : 'hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Settings2 className={`w-4 h-4 shrink-0 ${activeView === 'playbooks' ? 'text-cyan-400' : 'text-slate-400'}`} />
              {!isCollapsed && <span>Automations & Playbooks</span>}
            </button>

            <button
              onClick={() => handleNav('reports')}
              title="Operational Reports"
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all cursor-pointer ${
                activeView === 'reports'
                  ? 'bg-slate-800/90 text-white font-semibold shadow-sm border border-slate-700/80'
                  : 'hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <FileText className={`w-4 h-4 shrink-0 ${activeView === 'reports' ? 'text-cyan-400' : 'text-slate-400'}`} />
              {!isCollapsed && <span>Operational Reports</span>}
            </button>
          </div>
        </div>

        {/* Group: Administration */}
        <div>
          {!isCollapsed && (
            <div className="px-3 pb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Administration
            </div>
          )}
          <div className="space-y-1">
            <button
              onClick={() => handleNav('settings')}
              title="Settings & Connectors"
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all cursor-pointer ${
                activeView === 'settings'
                  ? 'bg-slate-800/90 text-white font-semibold shadow-sm border border-slate-700/80'
                  : 'hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Settings className={`w-4 h-4 shrink-0 ${activeView === 'settings' ? 'text-cyan-400' : 'text-slate-400'}`} />
              {!isCollapsed && <span>Settings & Connectors</span>}
            </button>

            {onOpenSyncLog && (
              <button
                onClick={onOpenSyncLog}
                title="Synchronization Engine & Connector Logs"
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all cursor-pointer hover:bg-slate-800/50 hover:text-slate-200 text-slate-400"
              >
                <Activity className="w-4 h-4 shrink-0 text-cyan-400" />
                {!isCollapsed && <span>Sync Logs</span>}
              </button>
            )}

            {currentUser?.role === 'ADMIN' && (
              <button
                onClick={() => handleNav('users')}
                title="Tenant Members"
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all cursor-pointer ${
                  activeView === 'users'
                    ? 'bg-purple-950/80 text-purple-200 font-semibold shadow-sm border border-purple-800/80'
                    : 'hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <Users className={`w-4 h-4 shrink-0 ${activeView === 'users' ? 'text-purple-400' : 'text-slate-400'}`} />
                {!isCollapsed && <span>Tenant Members</span>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Telemetry Status Bar */}
      {!isCollapsed && (
        <div className="px-3 py-2 border-t border-slate-800/60 bg-slate-950/40 flex items-center gap-2 text-[11px] text-slate-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="truncate">Live Telemetry Active</span>
        </div>
      )}

      {/* Bottom Profile Footer */}
      {currentUser?.isAuthenticated && (
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/70">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md">
                {currentUser.displayName.charAt(0).toUpperCase()}
              </div>
              {!isCollapsed && (
                <div className="min-w-0 truncate">
                  <div className="text-xs font-bold text-white truncate">{currentUser.displayName}</div>
                  <div className="text-[10px] font-mono text-cyan-400">{currentUser.role}</div>
                </div>
              )}
            </div>

            <button
              onClick={onLogout}
              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

