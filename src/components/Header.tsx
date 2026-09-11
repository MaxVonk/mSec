import React, { useState } from 'react';
import { Shield, Upload, RefreshCw, Database, Radio, LogOut, Users, FileText } from 'lucide-react';
import { UserSessionProfile } from '../types';

interface HeaderProps {
  onOpenImport: () => void;
  onResetDemo: () => void;
  onRefresh: () => void;
  onOpenShiftHandover?: () => void;
  onOpenUserManagement?: () => void;
  currentUser: UserSessionProfile | null;
  onLogout: () => void;
  isRefreshing: boolean;
  totalIncidents: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenImport,
  onResetDemo,
  onRefresh,
  onOpenShiftHandover,
  onOpenUserManagement,
  currentUser,
  onLogout,
  isRefreshing,
  totalIncidents
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    setShowUserMenu(false);
    onLogout();
  };

  return (
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20 text-white">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-white">mSec</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-medium">
                XDR & SIEM Hub
              </span>
            </div>
            <p className="text-xs text-slate-400">
              M365 Security • Microsoft Sentinel • PhishPilot AI
            </p>
          </div>
        </div>

        {/* Status Indicators & SSO */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-slate-300">Ingestion Active</span>
            <span className="text-slate-500">•</span>
            <span className="font-semibold text-slate-200">{totalIncidents} Records</span>
          </div>

          <button
            onClick={onResetDemo}
            title="Reset to pre-packaged M365 & Sentinel datasets"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Reset Demo</span>
          </button>

          {onOpenShiftHandover && (
            <button
              onClick={onOpenShiftHandover}
              title="Open Executive Shift Handover Briefing"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-purple-300 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/80 rounded-lg transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Shift Handover</span>
            </button>
          )}

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh feeds"
            className="p-2 text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <button
            onClick={onOpenImport}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg shadow-lg shadow-cyan-600/25 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import Data</span>
          </button>

          {/* User Profile Menu */}
          {currentUser?.isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 transition-colors cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center text-[11px] font-bold text-white shadow-sm">
                  {currentUser.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="text-left hidden md:block">
                  <div className="font-bold text-slate-100 truncate max-w-[120px]">{currentUser.displayName}</div>
                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                      currentUser.role === 'ADMIN'
                        ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                        : currentUser.role === 'ANALYST'
                        ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {currentUser.role}
                    </span>
                  </div>
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 text-xs space-y-2 animate-in fade-in zoom-in-95">
                  <div className="border-b border-slate-800 pb-2">
                    <p className="font-bold text-slate-100">{currentUser.displayName}</p>
                    <p className="text-slate-400 text-[11px] truncate">@{currentUser.username || currentUser.email}</p>
                    <div className="mt-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                        currentUser.role === 'ADMIN'
                          ? 'bg-purple-950 text-purple-300 border-purple-800'
                          : currentUser.role === 'ANALYST'
                          ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        Role: {currentUser.role}
                      </span>
                    </div>
                  </div>

                  {currentUser.role === 'ADMIN' && onOpenUserManagement && (
                    <button
                      onClick={() => { setShowUserMenu(false); onOpenUserManagement(); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-purple-300 hover:bg-purple-950/40 rounded-lg transition-colors cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-purple-400" />
                      <span>User Management</span>
                    </button>
                  )}

                  <button
                    onClick={() => { setShowUserMenu(false); onLogout(); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onLogout}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
