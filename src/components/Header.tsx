import React, { useState, useEffect } from 'react';
import { Shield, Upload, RefreshCw, Database, Radio, LogIn, LogOut, UserCheck, FileText } from 'lucide-react';
import { UserSessionProfile } from '../phishpilotTypes';

interface HeaderProps {
  onOpenImport: () => void;
  onResetDemo: () => void;
  onRefresh: () => void;
  onOpenShiftHandover?: () => void;
  isRefreshing: boolean;
  totalIncidents: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenImport,
  onResetDemo,
  onRefresh,
  onOpenShiftHandover,
  isRefreshing,
  totalIncidents
}) => {
  const [currentUser, setCurrentUser] = useState<UserSessionProfile | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data: UserSessionProfile = await res.json();
        setCurrentUser(data);
      }
    } catch {
      // Ignore session fetch errors
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      setShowUserMenu(false);
      window.location.reload();
    } catch (e) {
      console.error('Logout error:', e);
    }
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

          {/* Microsoft SSO Button / User Profile Menu */}
          {currentUser?.isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-cyan-800/60 rounded-lg text-xs font-medium text-slate-200 transition-colors cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center text-[11px] font-bold text-white shadow-sm">
                  {currentUser.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="text-left hidden md:block">
                  <div className="font-bold text-slate-100 truncate max-w-[120px]">{currentUser.displayName}</div>
                  <div className="text-[10px] text-cyan-400 truncate max-w-[120px]">Entra Verified</div>
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 text-xs space-y-2 animate-in fade-in zoom-in-95">
                  <div className="border-b border-slate-800 pb-2">
                    <p className="font-bold text-slate-100">{currentUser.displayName}</p>
                    <p className="text-slate-400 text-[11px] truncate">{currentUser.email}</p>
                    <p className="text-cyan-400 text-[10px] mt-0.5">{currentUser.jobTitle || 'Security Analyst'}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a
              href="/api/auth/login"
              title="Sign in with your Microsoft 365 / Entra ID corporate account"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-100 bg-[#0078d4] hover:bg-[#106ebe] rounded-lg shadow-md transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
              </svg>
              <span>Sign in with Microsoft</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
};
