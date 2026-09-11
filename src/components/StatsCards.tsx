import React from 'react';
import { ShieldAlert, Users, Laptop, Activity, Cloud, Database, TrendingUp } from 'lucide-react';
import { IngestionStats } from '../types';

interface StatsCardsProps {
  stats: IngestionStats | null;
  onViewAnalytics?: () => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, onViewAnalytics }) => {
  if (!stats) return null;

  const criticalAndHigh = (stats.bySeverity.CRITICAL || 0) + (stats.bySeverity.HIGH || 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* Total Incidents */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Total Incidents</span>
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{stats.totalIncidents}</span>
            <span className="text-xs text-slate-500">Across all feeds</span>
          </div>
          {onViewAnalytics && (
            <button
              onClick={onViewAnalytics}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <TrendingUp className="w-3 h-3" />
              <span>Trends</span>
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-1">
          <div className="h-1 flex-1 bg-red-500 rounded-full" style={{ width: `${((stats.bySeverity.CRITICAL || 0) / (stats.totalIncidents || 1)) * 100}%` }} />
          <div className="h-1 flex-1 bg-orange-500 rounded-full" style={{ width: `${((stats.bySeverity.HIGH || 0) / (stats.totalIncidents || 1)) * 100}%` }} />
          <div className="h-1 flex-1 bg-amber-500 rounded-full" style={{ width: `${((stats.bySeverity.MEDIUM || 0) / (stats.totalIncidents || 1)) * 100}%` }} />
          <div className="h-1 flex-1 bg-slate-700 rounded-full" />
        </div>
      </div>

      {/* Critical / High Alerts */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-red-900/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">High & Critical Priority</span>
          <div className="p-2 bg-red-500/10 text-red-400 rounded-lg">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-red-400">{criticalAndHigh}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-red-950/60 text-red-300 border border-red-800/60 font-medium">
            Requires Triage
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-400 flex items-center gap-1">
          <span className="text-red-400 font-semibold">{stats.bySeverity.CRITICAL || 0}</span> Critical •{' '}
          <span className="text-orange-400 font-semibold">{stats.bySeverity.HIGH || 0}</span> High
        </p>
      </div>

      {/* Compromised / Impacted Identities */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Correlated Identities</span>
          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">{stats.entitiesCount.users}</span>
          <span className="text-xs text-slate-500">Unique accounts</span>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Entra ID & M365 UPNs tracked
        </p>
      </div>

      {/* Impacted Endpoints */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Impacted Endpoints & IPs</span>
          <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
            <Laptop className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">
            {stats.entitiesCount.hosts + stats.entitiesCount.ips}
          </span>
          <span className="text-xs text-slate-500">Assets involved</span>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          {stats.entitiesCount.hosts} Hosts • {stats.entitiesCount.ips} Network IPs
        </p>
      </div>
    </div>
  );
};

