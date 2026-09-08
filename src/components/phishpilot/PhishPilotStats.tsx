import React from 'react';
import { Mail, ShieldAlert, ShieldQuestion, ShieldCheck } from 'lucide-react';
import { PhishPilotStats } from '../../phishpilotTypes';

interface Props {
  stats: PhishPilotStats | null;
}

export const PhishPilotStatsCard: React.FC<Props> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Analyzed */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
        <div className="flex items-center gap-2 text-slate-400">
          <Mail className="w-4 h-4 text-cyan-500" />
          <span className="text-xs font-bold uppercase tracking-wider">Total Analyzed</span>
        </div>
        <div className="text-3xl font-bold text-slate-100 mt-1">
          {stats?.totalAnalyzed || 0}
        </div>
        <div className="absolute -right-4 -bottom-4 opacity-5">
          <Mail className="w-24 h-24 text-cyan-500" />
        </div>
      </div>

      {/* Confirmed Phishing */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
        <div className="flex items-center gap-2 text-slate-400">
          <ShieldAlert className="w-4 h-4 text-red-500" />
          <span className="text-xs font-bold uppercase tracking-wider">Confirmed Phishing</span>
        </div>
        <div className="text-3xl font-bold text-red-400 mt-1">
          {stats?.verdictCounts.PHISHING || 0}
        </div>
        <div className="absolute -right-4 -bottom-4 opacity-5">
          <ShieldAlert className="w-24 h-24 text-red-500" />
        </div>
      </div>

      {/* Suspicious */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
        <div className="flex items-center gap-2 text-slate-400">
          <ShieldQuestion className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wider">Suspicious</span>
        </div>
        <div className="text-3xl font-bold text-amber-400 mt-1">
          {stats?.verdictCounts.SUSPICIOUS || 0}
        </div>
        <div className="absolute -right-4 -bottom-4 opacity-5">
          <ShieldQuestion className="w-24 h-24 text-amber-500" />
        </div>
      </div>

      {/* Legitimate */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
        <div className="flex items-center gap-2 text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-bold uppercase tracking-wider">Legitimate</span>
        </div>
        <div className="text-3xl font-bold text-emerald-400 mt-1">
          {stats?.verdictCounts.LEGITIMATE || 0}
        </div>
        <div className="absolute -right-4 -bottom-4 opacity-5">
          <ShieldCheck className="w-24 h-24 text-emerald-500" />
        </div>
      </div>
    </div>
  );
};
