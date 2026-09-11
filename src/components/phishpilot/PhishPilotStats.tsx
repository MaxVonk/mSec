import React from 'react';
import { Mail, ShieldAlert, ShieldQuestion, ShieldCheck, Globe, AlertTriangle } from 'lucide-react';
import { PhishPilotStats } from '../../phishpilotTypes';

interface Props {
  stats: PhishPilotStats | null;
}

export const PhishPilotStatsCard: React.FC<Props> = ({ stats }) => {
  const total = stats?.totalAnalyzed || 0;
  const phishCount = stats?.verdictCounts.PHISHING || 0;
  const suspCount = stats?.verdictCounts.SUSPICIOUS || 0;
  const legitCount = stats?.verdictCounts.LEGITIMATE || 0;

  const phishPct = total > 0 ? Math.round((phishCount / total) * 100) : 0;
  const suspPct = total > 0 ? Math.round((suspCount / total) * 100) : 0;
  const legitPct = total > 0 ? Math.round((legitCount / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Analyzed */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center gap-2 text-slate-400">
            <Mail className="w-4 h-4 text-cyan-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Total Analyzed</span>
          </div>
          <div className="text-3xl font-bold text-slate-100 mt-1">
            {total}
          </div>
          <span className="text-xs text-slate-500">MIME submissions</span>
          <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
            <Mail className="w-24 h-24 text-cyan-500" />
          </div>
        </div>

        {/* Confirmed Phishing */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden group hover:border-red-900/60 transition-all">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Confirmed Phishing</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold text-red-400">{phishCount}</span>
            <span className="text-xs font-mono text-red-400/80 bg-red-950/50 px-1.5 py-0.5 rounded border border-red-800/60">
              {phishPct}%
            </span>
          </div>
          <span className="text-xs text-slate-500">High-confidence attacks</span>
          <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
            <ShieldAlert className="w-24 h-24 text-red-500" />
          </div>
        </div>

        {/* Suspicious */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden group hover:border-amber-900/60 transition-all">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldQuestion className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Suspicious</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold text-amber-400">{suspCount}</span>
            <span className="text-xs font-mono text-amber-400/80 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-800/60">
              {suspPct}%
            </span>
          </div>
          <span className="text-xs text-slate-500">Flagged for analyst review</span>
          <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
            <ShieldQuestion className="w-24 h-24 text-amber-500" />
          </div>
        </div>

        {/* Legitimate */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden group hover:border-emerald-900/60 transition-all">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Legitimate</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold text-emerald-400">{legitCount}</span>
            <span className="text-xs font-mono text-emerald-400/80 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/60">
              {legitPct}%
            </span>
          </div>
          <span className="text-xs text-slate-500">False positive reports</span>
          <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
            <ShieldCheck className="w-24 h-24 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Visual Verdict Distribution Bar & Top Threats */}
      {total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Multi-segment Verdict Ratio Bar */}
          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Email Attack Verdict Breakdown
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {total} Reports Analyzed
              </span>
            </div>

            {/* Stacked Progress Bar */}
            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-slate-800">
              {phishPct > 0 && (
                <div
                  style={{ width: `${phishPct}%` }}
                  className="h-full bg-red-500 rounded-l-full transition-all duration-500"
                  title={`Phishing: ${phishPct}% (${phishCount})`}
                />
              )}
              {suspPct > 0 && (
                <div
                  style={{ width: `${suspPct}%` }}
                  className="h-full bg-amber-500 transition-all duration-500"
                  title={`Suspicious: ${suspPct}% (${suspCount})`}
                />
              )}
              {legitPct > 0 && (
                <div
                  style={{ width: `${legitPct}%` }}
                  className="h-full bg-emerald-500 rounded-r-full transition-all duration-500"
                  title={`Legitimate: ${legitPct}% (${legitCount})`}
                />
              )}
            </div>

            {/* Legend Chips */}
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Phishing <strong className="font-mono text-red-400">({phishPct}%)</strong>
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Suspicious <strong className="font-mono text-amber-400">({suspPct}%)</strong>
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Legitimate <strong className="font-mono text-emerald-400">({legitPct}%)</strong>
              </span>
            </div>
          </div>

          {/* Top Malicious Domains Observed */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-2">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              Observed Malicious Domains
            </span>
            {stats?.topMaliciousDomains && stats.topMaliciousDomains.length > 0 ? (
              <div className="space-y-1.5">
                {stats.topMaliciousDomains.slice(0, 3).map((dom, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800/80"
                  >
                    <code className="text-red-400 font-mono text-[11px] truncate max-w-[180px]">
                      {dom}
                    </code>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      C2 / Phish
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic py-2">
                No active external malicious domains logged in recent submissions.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
