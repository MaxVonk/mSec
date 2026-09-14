import React, { useState, useEffect, useMemo } from 'react';
import { X, ShieldAlert, Monitor, Maximize2, Minimize2, Play, Activity, Clock, Users, Laptop, Radio, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { UnifiedIncident } from '../../types';

interface WarRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: UnifiedIncident[];
  onSelectIncident: (inc: UnifiedIncident) => void;
  onRunPlaybook: (inc?: UnifiedIncident) => void;
  onOpenShiftHandover: () => void;
}

export const WarRoomModal: React.FC<WarRoomModalProps> = ({
  isOpen,
  onClose,
  incidents,
  onSelectIncident,
  onRunPlaybook,
  onOpenShiftHandover
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Live UTC SOC Clock
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const criticals = incidents.filter(i => i.severity === 'CRITICAL');
    const highs = incidents.filter(i => i.severity === 'HIGH');
    const mediums = incidents.filter(i => i.severity === 'MEDIUM');
    const active = incidents.filter(i => i.status !== 'RESOLVED');

    const targetedUsers = new Set<string>();
    const targetedDevices = new Set<string>();
    incidents.forEach(i => {
      i.entities?.forEach(e => {
        if (e.type === 'USER') targetedUsers.add(e.value);
        if (e.type === 'HOST') targetedDevices.add(e.value);
      });
    });

    const threatLevel = criticals.length > 0 ? 'CRITICAL (DEFCON 2)' : highs.length > 0 ? 'ELEVATED (DEFCON 3)' : 'NORMAL (DEFCON 4)';

    return {
      total: incidents.length,
      activeCount: active.length,
      criticalCount: criticals.length,
      highCount: highs.length,
      mediumCount: mediums.length,
      uniqueUsers: targetedUsers.size,
      uniqueDevices: targetedDevices.size,
      threatLevel
    };
  }, [incidents]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col text-slate-100 overflow-hidden font-sans select-none animate-fadeIn">
      {/* Top Tactical HUD Header */}
      <div className="px-6 py-3 border-b border-emerald-500/20 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-black tracking-widest text-white uppercase font-mono">
              MSEC // SOC COMMAND WAR ROOM
            </span>
          </div>
          <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
            LIVE TELEMETRY WALLBOARD
          </span>
        </div>

        {/* Center Clock */}
        <div className="flex items-center gap-6 font-mono">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>UTC: {currentTime.toUTCString().slice(17, 25)}</span>
          </div>
          <div className="text-sm font-bold text-cyan-300">
            LOCAL: {currentTime.toLocaleTimeString()}
          </div>
        </div>

        {/* Right HUD Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-red-950/30 border border-red-500/30 text-red-400 hover:bg-red-900/50 hover:text-white transition-colors"
            title="Exit War Room"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Streaming Alert Ticker */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex items-center gap-3 overflow-hidden">
        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 shrink-0 uppercase tracking-wider">
          <Radio className="w-3.5 h-3.5 animate-pulse text-red-500" />
          ACTIVE STREAM:
        </div>
        <div className="flex-1 overflow-hidden whitespace-nowrap flex items-center gap-8 text-xs font-mono">
          {incidents.slice(0, 5).map((inc, i) => (
            <span
              key={inc.id}
              onClick={() => onSelectIncident(inc)}
              className="inline-flex items-center gap-2 cursor-pointer hover:text-cyan-300 transition-colors"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  inc.severity === 'CRITICAL' ? 'bg-red-500 animate-ping' : 'bg-amber-400'
                }`}
              />
              <span className="text-slate-400">[{inc.id}]</span>
              <span className="font-semibold text-white">{inc.title}</span>
              <span className="text-slate-500">({inc.provider})</span>
            </span>
          ))}
        </div>
      </div>

      {/* Wallboard Grid Body */}
      <div className="flex-1 p-6 grid grid-cols-12 gap-6 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
        {/* Left Column: Tactical Threat Radar & DEFCON Gauge */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Threat Level Banner */}
          <div
            className={`p-6 rounded-2xl border flex flex-col justify-between ${
              metrics.criticalCount > 0
                ? 'bg-red-950/30 border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]'
                : 'bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold tracking-wider uppercase text-slate-400">
                DEFENSE POSTURE CONDITION
              </span>
              <AlertOctagon
                className={`w-6 h-6 ${
                  metrics.criticalCount > 0 ? 'text-red-500 animate-bounce' : 'text-emerald-400'
                }`}
              />
            </div>
            <div className="my-4">
              <div
                className={`text-2xl font-black tracking-wider uppercase ${
                  metrics.criticalCount > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {metrics.threatLevel}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {metrics.criticalCount > 0
                  ? `${metrics.criticalCount} uncontained critical incidents require immediate SOAR response.`
                  : 'All perimeter telemetry operating within normal threshold limits.'}
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => onRunPlaybook()}
                className="flex-1 py-2.5 px-4 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/30 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Fast Containment Playbook
              </button>
            </div>
          </div>

          {/* Telemetry Metrics Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs font-mono text-slate-400 block">ACTIVE INCIDENTS</span>
              <span className="text-3xl font-black text-white font-mono">{metrics.activeCount}</span>
              <span className="text-[11px] text-cyan-400 block mt-1">out of {metrics.total} tracked</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs font-mono text-red-400 block">CRITICAL SEVERITY</span>
              <span className="text-3xl font-black text-red-400 font-mono">{metrics.criticalCount}</span>
              <span className="text-[11px] text-slate-500 block mt-1">immediate action</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
              <Users className="w-8 h-8 text-indigo-400/80" />
              <div>
                <span className="text-2xl font-bold font-mono text-white">{metrics.uniqueUsers}</span>
                <span className="text-xs text-slate-400 block">Targeted Identities</span>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
              <Laptop className="w-8 h-8 text-emerald-400/80" />
              <div>
                <span className="text-2xl font-bold font-mono text-white">{metrics.uniqueDevices}</span>
                <span className="text-xs text-slate-400 block">Targeted Endpoints</span>
              </div>
            </div>
          </div>

          {/* Data Connector Ingestion Feeds */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
              INGESTION PIPELINE FEEDS
            </span>
            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60">
              <span className="text-slate-300">Microsoft Sentinel SIEM</span>
              <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> ONLINE
              </span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60">
              <span className="text-slate-300">Microsoft 365 Defender XDR</span>
              <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> ONLINE
              </span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60">
              <span className="text-slate-300">Microsoft Entra ID Identity</span>
              <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> ONLINE
              </span>
            </div>
            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-slate-300">PhishPilot Email Engine</span>
              <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> ACTIVE (POLLING)
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Live High-Priority Incident Triage Board */}
        <div className="col-span-12 lg:col-span-8 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Prioritized Breach & Attack Feed
            </h3>
            <button
              onClick={onOpenShiftHandover}
              className="px-3 py-1.5 text-xs font-semibold bg-purple-600/80 hover:bg-purple-500 text-white rounded-lg transition-colors"
            >
              Export Shift Report
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {incidents.map(inc => {
              const isCrit = inc.severity === 'CRITICAL';
              return (
                <div
                  key={inc.id}
                  onClick={() => onSelectIncident(inc)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.005] ${
                    isCrit
                      ? 'bg-red-950/20 border-red-500/40 hover:border-red-400 hover:bg-red-900/30'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                          {inc.id}
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            isCrit ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {inc.severity}
                        </span>
                        <span className="text-xs font-mono text-slate-400">{inc.provider}</span>
                        {inc.mitreTechniques?.slice(0, 3).map(t => (
                          <span
                            key={t.techniqueId}
                            className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60"
                          >
                            {t.techniqueId}
                          </span>
                        ))}
                      </div>
                      <h4 className="text-sm font-bold text-white truncate mt-1">{inc.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2">{inc.description}</p>
                    </div>

                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onRunPlaybook(inc);
                      }}
                      className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-cyan-600/80 hover:bg-cyan-500 text-white rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" /> Playbook
                    </button>
                  </div>

                  <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400 font-mono">
                    <span>
                      User: <strong className="text-slate-200">{inc.entities?.find(e => e.type === 'USER')?.value || 'N/A'}</strong>
                    </span>
                    <span>
                      Host: <strong className="text-slate-200">{inc.entities?.find(e => e.type === 'HOST')?.value || 'N/A'}</strong>
                    </span>
                    <span>
                      IP: <strong className="text-slate-200">{inc.entities?.find(e => e.type === 'IP')?.value || 'N/A'}</strong>
                    </span>
                    <span>
                      Alerts: <strong className="text-slate-200">{inc.alerts?.length || 1}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
