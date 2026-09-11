import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileText, 
  Download, 
  Copy, 
  Check, 
  Printer, 
  ShieldAlert, 
  Clock, 
  User, 
  Globe, 
  AlertTriangle,
  Calendar,
  Activity
} from 'lucide-react';
import { ShiftHandoverReport } from '../../types';

interface ShiftHandoverModalProps {
  onClose: () => void;
}

export const ShiftHandoverModal: React.FC<ShiftHandoverModalProps> = ({ onClose }) => {
  const [timeframe, setTimeframe] = useState<number>(12);
  const [analystName, setAnalystName] = useState('SOC Analyst');
  const [notes, setNotes] = useState('');
  const [reportData, setReportData] = useState<{ report: ShiftHandoverReport; markdown: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchReport = () => {
    setIsLoading(true);
    const params = new URLSearchParams({
      hours: timeframe.toString(),
      analyst: analystName
    });
    if (notes) params.append('notes', notes);

    fetch(`/api/reports/shift-handover?${params.toString()}`)
      .then(res => res.json())
      .then(data => setReportData(data))
      .catch(err => console.error('Failed to load handover report:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchReport();
  }, [timeframe]);

  const handleCopy = () => {
    if (!reportData) return;
    navigator.clipboard.writeText(reportData.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!reportData) return;
    const blob = new Blob([reportData.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mSec-Shift-Handover-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const rep = reportData?.report;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden print:bg-white print:text-black print:border-none print:shadow-none print:max-w-none print:max-h-none print:static">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Executive SOC Shift Handover Briefing
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                  Operational Report
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Summarizes shift triage activity, containment status, and action items for oncoming analysts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy MD'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .md</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter / Input Options Bar */}
        <div className="px-6 py-3 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-cyan-400" /> Timeframe:
            </span>
            {[8, 12, 24, 72].map(hrs => (
              <button
                key={hrs}
                onClick={() => setTimeframe(hrs)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  timeframe === hrs
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {hrs} Hours
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Analyst Name / Call Sign"
              value={analystName}
              onChange={e => setAnalystName(e.target.value)}
              onBlur={fetchReport}
              className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-md text-slate-200 text-xs focus:outline-none focus:border-cyan-500 w-44"
            />
          </div>
        </div>

        {/* Report Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 print:p-0 print:overflow-visible">
          {isLoading ? (
            <div className="py-20 text-center text-xs text-slate-400">
              <Activity className="w-6 h-6 text-cyan-500 animate-spin mx-auto mb-2" />
              Compiling shift metrics and threat indicators...
            </div>
          ) : rep ? (
            <div className="space-y-6">
              {/* Printable Header */}
              <div className="border-b border-slate-800 pb-4 print:border-black">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100 print:text-black">
                      SOC Operational Shift Handover
                    </h2>
                    <p className="text-xs text-slate-400 print:text-gray-600">
                      Shift ID: <code className="text-cyan-400 font-mono print:text-black">{rep.shiftId}</code> • Timeframe: Last {rep.timeframeHours} Hours
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-400 print:text-gray-600">
                    <span className="block font-semibold text-slate-200 print:text-black">{rep.analystName}</span>
                    <span>{new Date(rep.generatedAt).toLocaleDateString()} {new Date(rep.generatedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              {/* Analyst Observations Box */}
              <div className="space-y-1.5 print:hidden">
                <label className="text-xs font-bold text-slate-300 block">
                  Analyst Handover Notes & Shift Observations:
                </label>
                <textarea
                  rows={2}
                  placeholder="Record any active investigations, pending threat hunting tasks, or infrastructure alerts for the incoming shift..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onBlur={fetchReport}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {rep.notes && (
                <div className="hidden print:block p-3 border border-gray-300 rounded bg-gray-50 text-xs">
                  <strong>Analyst Notes:</strong> {rep.notes}
                </div>
              )}

              {/* 4 Shift KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 print:border-gray-300 print:bg-white">
                  <span className="text-[10px] uppercase font-bold text-slate-400 print:text-gray-500">
                    Active Incidents
                  </span>
                  <div className="text-2xl font-bold text-slate-100 print:text-black mt-1">
                    {rep.metrics.totalIncidents}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 print:border-gray-300 print:bg-white">
                  <span className="text-[10px] uppercase font-bold text-red-400 print:text-red-700">
                    Critical Threats
                  </span>
                  <div className="text-2xl font-bold text-red-400 print:text-red-700 mt-1">
                    {rep.metrics.criticalIncidents}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 print:border-gray-300 print:bg-white">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 print:text-green-700">
                    Containments Done
                  </span>
                  <div className="text-2xl font-bold text-emerald-400 print:text-green-700 mt-1">
                    {rep.metrics.containmentExecuted}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 print:border-gray-300 print:bg-white">
                  <span className="text-[10px] uppercase font-bold text-amber-400 print:text-amber-700">
                    Pending Actions
                  </span>
                  <div className="text-2xl font-bold text-amber-400 print:text-amber-700 mt-1">
                    {rep.metrics.containmentPending}
                  </div>
                </div>
              </div>

              {/* Action Items for Next Shift */}
              {rep.pendingActions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 print:text-black">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Priority Handover Action Items
                  </h4>
                  <div className="space-y-1.5">
                    {rep.pendingActions.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40 flex items-center justify-between text-xs print:border-gray-300 print:bg-white"
                      >
                        <div>
                          <span className="font-bold text-slate-200 print:text-black">{p.action.title}</span>
                          <span className="text-slate-400 print:text-gray-600 block text-[11px]">
                            Target: <code className="text-cyan-400 font-mono print:text-black">{p.action.target}</code> ({p.incidentTitle})
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 print:text-black print:border-gray-400">
                          PENDING
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Priority Incidents Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 print:text-black">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  Key Handover Incidents (Critical & High)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-800 rounded-xl overflow-hidden print:border-gray-300">
                    <thead className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase print:bg-gray-100 print:text-black">
                      <tr>
                        <th className="p-2.5">ID / Severity</th>
                        <th className="p-2.5">Incident Title</th>
                        <th className="p-2.5">Provider</th>
                        <th className="p-2.5">Affected Users</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 print:divide-gray-300">
                      {rep.keyIncidents.map(k => (
                        <tr key={k.id} className="hover:bg-slate-950/40">
                          <td className="p-2.5 font-mono whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold mr-1.5 ${
                                k.severity === 'CRITICAL' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-orange-950 text-orange-400 border border-orange-800'
                              }`}
                            >
                              {k.severity}
                            </span>
                            #{k.incidentNumber || k.id}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-200 print:text-black max-w-xs truncate">
                            {k.title}
                          </td>
                          <td className="p-2.5 text-slate-400 print:text-gray-700 font-mono text-[11px]">
                            {k.provider}
                          </td>
                          <td className="p-2.5 text-slate-300 print:text-gray-800 font-mono text-[11px]">
                            {k.affectedUsers.join(', ') || 'None identified'}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-cyan-400 print:text-black">
                            {k.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Correlated Entities Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 print:border-gray-300">
                  <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-2 print:text-black">
                    <User className="w-3.5 h-3.5 text-cyan-400" /> Top Targeted Users
                  </h5>
                  <div className="space-y-1">
                    {rep.topTargetedUsers.map((u, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-900 print:border-gray-200">
                        <span className="font-mono text-slate-300 print:text-black truncate max-w-[200px]">{u.user}</span>
                        <span className="font-bold text-cyan-400 font-mono">{u.incidentCount} incident(s)</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 print:border-gray-300">
                  <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-2 print:text-black">
                    <Globe className="w-3.5 h-3.5 text-amber-400" /> Top Attacker IPs
                  </h5>
                  <div className="space-y-1">
                    {rep.topAttackerIps.map((ip, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-900 print:border-gray-200">
                        <span className="font-mono text-slate-300 print:text-black">{ip.ip}</span>
                        <span className="font-bold text-amber-400 font-mono">{ip.count} alert(s)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

