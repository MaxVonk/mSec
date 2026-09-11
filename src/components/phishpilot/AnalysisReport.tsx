import React, { useState, useEffect } from 'react';
import { 
  X, ShieldAlert, ShieldCheck, ShieldQuestion, 
  AlertTriangle, CheckCircle, Link as LinkIcon, 
  Paperclip, FileText, ChevronDown, ChevronUp, Copy, BrainCircuit,
  Download, RefreshCw, Ban, UserX, Trash2, ArrowUpRight,
  Shield, Check, ExternalLink, Printer, ArrowLeft
} from 'lucide-react';
import { PhishPilotReport, PhishPilotVerdict } from '../../phishpilotTypes';

interface Props {
  report: PhishPilotReport | null;
  onClose: () => void;
  onReportUpdated?: (updatedReport: PhishPilotReport) => void;
}

export const AnalysisReport: React.FC<Props> = ({ report: initialReport, onClose, onReportUpdated }) => {
  const [report, setReport] = useState<PhishPilotReport | null>(initialReport);
  const [activeTab, setActiveTab] = useState<'overview' | 'remediation' | 'auth' | 'urls' | 'attachments' | 'microsoft' | 'raw'>('overview');
  const [headersExpanded, setHeadersExpanded] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Remediation Action States
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isEscalating, setIsEscalating] = useState(false);
  const [escalatedId, setEscalatedId] = useState<string | null>(initialReport?.escalatedIncidentId || null);

  useEffect(() => {
    setReport(initialReport);
    setEscalatedId(initialReport?.escalatedIncidentId || null);
    setFeedbackMsg(null);
  }, [initialReport]);

  if (!report) return null;

  const getVerdictColors = (verdict: PhishPilotVerdict) => {
    switch (verdict) {
      case 'PHISHING': return 'bg-red-500/10 border-red-500/50 text-red-400';
      case 'SUSPICIOUS': return 'bg-amber-500/10 border-amber-500/50 text-amber-400';
      case 'LEGITIMATE': return 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400';
    }
  };

  const VerdictIcon = report.verdict === 'PHISHING' ? ShieldAlert 
                    : report.verdict === 'SUSPICIOUS' ? ShieldQuestion 
                    : ShieldCheck;

  const handleCopyHeaders = () => {
    navigator.clipboard.writeText(JSON.stringify(report.headerAnalysis, null, 2));
  };

  // Remediation Actions
  const handlePurge = async () => {
    setActionLoading('purge');
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/phishpilot/reports/${report.id}/purge`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.report) {
        setReport(data.report);
        onReportUpdated?.(data.report);
        setFeedbackMsg({ type: 'success', text: data.log.details });
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Failed to execute purge' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlock = async (targetType: 'sender' | 'domain') => {
    setActionLoading(`block-${targetType}`);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/phishpilot/reports/${report.id}/block-sender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType })
      });
      const data = await res.json();
      if (res.ok && data.report) {
        setReport(data.report);
        onReportUpdated?.(data.report);
        setFeedbackMsg({ type: 'success', text: data.log.details });
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Failed to block target' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async () => {
    setActionLoading('revoke');
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/phishpilot/reports/${report.id}/revoke-sessions`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.report) {
        setReport(data.report);
        onReportUpdated?.(data.report);
        setFeedbackMsg({ type: 'success', text: data.log.details });
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Failed to revoke sessions' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEscalate = async () => {
    setIsEscalating(true);
    try {
      const res = await fetch(`/api/phishpilot/reports/${report.id}/escalate`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.incident) {
        setEscalatedId(data.incident.id);
        const updated = { ...report, escalatedIncidentId: data.incident.id };
        setReport(updated);
        onReportUpdated?.(updated);
        setFeedbackMsg({ 
          type: 'success', 
          text: `Escalated to mSec Incident #${data.incident.incidentNumber} (${data.incident.id}). Visible in SIEM Dashboard.` 
        });
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Failed to escalate report' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setIsEscalating(false);
    }
  };

  const exportReport = (format: 'json' | 'stix') => {
    window.open(`/api/phishpilot/reports/${report.id}/export?format=${format}`, '_blank');
    setShowExportMenu(false);
  };

  const homoglyphCount = report.urlAnalysis.filter(u => u.homoglyph?.isSuspicious).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-800 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-4 min-w-0 flex-1 pr-4">
            <div className={`p-3 rounded-xl border shrink-0 ${getVerdictColors(report.verdict)}`}>
              <VerdictIcon className="w-8 h-8" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-100 mb-1 truncate">{report.emailSummary.subject || '(No Subject)'}</h2>
              <div className="flex items-center gap-4 text-sm text-slate-400 flex-wrap">
                <span className="truncate">From: <strong className="text-slate-200">{report.emailSummary.from}</strong></span>
                <span className="truncate">To: <strong className="text-slate-200">{report.emailSummary.to}</strong></span>
                <span className="whitespace-nowrap">Date: {new Date(report.timestamp).toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 shrink-0">
            {/* Export Menu */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-30 animate-in fade-in">
                  <button
                    onClick={() => exportReport('json')}
                    className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Download JSON Report</span>
                  </button>
                  <button
                    onClick={() => exportReport('stix')}
                    className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Shield className="w-3.5 h-3.5 text-purple-400" />
                    <span>Download STIX 2.1 Bundle</span>
                  </button>
                  <button
                    onClick={() => { window.print(); setShowExportMenu(false); }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2 border-t border-slate-800"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Print Summary / PDF</span>
                  </button>
                </div>
              )}
            </div>

            <div className="text-right pl-2 border-l border-slate-800">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Risk Score</div>
              <div className="text-2xl font-black text-cyan-400">{report.riskScore}<span className="text-xs text-slate-500 font-normal">/100</span></div>
            </div>

            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors ml-2 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Action / Feedback Banner */}
        {feedbackMsg && (
          <div className={`px-6 py-2.5 text-xs flex items-center justify-between border-b shrink-0 ${
            feedbackMsg.type === 'success' 
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60' 
              : 'bg-red-950/40 text-red-300 border-red-800/60'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
              <span>{feedbackMsg.text}</span>
            </div>
            <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tabs Navigation Bar (Locked with shrink-0, sticky) */}
        <div className="flex px-6 py-2.5 border-b border-slate-800 bg-slate-900/90 gap-2 overflow-x-auto shrink-0 sticky top-0 z-20">
          {(['overview', 'remediation', 'auth', 'urls', 'attachments', 'microsoft', 'raw'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-3.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === tab 
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/60 shadow-sm shadow-cyan-950/50' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-transparent'
              }`}
            >
              <span className="capitalize">{tab === 'microsoft' ? 'Microsoft Cloud' : tab === 'auth' ? 'Email Auth' : tab}</span>
              {tab === 'remediation' && (report.remediationLogs?.length || 0) > 0 && (
                <span className="ml-1 bg-cyan-900 text-cyan-300 px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                  {report.remediationLogs?.length}
                </span>
              )}
              {tab === 'urls' && report.urlAnalysis.length > 0 && (
                <span className="ml-1 bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                  {report.urlAnalysis.length}
                </span>
              )}
              {tab === 'urls' && homoglyphCount > 0 && (
                <span className="ml-1 bg-amber-500/30 text-amber-400 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                  {homoglyphCount} SPOOF
                </span>
              )}
              {tab === 'attachments' && report.attachmentAnalysis.length > 0 && (
                <span className="ml-1 bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                  {report.attachmentAnalysis.length}
                </span>
              )}
              {tab === 'microsoft' && report.microsoftEnrichment?.senderEntraStatus?.impersonationDetected && (
                <span className="ml-1 bg-red-500/30 text-red-400 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                  ALERT
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/50">
          
          {/* Sticky Breadcrumb / Back to Overview Bar when inside sub-tabs */}
          {activeTab !== 'overview' && (
            <div className="mb-4 flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-sm sticky -top-2 z-10 shadow-sm">
              <button
                onClick={() => setActiveTab('overview')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-slate-700/80 shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>← Back to Overview</span>
              </button>
              <div className="flex items-center gap-2 text-xs text-slate-400 pr-2">
                <span>Tab:</span>
                <span className="text-slate-200 font-bold uppercase tracking-wider">
                  {activeTab === 'microsoft' ? 'Microsoft Cloud Enrichment' : activeTab === 'auth' ? 'Email Authentication' : activeTab}
                </span>
              </div>
            </div>
          )}
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Threat Correlation Banner */}
              {report.correlations && report.correlations.length > 0 && (
                <div className="bg-gradient-to-r from-purple-950/40 to-slate-900 border border-purple-600/40 rounded-xl p-5 shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping"></span>
                        <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                          Cross-Platform Threat Correlation Detected ({report.correlations.length} Matched Incident{report.correlations.length > 1 ? 's' : ''})
                        </h3>
                      </div>
                      <p className="text-xs text-slate-300">
                        Indicators from this email (IP, Domain, Hash, or Sender) match active security incidents in your mSec SIEM.
                      </p>
                      <div className="space-y-2 pt-1">
                        {report.correlations.map((c, idx) => (
                          <div key={idx} className="flex items-center gap-3 text-xs bg-slate-950/60 p-2.5 rounded-lg border border-purple-900/40">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-900/60 text-purple-300 border border-purple-700/50">
                              {c.matchType} Match
                            </span>
                            <span className="text-slate-300 font-mono text-[11px] truncate max-w-[200px]" title={c.matchedEntity}>
                              {c.matchedEntity}
                            </span>
                            <span className="text-slate-400">&rarr;</span>
                            <span className="text-slate-200 font-medium truncate flex-1">
                              [{c.severity}] {c.incidentTitle}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      {escalatedId ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-950/80 border border-purple-600/50 rounded-lg text-xs font-semibold text-purple-300">
                          <Check className="w-3.5 h-3.5" />
                          <span>Escalated to SIEM ({escalatedId})</span>
                        </div>
                      ) : (
                        <button
                          onClick={handleEscalate}
                          disabled={isEscalating}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                          <span>{isEscalating ? 'Escalating...' : 'Escalate to mSec Incident'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Remediation Bar */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    Automated Containment Actions
                  </h3>
                  <button
                    onClick={() => setActiveTab('remediation')}
                    className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <span>View Audit Trail ({report.remediationLogs?.length || 0})</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <button
                    onClick={handlePurge}
                    disabled={actionLoading !== null}
                    className="p-3 bg-slate-950 hover:bg-red-950/30 border border-slate-800 hover:border-red-600/50 rounded-xl text-left transition-all group cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Trash2 className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform" />
                      {actionLoading === 'purge' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-400" />}
                    </div>
                    <div className="text-xs font-bold text-slate-200">Tenant Mailbox Purge</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Delete copies across all inboxes</div>
                  </button>

                  <button
                    onClick={() => handleBlock('sender')}
                    disabled={actionLoading !== null}
                    className="p-3 bg-slate-950 hover:bg-amber-950/30 border border-slate-800 hover:border-amber-600/50 rounded-xl text-left transition-all group cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Ban className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                      {actionLoading === 'block-sender' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                    </div>
                    <div className="text-xs font-bold text-slate-200">Block Sender (TABL)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Quarantine sender in M365</div>
                  </button>

                  <button
                    onClick={() => handleBlock('domain')}
                    disabled={actionLoading !== null}
                    className="p-3 bg-slate-950 hover:bg-amber-950/30 border border-slate-800 hover:border-amber-600/50 rounded-xl text-left transition-all group cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Ban className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                      {actionLoading === 'block-domain' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                    </div>
                    <div className="text-xs font-bold text-slate-200">Block Domain (TABL)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Block entire origin domain</div>
                  </button>

                  <button
                    onClick={handleRevoke}
                    disabled={actionLoading !== null}
                    className="p-3 bg-slate-950 hover:bg-cyan-950/30 border border-slate-800 hover:border-cyan-600/50 rounded-xl text-left transition-all group cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <UserX className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                      {actionLoading === 'revoke' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
                    </div>
                    <div className="text-xs font-bold text-slate-200">Revoke Recipient Tokens</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Reset Entra ID refresh tokens</div>
                  </button>
                </div>
              </div>

              {/* Verdict Card */}
              <div className={`p-4 rounded-xl border ${getVerdictColors(report.verdict)} flex items-start gap-4`}>
                <VerdictIcon className="w-6 h-6 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-lg mb-2">Verdict: {report.verdict}</h3>
                  <div className="flex flex-wrap gap-2">
                    {report.recommendedActions.map((action, i) => (
                      <span key={i} className="bg-black/20 px-3 py-1 rounded-lg text-sm font-medium">
                        {action}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Analysis Summary */}
              {report.aiClassification && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BrainCircuit className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-slate-100">AI Analysis Summary</h3>
                    <span className="ml-auto text-sm text-slate-400">Confidence: {(report.aiClassification.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-bold text-slate-400 mb-2">Key Findings</h4>
                      <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                        {report.aiClassification.keyFindings.map((finding, i) => (
                          <li key={i}>{finding}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-400 mb-2">Indicators</h4>
                      <div className="flex flex-wrap gap-2">
                        {report.aiClassification.indicators.map((indicator, i) => (
                          <span key={i} className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs">
                            {indicator}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Risk Score Breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-slate-100">Risk Score Breakdown</h3>
                  <span className="text-sm font-bold text-cyan-400">{report.riskBreakdown.totalScore} / {report.riskBreakdown.maxPossible} points</span>
                </div>
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-950/50 text-slate-400">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Condition</th>
                      <th className="px-5 py-3 font-semibold">Detail</th>
                      <th className="px-5 py-3 font-semibold text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {report.riskBreakdown.items.map((item, i) => (
                      <tr key={i} className={item.triggered ? 'bg-red-500/5' : ''}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {item.triggered ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <CheckCircle className="w-4 h-4 text-slate-600" />}
                            <span className={item.triggered ? 'text-slate-200' : 'text-slate-500'}>{item.condition}</span>
                          </div>
                        </td>
                        <td className={`px-5 py-3 ${item.triggered ? 'text-slate-400' : 'text-slate-600'}`}>{item.detail || '-'}</td>
                        <td className={`px-5 py-3 text-right font-mono ${item.triggered ? 'text-red-400 font-bold' : 'text-slate-600'}`}>
                          {item.triggered ? `+${item.points}` : '0'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REMEDIATION TAB */}
          {activeTab === 'remediation' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-slate-100 text-base">Microsoft 365 Containment Actions</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Directly remediate threats in Exchange Online, Microsoft Defender Tenant Allow/Block Lists, and Entra ID.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Trash2 className="w-5 h-5 text-red-400" />
                        <h4 className="font-bold text-slate-200 text-sm">Tenant-Wide Purge</h4>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">
                        Searches all mailboxes across the organization for messages with subject &quot;{report.emailSummary.subject}&quot; and permanently deletes them.
                      </p>
                    </div>
                    <button
                      onClick={handlePurge}
                      disabled={actionLoading !== null}
                      className="w-full py-2 px-3 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {actionLoading === 'purge' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>Execute Mailbox Purge</span>
                    </button>
                  </div>

                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Ban className="w-5 h-5 text-amber-400" />
                        <h4 className="font-bold text-slate-200 text-sm">Tenant Allow/Block List</h4>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">
                        Adds sender or domain to the M365 Defender TABL quarantine list to block future delivery tenant-wide.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleBlock('sender')}
                        disabled={actionLoading !== null}
                        className="flex-1 py-2 px-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Block Sender
                      </button>
                      <button
                        onClick={() => handleBlock('domain')}
                        disabled={actionLoading !== null}
                        className="flex-1 py-2 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Block Domain
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <UserX className="w-5 h-5 text-cyan-400" />
                        <h4 className="font-bold text-slate-200 text-sm">Identity Token Revocation</h4>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">
                        Immediately terminates active Entra ID tokens and browser sessions for recipient ({report.emailSummary.to || 'targeted user'}).
                      </p>
                    </div>
                    <button
                      onClick={handleRevoke}
                      disabled={actionLoading !== null}
                      className="w-full py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {actionLoading === 'revoke' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>Revoke Active Sessions</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Remediation Audit Logs */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-slate-100">Remediation Action Audit Log</h3>
                  <span className="text-xs text-slate-400">{report.remediationLogs?.length || 0} action(s) logged</span>
                </div>
                {(!report.remediationLogs || report.remediationLogs.length === 0) ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No remediation actions have been executed for this report yet.
                  </div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-950/50 text-slate-400">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Timestamp</th>
                        <th className="px-5 py-3 font-semibold">Action</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-5 py-3 font-semibold">Target</th>
                        <th className="px-5 py-3 font-semibold">Details</th>
                        <th className="px-5 py-3 font-semibold">Operator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {report.remediationLogs.map((log, i) => (
                        <tr key={i}>
                          <td className="px-5 py-3 text-slate-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</td>
                          <td className="px-5 py-3 font-bold text-slate-200 font-mono">{log.action}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              log.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                              log.status === 'SIMULATED' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                              'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-300 font-mono truncate max-w-[150px]">{log.target}</td>
                          <td className="px-5 py-3 text-slate-400">{log.details}</td>
                          <td className="px-5 py-3 text-slate-400">{log.operator}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* AUTHENTICATION TAB */}
          {activeTab === 'auth' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'SPF', check: report.headerAnalysis.spf, record: report.headerAnalysis.dnsAuth?.spfRecord },
                  { label: 'DKIM', check: report.headerAnalysis.dkim, record: report.headerAnalysis.dnsAuth?.dkimSelector ? `${report.headerAnalysis.dnsAuth.dkimSelector}._domainkey` : undefined },
                  { label: 'DMARC', check: report.headerAnalysis.dmarc, record: report.headerAnalysis.dnsAuth?.dmarcRecord }
                ].map(({ label, check, record }) => (
                  <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-400">{label}</span>
                      {record && <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.5 rounded font-mono">Live DNS</span>}
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider ${
                      check.result === 'pass' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      check.result === 'fail' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      check.result === 'softfail' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {check.result}
                    </div>
                    {check.detail && <span className="text-xs text-slate-500 mt-1 leading-relaxed">{check.detail}</span>}
                    {record && (
                      <div className="mt-2 w-full p-2 bg-slate-950 rounded border border-slate-800/80 text-[10px] font-mono text-cyan-300/80 truncate text-left select-all" title={record}>
                        {record}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Live DNS Authentication Details */}
              {report.headerAnalysis.dnsAuth && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="font-bold text-slate-100 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                      Live DNS Policy & Alignment
                    </h3>
                    {report.headerAnalysis.dnsAuth.dmarcPolicy && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        Policy: p={report.headerAnalysis.dnsAuth.dmarcPolicy}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block mb-1">DMARC Alignment</span>
                      <span className={`font-bold capitalize ${report.headerAnalysis.dnsAuth.dmarcAlignment === 'aligned' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {report.headerAnalysis.dnsAuth.dmarcAlignment || 'Not evaluated'}
                      </span>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block mb-1">DKIM Key in DNS</span>
                      <span className={`font-bold ${report.headerAnalysis.dnsAuth.dkimKeyFound ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {report.headerAnalysis.dnsAuth.dkimKeyFound ? 'Valid Public Key Found' : (report.headerAnalysis.dnsAuth.dkimSelector ? 'Record not found' : 'No DKIM header')}
                      </span>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block mb-1">Live SPF Record</span>
                      <span className={`font-bold ${report.headerAnalysis.dnsAuth.spfRecord ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {report.headerAnalysis.dnsAuth.spfRecord ? 'Configured in TXT' : 'Missing SPF record'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="font-bold text-slate-100 border-b border-slate-800 pb-2">Header Anomalies</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg flex items-center gap-3 ${report.headerAnalysis.replyToMismatch ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-950 border border-slate-800'}`}>
                    {report.headerAnalysis.replyToMismatch ? <AlertTriangle className="w-5 h-5 text-amber-400" /> : <CheckCircle className="w-5 h-5 text-emerald-500" />}
                    <div>
                      <div className="text-sm font-bold text-slate-300">Reply-To Mismatch</div>
                      <div className="text-xs text-slate-500">{report.headerAnalysis.replyToMismatch ? 'Reply-To differs from From address' : 'Matches or not set'}</div>
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg flex items-center gap-3 ${report.headerAnalysis.returnPathMismatch ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-950 border border-slate-800'}`}>
                    {report.headerAnalysis.returnPathMismatch ? <AlertTriangle className="w-5 h-5 text-amber-400" /> : <CheckCircle className="w-5 h-5 text-emerald-500" />}
                    <div>
                      <div className="text-sm font-bold text-slate-300">Return-Path Mismatch</div>
                      <div className="text-xs text-slate-500">{report.headerAnalysis.returnPathMismatch ? 'Return-Path differs from From address' : 'Matches'}</div>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-800">
                  <div className="text-sm font-bold text-slate-300 mb-2">Routing Information</div>
                  <div className="flex gap-6 text-sm">
                    <div><span className="text-slate-500">Received Hops:</span> <span className="text-slate-200 font-bold">{report.headerAnalysis.receivedHops}</span></div>
                    <div>
                      <span className="text-slate-500">Origin IPs:</span> 
                      <span className="text-slate-200 ml-2">
                        {report.headerAnalysis.originIps.length > 0 ? report.headerAnalysis.originIps.join(', ') : 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* URLs TAB */}
          {activeTab === 'urls' && (
            <div className="space-y-4">
              {report.urlAnalysis.length === 0 ? (
                <div className="text-center py-12 text-slate-500 flex flex-col items-center">
                  <LinkIcon className="w-12 h-12 mb-4 opacity-20" />
                  <p>No URLs found in this email.</p>
                </div>
              ) : (
                report.urlAnalysis.map((url, i) => (
                  <div key={i} className={`bg-slate-900 border rounded-xl p-5 ${
                    url.isMalicious || (url.homoglyph?.isSuspicious) ? 'border-red-500/50' : 
                    url.isDeceptive ? 'border-amber-500/50' : 
                    'border-slate-800'
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 break-all pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          {url.isMalicious || (url.homoglyph?.isSuspicious) ? <ShieldAlert className="w-4 h-4 text-red-500" /> : 
                           url.isDeceptive ? <ShieldQuestion className="w-4 h-4 text-amber-500" /> :
                           <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                          <span className="font-mono text-sm text-slate-200 font-bold">{url.domain}</span>
                          {url.homoglyph?.isSuspicious && (
                            <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded text-[10px] font-bold uppercase tracking-wider">
                              Homoglyph Spoof
                            </span>
                          )}
                        </div>
                        <a href={url.url} target="_blank" rel="noreferrer" className="text-xs text-cyan-500 hover:underline">{url.url}</a>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <div className="text-xs text-slate-500 uppercase font-bold">Domain Age</div>
                        <div className="text-sm text-slate-300">{url.domainAgeDays !== null ? `${url.domainAgeDays} days` : 'Unknown'}</div>
                      </div>
                    </div>

                    {/* Homoglyph Detection Details */}
                    {url.homoglyph?.isSuspicious && (
                      <div className="mb-3 p-3 bg-red-950/30 border border-red-900/60 rounded-lg text-xs space-y-1 text-red-200">
                        <div className="flex items-center gap-2 font-bold text-red-300">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span>Brand Impersonation / Typosquatting Deception</span>
                        </div>
                        <div className="text-slate-300 text-[11px] leading-relaxed">
                          {url.homoglyph.explanation}
                        </div>
                        <div className="flex gap-4 pt-1 text-[11px] font-mono text-slate-400">
                          <span>Target Brand: <strong className="text-red-300">{url.homoglyph.impersonatedBrand}</strong></span>
                          <span>Punycode: <strong className="text-cyan-300">{url.homoglyph.punycode}</strong></span>
                          {url.homoglyph.similarityScore !== undefined && (
                            <span>Similarity: <strong className="text-amber-300">{(url.homoglyph.similarityScore * 100).toFixed(0)}%</strong></span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {url.reputationSources.length > 0 && (
                      <div className="bg-slate-950 rounded-lg p-3">
                        <div className="text-xs font-bold text-slate-500 mb-2 uppercase">Reputation Checks</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {url.reputationSources.map((rep, j) => (
                            <div key={j} className="flex flex-col text-xs bg-slate-900 px-3 py-2 rounded gap-0.5">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 font-medium">{rep.source}</span>
                                <span className={`font-bold uppercase text-[10px] px-1.5 py-0.5 rounded ${
                                  rep.result === 'malicious' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                                  rep.result === 'suspicious' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 
                                  'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                }`}>
                                  {rep.result}
                                </span>
                              </div>
                              {rep.detail && <span className="text-[11px] text-slate-500">{rep.detail}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ATTACHMENTS TAB */}
          {activeTab === 'attachments' && (
            <div className="space-y-4">
              {report.attachmentAnalysis.length === 0 ? (
                <div className="text-center py-12 text-slate-500 flex flex-col items-center">
                  <Paperclip className="w-12 h-12 mb-4 opacity-20" />
                  <p>No attachments found in this email.</p>
                </div>
              ) : (
                report.attachmentAnalysis.map((att, i) => (
                  <div key={i} className={`bg-slate-900 border rounded-xl p-5 ${att.isMalicious ? 'border-red-500/50' : att.isSuspiciousExtension ? 'border-amber-500/50' : 'border-slate-800'}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${att.isMalicious ? 'bg-red-500/20' : 'bg-slate-800'}`}>
                          <FileText className={`w-6 h-6 ${att.isMalicious ? 'text-red-400' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-200">{att.filename}</div>
                          <div className="text-xs text-slate-500">{att.mimeType} • {(att.size / 1024).toFixed(1)} KB</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {att.isPasswordProtected && <span className="bg-amber-500/20 text-amber-400 px-2 py-1 rounded text-xs font-bold">Password Protected</span>}
                        {att.isSuspiciousExtension && <span className="bg-amber-500/20 text-amber-400 px-2 py-1 rounded text-xs font-bold">Suspicious Ext</span>}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono mb-4">
                      <div><span className="text-slate-500">MD5:</span> <span className="text-slate-300 select-all">{att.md5}</span></div>
                      <div><span className="text-slate-500">SHA256:</span> <span className="text-slate-300 select-all truncate block">{att.sha256}</span></div>
                    </div>

                    {att.reputationSources.length > 0 && (
                      <div className="bg-slate-950 rounded-lg p-3">
                        <div className="text-xs font-bold text-slate-500 mb-2 uppercase">Reputation Checks</div>
                        <div className="flex flex-wrap gap-2">
                          {att.reputationSources.map((rep, j) => (
                            <span key={j} className={`px-2 py-1 rounded text-xs border ${
                              rep.result === 'malicious' ? 'border-red-500/30 text-red-400 bg-red-500/10' : 
                              rep.result === 'suspicious' ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' : 
                              'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                            }`}>
                              {rep.source}: {rep.result}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* MICROSOFT CLOUD SECURITY TAB */}
          {activeTab === 'microsoft' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                    <h3 className="font-bold text-slate-100">Microsoft Entra ID Sender Identity</h3>
                  </div>
                  {report.microsoftEnrichment?.senderEntraStatus?.isInternalUser ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Internal Employee
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      External Sender
                    </span>
                  )}
                </div>

                {report.microsoftEnrichment?.senderEntraStatus?.impersonationDetected && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/50 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-red-300 text-sm">VIP / Executive Impersonation Alert</h4>
                      <p className="text-xs text-red-400/90 mt-1">
                        {report.microsoftEnrichment.senderEntraStatus.riskDetail}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block mb-1 font-medium">Directory User Match</span>
                    <span className="text-slate-200 font-bold block truncate">
                      {report.microsoftEnrichment?.senderEntraStatus?.displayName || report.emailSummary.from}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block mb-1 font-medium">Identity Risk Level</span>
                    <span className={`font-bold capitalize ${
                      report.microsoftEnrichment?.senderEntraStatus?.riskLevel === 'high' ? 'text-red-400' :
                      report.microsoftEnrichment?.senderEntraStatus?.riskLevel === 'medium' ? 'text-amber-400' :
                      'text-emerald-400'
                    }`}>
                      {report.microsoftEnrichment?.senderEntraStatus?.riskLevel || 'None'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block mb-1 font-medium">Account Status</span>
                    <span className="text-slate-300">
                      {report.microsoftEnrichment?.senderEntraStatus?.accountEnabled !== undefined
                        ? (report.microsoftEnrichment.senderEntraStatus.accountEnabled ? 'Active' : 'Disabled')
                        : 'External / Unmanaged'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Exchange Online Protection Delivery & SCL */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-500"></div>
                    <h3 className="font-bold text-slate-100">Exchange Online Protection (EOP) Verdict</h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Direction: {report.microsoftEnrichment?.eopDeliveryStatus?.antispamDirection || 'Inbound'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block mb-1 font-medium">Spam Confidence Level (SCL)</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold font-mono text-slate-100">
                        {report.microsoftEnrichment?.eopDeliveryStatus?.spamConfidenceLevel !== undefined
                          ? report.microsoftEnrichment.eopDeliveryStatus.spamConfidenceLevel
                          : 'N/A'}
                      </span>
                      <span className="text-slate-400">
                        ({report.microsoftEnrichment?.eopDeliveryStatus?.verdictDescription || 'Standard Delivery'})
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block mb-1 font-medium">Microsoft Defender TI Check</span>
                    <span className={`font-bold capitalize ${
                      report.microsoftEnrichment?.defenderTiResults?.verdict === 'malicious' ? 'text-red-400' :
                      report.microsoftEnrichment?.defenderTiResults?.verdict === 'suspicious' ? 'text-amber-400' :
                      'text-emerald-400'
                    }`}>
                      {report.microsoftEnrichment?.defenderTiResults?.verdict || 'Clean / No Host Flagged'}
                    </span>
                    {report.microsoftEnrichment?.defenderTiResults?.checkedDomain && (
                      <span className="text-[11px] text-slate-500 block mt-0.5 truncate">
                        Domain: {report.microsoftEnrichment.defenderTiResults.checkedDomain}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* RAW EMAIL TAB */}
          {activeTab === 'raw' && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                <button 
                  onClick={() => setHeadersExpanded(!headersExpanded)}
                  className="px-5 py-3 bg-slate-800/50 hover:bg-slate-800 border-b border-slate-800 flex items-center justify-between transition-colors"
                >
                  <span className="font-bold text-slate-200 text-sm">Raw Headers Analysis</span>
                  {headersExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {headersExpanded && (
                  <div className="p-4 relative group">
                    <button 
                      onClick={handleCopyHeaders}
                      className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-all"
                      title="Copy Headers JSON"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <pre className="text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(report.headerAnalysis, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[500px]">
                <div className="px-5 py-3 bg-slate-800/50 border-b border-slate-800">
                  <span className="font-bold text-slate-200 text-sm">Body Preview (Sanitized)</span>
                </div>
                <div className="p-5 overflow-y-auto flex-1">
                  <div className="text-sm font-mono text-slate-300 whitespace-pre-wrap">
                    {report.emailSummary.bodyPreview || 'No text content available.'}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
