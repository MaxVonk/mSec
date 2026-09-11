import React, { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  Cpu,
  Mail,
  TrendingUp,
  Globe,
  ShieldAlert,
  BarChart2,
  Radar,
  Building2,
  Crosshair,
  SearchCode,
  Sliders,
  Users,
  Settings2,
  UserCheck,
  Settings,
  Lock,
  ChevronRight,
  ChevronLeft,
  Shield,
  LogOut,
  Sparkles,
  Play
} from 'lucide-react';
import { UserSessionProfile } from '../../types';
import { audioService } from '../../utils/audioService';

export type MainNavView = 'dashboard' | 'incidents' | 'analytics' | 'phishpilot' | 'entities';

interface SidebarProps {
  activeView: MainNavView;
  onSelectView: (view: MainNavView) => void;
  incidentCount: number;
  currentUser: UserSessionProfile | null;
  onOpenWarRoom: () => void;
  onOpenMitre: () => void;
  onOpenCopilot: () => void;
  onOpenShiftHandover: () => void;
  onOpenPlaybooks: () => void;
  onOpenUserManagement: () => void;
  onOpenConnectors: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  incidentCount,
  currentUser,
  onOpenWarRoom,
  onOpenMitre,
  onOpenCopilot,
  onOpenShiftHandover,
  onOpenPlaybooks,
  onOpenUserManagement,
  onOpenConnectors,
  onLogout
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);

  const handleLockedClick = (featureName: string) => {
    audioService.playInfoChime();
    setLockedNotice(`"${featureName}" is an enterprise module. Connect Microsoft Sentinel / Defender XDR to unlock full telemetry.`);
    setTimeout(() => setLockedNotice(null), 3500);
  };

  const handleNav = (view: MainNavView) => {
    audioService.playInfoChime();
    onSelectView(view);
  };

  return (
    <aside
      className={`bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0 z-40 transition-all duration-200 select-none ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
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
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Locked Feature Toast Notice */}
      {lockedNotice && !isCollapsed && (
        <div className="mx-3 my-2 p-2.5 bg-cyan-950/80 border border-cyan-800/80 rounded-xl text-xs text-cyan-300 animate-fadeIn">
          {lockedNotice}
        </div>
      )}

      {/* Navigation Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 text-xs font-medium text-slate-400 scrollbar-thin">
        {/* Top Ungrouped Items */}
        <div className="space-y-1">
          <button
            onClick={() => handleNav('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
              activeView === 'dashboard'
                ? 'bg-slate-800/90 text-white font-semibold shadow-sm border border-slate-700/80'
                : 'hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeView === 'dashboard' ? 'text-cyan-400' : 'text-slate-400'}`} />
            {!isCollapsed && <span>Dashboard</span>}
          </button>

          <button
            onClick={onOpenShiftHandover}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800/50 hover:text-slate-200 transition-all text-left"
          >
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            {!isCollapsed && <span>Documents</span>}
          </button>

          <button
            onClick={() => handleLockedClick('Security Resilience')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-800/50 hover:text-slate-200 transition-all text-left opacity-80"
          >
            <div className="flex items-center gap-3 min-w-0">
              <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
              {!isCollapsed && <span className="truncate">Security Resilience</span>}
            </div>
            {!isCollapsed && <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
          </button>

          <button
            onClick={() => handleNav('entities')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
              activeView === 'entities'
                ? 'bg-slate-800/90 text-white font-semibold shadow-sm border border-slate-700/80'
                : 'hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <Cpu className={`w-4 h-4 shrink-0 ${activeView === 'entities' ? 'text-cyan-400' : 'text-slate-400'}`} />
            {!isCollapsed && <span>Assets & Entities</span>}
          </button>
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
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
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
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                activeView === 'analytics'
                  ? 'bg-slate-800/90 text-white font-semibold shadow-sm border border-slate-700/80'
                : 'hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <TrendingUp className={`w-4 h-4 shrink-0 ${activeView === 'analytics' ? 'text-cyan-400' : 'text-slate-400'}`} />
              {!isCollapsed && <span>Threat Insights</span>}
            </button>

            <button
              onClick={onOpenMitre}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800/50 hover:text-slate-200 transition-all text-left"
            >
              <Globe className="w-4 h-4 text-purple-400 shrink-0" />
              {!isCollapsed && <span>Ransomware Insights (MITRE)</span>}
            </button>
          </div>
        </div>

        {/* Group: Detection & Response */}
        <div>
          {!isCollapsed && (
            <div className="px-3 pb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Detection & Response
            </div>
          )}
          <div className="space-y-1">
            <button
              onClick={() => handleNav('incidents')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                activeView === 'incidents'
                  ? 'bg-slate-800/90 text-white font-semibold shadow-sm border border-slate-700/80'
                  : 'hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                {!isCollapsed && <span className="font-semibold text-white">Incidents</span>}
              </div>
              {!isCollapsed && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold font-mono rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {incidentCount}
                </span>
              )}
            </button>

            <button
              onClick={onOpenShiftHandover}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800/50 hover:text-slate-200 transition-all text-left"
            >
              <BarChart2 className="w-4 h-4 text-slate-400 shrink-0" />
              {!isCollapsed && <span>Operational Reports</span>}
            </button>
          </div>
        </div>

        {/* Group: Threat Exposure */}
        <div>
          {!isCollapsed && (
            <div className="px-3 pb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Threat Exposure
            </div>
          )}
          <div className="space-y-1">
            <button
              onClick={onOpenWarRoom}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800/50 hover:text-emerald-300 transition-all text-left"
            >
              <Radar className="w-4 h-4 text-emerald-400 shrink-0" />
              {!isCollapsed && <span>Cyber Exposure Profiles</span>}
            </button>

            <button
              onClick={() => handleLockedClick('Dark Web Exposure')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-800/50 hover:text-slate-200 transition-all text-left opacity-80"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                {!isCollapsed && <span className="truncate">Dark Web</span>}
              </div>
              {!isCollapsed && <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
            </button>

            <button
              onClick={() => handleLockedClick('Supply Chain Monitoring')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-800/50 hover:text-slate-200 transition-all text-left opacity-80"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                {!isCollapsed && <span className="truncate">Supply Chain</span>}
              </div>
              {!isCollapsed && <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
            </button>

            <button
              onClick={() => handleLockedClick('Vulnerabilities & CVE Management')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-800/50 hover:text-slate-200 transition-all text-left opacity-80"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Crosshair className="w-4 h-4 text-slate-400 shrink-0" />
                {!isCollapsed && <span className="truncate">Vulnerabilities</span>}
              </div>
              {!isCollapsed && <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
            </button>
          </div>
        </div>

        {/* Group: Service Requests */}
        <div>
          {!isCollapsed && (
            <div className="px-3 pb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Service Requests
            </div>
          )}
          <div className="space-y-1">
            <button
              onClick={onOpenCopilot}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800/50 hover:text-cyan-300 transition-all text-left"
            >
              <SearchCode className="w-4 h-4 text-cyan-400 shrink-0" />
              {!isCollapsed && <span>Extended Threat Hunting</span>}
            </button>

            <button
              onClick={() => handleLockedClick('Security Posture Assessment')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800/50 hover:text-slate-200 transition-all text-left"
            >
              <Sliders className="w-4 h-4 text-slate-400 shrink-0" />
              {!isCollapsed && <span>Security Posture Assessment</span>}
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
              onClick={onOpenConnectors}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800/50 hover:text-slate-200 transition-all text-left"
            >
              <Users className="w-4 h-4 text-slate-400 shrink-0" />
              {!isCollapsed && <span>Contacts & Webhooks</span>}
            </button>

            <button
              onClick={onOpenPlaybooks}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-800/50 hover:text-slate-200 transition-all text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Settings2 className="w-4 h-4 text-cyan-400 shrink-0" />
                {!isCollapsed && <span>Automations</span>}
              </div>
              {!isCollapsed && <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
            </button>

            {currentUser?.role === 'ADMIN' && (
              <button
                onClick={onOpenUserManagement}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800/50 hover:text-indigo-300 transition-all text-left"
              >
                <UserCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                {!isCollapsed && <span>Tenant Members</span>}
              </button>
            )}

            <button
              onClick={onOpenConnectors}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800/50 hover:text-slate-200 transition-all text-left"
            >
              <Settings className="w-4 h-4 text-slate-400 shrink-0" />
              {!isCollapsed && <span>Settings</span>}
            </button>
          </div>
        </div>
      </div>

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
              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800/80 transition-colors"
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
