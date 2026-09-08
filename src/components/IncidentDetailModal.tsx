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
  Trash2
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'threat' | 'timeline' | 'entities' | 'raw'>('threat');
  const [copied, setCopied] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  if (!incident) return null;

  const assessment = incident.threatAssessment;

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(incident.rawPayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActionClick = async (actionId: string) => {
    setExecutingActionId(actionId);
    try {
      await onExecuteAction(incident.id, actionId);
    } finally {
      setExecutingActionId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/50">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
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
            </div>
            <h2 className="text-lg font-bold text-white leading-snug">
              {incident.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
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
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/20">
          <button
            onClick={() => setActiveTab('threat')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'threat'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Threat Oversight & Containment</span>
            {assessment && (
              <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 text-[10px] font-mono">
                {assessment.containmentActions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
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
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'entities'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Entities ({incident.entities.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
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
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-200">{alt.title}</span>
                          <span className="text-[11px] text-slate-400">{new Date(alt.createdTime).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">{alt.description}</p>
                        <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                            {alt.provider}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-400">
                            {alt.severity}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ENTITIES */}
          {activeTab === 'entities' && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                {incident.entities.map((ent) => (
                  <div
                    key={ent.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-start gap-3"
                  >
                    <div className="p-2 rounded-lg bg-slate-900 text-cyan-400 shrink-0">
                      {ent.type === 'USER' && <User className="w-4 h-4" />}
                      {ent.type === 'HOST' && <Laptop className="w-4 h-4" />}
                      {ent.type === 'IP' && <Globe className="w-4 h-4" />}
                      {ent.type === 'FILE' && <FileCode className="w-4 h-4" />}
                      {ent.type === 'CLOUD_RESOURCE' && <Lock className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200 truncate">{ent.value}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                          {ent.type}
                        </span>
                      </div>
                      {ent.role && (
                        <p className="text-xs text-slate-400 mt-0.5">{ent.role}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: RAW PAYLOAD */}
          {activeTab === 'raw' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Original API / JSON Payload</span>
                <button
                  onClick={handleCopyPayload}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
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

