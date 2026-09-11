import React, { useState } from 'react';
import { 
  UnifiedIncident, 
  IncidentStatus, 
  ContainmentAction 
} from '../types';
import { 
  X, 
  ShieldAlert, 
  ShieldCheck, 
  Terminal, 
  User, 
  Laptop, 
  Globe, 
  FileCode, 
  CheckCircle2, 
  Clock, 
  Play, 
  Copy, 
  Check, 
  AlertTriangle,
  Lock,
  Compass,
  FileSpreadsheet,
  Trash2,
  ExternalLink,
  MessageSquare,
  Lightbulb,
  UserCheck,
  Layers,
  Download
} from 'lucide-react';
import { InvestigationGraph } from './graph/InvestigationGraph';
import { buildIncidentGraph } from '../utils/graphBuilder';
import { ThreatIntelBadge } from './common/ThreatIntelBadge';

interface IncidentDetailModalProps {
  incident: UnifiedIncident | null;
  onClose: () => void;
  onExecuteAction: (incidentId: string, actionId: string) => Promise<void>;
  onUpdateStatus: (id: string, status: IncidentStatus) => void;
  onDelete: (id: string) => void;
}

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  incident,
  onClose,
  onExecuteAction,
  onUpdateStatus,
  onDelete
}) => {
  const [activeTab, setActiveTab] = useState<'threat' | 'graph' | 'timeline' | 'entities' | 'comments' | 'raw'>('threat');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  if (!incident) return null;

  const assessment = incident.threatAssessment;
  const commentsCount = (incident.comments?.length || 0) + (incident.resolvingComment ? 1 : 0);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleActionClick = async (actionId: string) => {
    setExecutingActionId(actionId);
    try {
      await onExecuteAction(incident.id, actionId);
    } finally {
      setExecutingActionId(null);
    }
  };

  const handleDownloadIncidentReport = async () => {
    try {
      const res = await fetch(`/api/reports/incident/${incident.id}/markdown`);
      if (res.ok) {
        const md = await res.text();
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Incident-${incident.incidentNumber || incident.id}-Report.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to export incident report:', err);
    }
  };

  const getBadgeClass = (val?: string) => {
    if (!val) return 'bg-slate-800 text-slate-300 border-slate-700';
    const s = val.toLowerCase();
    if (s.includes('false') || s.includes('notmalicious') || s.includes('clean') || s.includes('benign')) {
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    }
    if (s.includes('true') || s.includes('malicious') || s.includes('compromised')) {
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    }
    if (s.includes('suspicious') || s.includes('hacktool') || s.includes('investigat')) {
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/50">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                incident.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                incident.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {incident.severity}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                {incident.provider}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                #{incident.incidentNumber || incident.id}
              </span>

              {incident.classification && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getBadgeClass(incident.classification)}`}>
                  {incident.classification}
                </span>
              )}

              {incident.determination && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getBadgeClass(incident.determination)}`}>
                  {incident.determination}
                </span>
              )}

              {incident.assignedTo && (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  <UserCheck className="w-3 h-3 text-cyan-400" />
                  <span>{incident.assignedTo}</span>
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-white leading-snug">
              {incident.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {incident.incidentWebUrl && (
              <a
                href={incident.incidentWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                title="Open incident in Microsoft Defender Portal"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Defender Portal</span>
              </a>
            )}

            <button
              onClick={handleDownloadIncidentReport}
              title="Download full incident forensic post-mortem report (.md)"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report</span>
            </button>

            <select
              value={incident.status}
              onChange={(e) => onUpdateStatus(incident.id, e.target.value as IncidentStatus)}
              className="text-xs px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg cursor-pointer focus:outline-none"
            >
              <option value="ACTIVE">Active</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
            </select>

            <button
              onClick={() => { onDelete(incident.id); onClose(); }}
              title="Delete this incident"
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-4.5 h-4.5" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/20 overflow-x-auto">
          <button
            onClick={() => setActiveTab('threat')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'threat'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Threat Oversight</span>
            {assessment && (
              <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 text-[10px] font-mono">
                {assessment.containmentActions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('graph')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'graph'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Investigation Graph</span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'timeline'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Timeline & Alerts ({incident.alerts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('entities')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'entities'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Entities & Evidence ({incident.entities.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('comments')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'comments'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Analyst Notes ({commentsCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'raw'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Raw Payload</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB: INVESTIGATION GRAPH */}
          {activeTab === 'graph' && (
            <div className="space-y-4">
              <InvestigationGraph
                data={buildIncidentGraph(incident)}
                height={500}
                title={`Attack Path & Correlated Blast Radius: #${incident.incidentNumber || incident.id}`}
                subtitle={`${incident.alerts.length} alert(s) • ${incident.entities.length} entity/entities • ${incident.mitreTechniques.length} ATT&CK technique(s)`}
              />
            </div>
          )}

          {/* TAB 1: THREAT OVERSIGHT */}
          {activeTab === 'threat' && assessment && (
            <div className="space-y-6">
              {/* Summary banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-slate-800/80 to-slate-900 border border-slate-700/80">
                <div className="flex items-center gap-2 mb-2">
                  <Compass className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                    Threat Oversight Agent Review
                  </span>
                  <span className="text-[10px] text-slate-500 ml-auto">
                    Conforms to .github/agents/threat-oversight.agent.md
                  </span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-medium">
                  {assessment.summary}
                </p>
              </div>

              {/* Immediate Containment Actions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Actionable Containment Controls</span>
                  </h4>
                  <span className="text-xs text-slate-500">
                    {assessment.containmentActions.filter(a => a.status === 'EXECUTED').length} / {assessment.containmentActions.length} Executed
                  </span>
                </div>

                <div className="space-y-2.5">
                  {assessment.containmentActions.map((action) => {
                    const isExecuted = action.status === 'EXECUTED';
                    const isExecuting = executingActionId === action.id;

                    return (
                      <div
                        key={action.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                          isExecuted
                            ? 'bg-emerald-950/20 border-emerald-800/50 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isExecuted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                          )}
                          <div>
                            <p className="text-xs font-semibold text-slate-100">
                              {action.title}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                              Target: <span className="text-cyan-300">{action.target}</span> • Action: {action.actionType}
                            </p>
                          </div>
                        </div>

                        <div>
                          {isExecuted ? (
                            <span className="px-3 py-1 rounded bg-emerald-950 text-emerald-400 text-xs font-semibold border border-emerald-800/60">
                              Enforced
                            </span>
                          ) : (
                            <button
                              onClick={() => handleActionClick(action.id)}
                              disabled={isExecuting}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-red-900/20 cursor-pointer disabled:opacity-50"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>{isExecuting ? 'Executing...' : 'Execute Now'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trust Boundaries & Attack Scenario */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Trust Boundaries Violated</span>
                  </h4>
                  <ul className="space-y-1.5">
                    {assessment.trustBoundariesViolated.map((tb, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                        <span className="text-red-400 font-bold">•</span>
                        <span>{tb}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Attack Path & Scenario</span>
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {assessment.attackScenario}
                  </p>
                </div>
              </div>

              {/* Frontend & Identity Surface Risks */}
              {assessment.frontendRisks.length > 0 && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    <span>Frontend & Identity Attack Surfaces</span>
                  </h4>
                  <ul className="space-y-1.5">
                    {assessment.frontendRisks.map((fr, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                        <span className="text-cyan-400 font-bold">•</span>
                        <span>{fr}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Remediation Guidance */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Long-term Hardening & Remediation</span>
                </h4>
                <ul className="space-y-1.5">
                  {assessment.remediationGuidance.map((rg, idx) => (
                    <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>{rg}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: TIMELINE & SUB-ALERTS */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400">
                Correlated alerts chronologically aggregated by M365 Defender and Microsoft Sentinel
              </div>

              {incident.alerts.length === 0 ? (
                <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-xs">
                  This incident was imported directly as a single aggregated event.
                </div>
              ) : (
                <div className="relative pl-6 border-l-2 border-slate-800 space-y-6">
                  {incident.alerts.map((alt) => (
                    <div key={alt.id} className="relative">
                      <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-cyan-500 ring-4 ring-slate-900" />
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-slate-200">{alt.title}</span>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-300">
                                {alt.provider}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-amber-400">
                                {alt.severity}
                              </span>
                              {alt.classification && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${getBadgeClass(alt.classification)}`}>
                                  {alt.classification}
                                </span>
                              )}
                              {alt.determination && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${getBadgeClass(alt.determination)}`}>
                                  {alt.determination}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                            {new Date(alt.createdTime).toLocaleString()}
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed">{alt.description}</p>

                        {/* Recommended Actions */}
                        {alt.recommendedActions && (
                          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-start gap-2.5">
                            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[11px] font-bold text-slate-300 block">Defender Recommended Actions</span>
                              <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{alt.recommendedActions}</p>
                            </div>
                          </div>
                        )}

                        {/* External Alert Link */}
                        {alt.alertWebUrl && (
                          <div className="pt-2 border-t border-slate-800/60 flex justify-end">
                            <a
                              href={alt.alertWebUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                            >
                              <span>Open Alert in Microsoft Defender</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ENTITIES & EVIDENCE */}
          {activeTab === 'entities' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400">
                Security entities extracted from Defender XDR alerts, host telemetry, command lines, and network indicators
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {incident.entities.map((ent) => {
                  // 1. PROCESS ENTITY
                  if (ent.type === 'PROCESS') {
                    return (
                      <div key={ent.id} className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-amber-950/40 text-amber-400 border border-amber-800/40">
                              <Terminal className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-200">Process Execution</span>
                              {ent.role && <span className="ml-2 text-[10px] text-amber-400/80 font-mono">({ent.role})</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => handleCopy(ent.id, ent.details?.commandLine || ent.value)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-mono transition-colors cursor-pointer"
                          >
                            {copiedId === ent.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedId === ent.id ? 'Copied' : 'Copy Command'}</span>
                          </button>
                        </div>

                        <div className="p-3 bg-black/60 border border-slate-800/80 rounded-lg font-mono text-xs text-amber-300/90 whitespace-pre-wrap break-all select-all">
                          {ent.details?.commandLine || ent.value}
                        </div>

                        {ent.details && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800/60 text-[11px]">
                            {ent.details.processId !== undefined && (
                              <div className="bg-slate-900/60 p-2 rounded border border-slate-800/40">
                                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Process ID (PID)</span>
                                <span className="text-slate-300 font-mono">{ent.details.processId}</span>
                              </div>
                            )}
                            {ent.details.parentProcessId !== undefined && (
                              <div className="bg-slate-900/60 p-2 rounded border border-slate-800/40">
                                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Parent PID (PPID)</span>
                                <span className="text-slate-300 font-mono">{ent.details.parentProcessId}</span>
                              </div>
                            )}
                            {ent.details.filePath && (
                              <div className="bg-slate-900/60 p-2 rounded border border-slate-800/40 sm:col-span-2">
                                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Binary Path</span>
                                <span className="text-slate-300 font-mono truncate block" title={ent.details.filePath}>{ent.details.filePath}</span>
                              </div>
                            )}
                            {ent.details.sha256 && (
                              <div className="bg-slate-900/60 p-2 rounded border border-slate-800/40 sm:col-span-4 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">SHA-256 Checksum</span>
                                  <span className="text-slate-400 font-mono text-[10px] truncate block">{ent.details.sha256}</span>
                                </div>
                                <button
                                  onClick={() => handleCopy(`sha-${ent.id}`, ent.details?.sha256 || '')}
                                  className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                                  title="Copy SHA-256"
                                >
                                  {copiedId === `sha-${ent.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // 2. HOST / ENDPOINT ENTITY
                  if (ent.type === 'HOST') {
                    return (
                      <div key={ent.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-2 rounded-lg bg-slate-900 text-cyan-400 shrink-0">
                              <Laptop className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-100 truncate block">{ent.value}</span>
                              <span className="text-[10px] text-slate-400 font-mono">HOST / ENDPOINT</span>
                            </div>
                          </div>
                          {ent.details?.osPlatform && (
                            <span className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/50 text-blue-300 text-[11px] font-medium shrink-0">
                              {ent.details.osPlatform} {ent.details.version || ''}
                            </span>
                          )}
                        </div>

                        {ent.details && (
                          <div className="text-[11px] space-y-1 pt-2 border-t border-slate-800/50">
                            {ent.details.lastIpAddress && (
                              <div className="flex justify-between text-slate-400">
                                <span>Internal IP:</span>
                                <span className="text-slate-200 font-mono">{ent.details.lastIpAddress}</span>
                              </div>
                            )}
                            {ent.details.lastExternalIpAddress && (
                              <div className="flex justify-between items-center text-slate-400">
                                <span>External IP:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-200 font-mono">{ent.details.lastExternalIpAddress}</span>
                                  <ThreatIntelBadge indicator={ent.details.lastExternalIpAddress} type="IP" />
                                </div>
                              </div>
                            )}
                            {ent.details.mdeDeviceId && (
                              <div className="flex justify-between text-slate-400">
                                <span>MDE Device ID:</span>
                                <span className="text-slate-400 font-mono text-[10px] truncate max-w-[160px]" title={ent.details.mdeDeviceId}>{ent.details.mdeDeviceId}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // 3. USER ACCOUNT ENTITY
                  if (ent.type === 'USER') {
                    return (
                      <div key={ent.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-2 rounded-lg bg-slate-900 text-purple-400 shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-100 truncate block">{ent.value}</span>
                              <span className="text-[10px] text-slate-400 font-mono">USER ACCOUNT</span>
                            </div>
                          </div>
                          {ent.role && (
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 text-[10px] shrink-0">
                              {ent.role}
                            </span>
                          )}
                        </div>

                        {ent.details && (ent.details.accountName || ent.details.domainName) && (
                          <div className="text-[11px] space-y-1 pt-2 border-t border-slate-800/50">
                            {ent.details.accountName && (
                              <div className="flex justify-between text-slate-400">
                                <span>Account:</span>
                                <span className="text-slate-200 font-mono">{ent.details.accountName}</span>
                              </div>
                            )}
                            {ent.details.domainName && (
                              <div className="flex justify-between text-slate-400">
                                <span>Domain / Host:</span>
                                <span className="text-slate-200 font-mono">{ent.details.domainName}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // 4. IP / FILE / URL / MAILBOX / CLOUD RESOURCE ENTITIES
                  return (
                    <div
                      key={ent.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-start gap-3"
                    >
                      <div className="p-2 rounded-lg bg-slate-900 text-cyan-400 shrink-0">
                        {ent.type === 'IP' && <Globe className="w-4 h-4" />}
                        {ent.type === 'FILE' && <FileCode className="w-4 h-4" />}
                        {ent.type === 'CLOUD_RESOURCE' && <Lock className="w-4 h-4" />}
                        {ent.type === 'MAILBOX' && <User className="w-4 h-4" />}
                        {ent.type === 'URL' && <Globe className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-200 truncate">{ent.value}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {(ent.type === 'IP' || ent.type === 'FILE' || ent.type === 'URL') && (
                              <ThreatIntelBadge indicator={ent.value} type={ent.type === 'FILE' ? 'FILE_HASH' : (ent.type as any)} />
                            )}
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                              {ent.type}
                            </span>
                          </div>
                        </div>
                        {ent.role && (
                          <p className="text-xs text-slate-400 mt-0.5">{ent.role}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleCopy(ent.id, ent.value)}
                        className="p-1 text-slate-500 hover:text-slate-300 cursor-pointer"
                        title="Copy Value"
                      >
                        {copiedId === ent.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: ANALYST COMMENTS & SOC NOTES */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              {incident.resolvingComment && (
                <div className="p-4 rounded-xl bg-slate-950 border border-emerald-800/50 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Incident Resolution Note</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                    {incident.resolvingComment}
                  </p>
                </div>
              )}

              {(!incident.comments || incident.comments.length === 0) && !incident.resolvingComment ? (
                <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-xs">
                  No SOC analyst comments or resolution notes recorded for this incident.
                </div>
              ) : (
                <div className="space-y-3">
                  {incident.comments?.map((com, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{com.createdByDisplayName || 'SOC Analyst'}</span>
                        </span>
                        {com.createdDateTime && (
                          <span className="text-[11px] text-slate-500 font-mono">
                            {new Date(com.createdDateTime).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans bg-slate-900/40 p-3 rounded-lg border border-slate-800/60">
                        {com.comment}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: RAW PAYLOAD */}
          {activeTab === 'raw' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Original API / JSON Payload</span>
                <button
                  onClick={() => handleCopy('raw-json', JSON.stringify(incident.rawPayload || incident, null, 2))}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs transition-colors cursor-pointer"
                >
                  {copiedId === 'raw-json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === 'raw-json' ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 overflow-x-auto max-h-[500px]">
                {JSON.stringify(incident.rawPayload || incident, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

