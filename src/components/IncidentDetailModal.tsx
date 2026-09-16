import React, { useState, useMemo } from 'react';
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
  Download,
  Mail,
  Inbox,
  Link,
  Link2,
  Calendar,
  Zap,
  ArrowRight
} from 'lucide-react';
import { InvestigationGraph } from './graph/InvestigationGraph';
import { buildIncidentGraph } from '../utils/graphBuilder';
import { ThreatIntelBadge } from './common/ThreatIntelBadge';
import { formatIncidentDateTime } from '../utils/incidentCorrelator';
import { recommendPlaybook } from '../utils/playbookRecommender';

interface IncidentDetailModalProps {
  incident: UnifiedIncident | null;
  onClose: () => void;
  onExecuteAction: (incidentId: string, actionId: string) => Promise<void>;
  onUpdateStatus: (id: string, status: IncidentStatus) => void;
  onDelete: (id: string) => void;
  onOpenPlaybook?: (incident: UnifiedIncident, playbookId?: string) => void;
}

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  incident,
  onClose,
  onExecuteAction,
  onUpdateStatus,
  onDelete,
  onOpenPlaybook
}) => {
  const [activeTab, setActiveTab] = useState<'threat' | 'graph' | 'timeline' | 'entities' | 'comments' | 'raw'>('threat');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [rawSource, setRawSource] = useState<'unified' | 'defender' | 'sentinel'>('unified');

  // React Rules of Hooks: All hooks MUST be declared unconditionally at top
  const emailEvidenceList = useMemo(() => {
    if (!incident) return [];
    if (incident?.emailEvidence && incident.emailEvidence.length > 0) {
      return incident.emailEvidence;
    }
    // Dynamic fallback from rawPayload if incident was cached before normalization
    const fromRaw: any[] = [];
    if (incident?.rawPayload) {
      const raw = incident.rawPayload;
      if (Array.isArray(raw.evidence)) fromRaw.push(...raw.evidence);
      if (Array.isArray(raw.alerts)) {
        for (const a of raw.alerts) {
          if (Array.isArray(a.evidence)) fromRaw.push(...a.evidence);
        }
      }
    }
    return fromRaw.filter(ev => 
      String(ev['@odata.type'] || '').toLowerCase().includes('analyzedmessageevidence') ||
      Boolean(ev.networkMessageId) ||
      Boolean(ev.p2Sender && ev.recipientEmailAddress)
    ).map(ev => ({
      networkMessageId: ev.networkMessageId,
      internetMessageId: ev.internetMessageId,
      subject: ev.subject,
      senderEmail: ev.p2Sender?.emailAddress || ev.senderAddress || ev.sender,
      senderDisplayName: ev.p2Sender?.displayName,
      senderDomain: ev.p2Sender?.domainName,
      returnPathEmail: ev.p1Sender?.emailAddress,
      recipientEmail: ev.recipientEmailAddress || ev.recipient,
      senderIp: ev.senderIp,
      deliveryAction: ev.deliveryAction,
      deliveryLocation: ev.deliveryLocation,
      threats: Array.isArray(ev.threats) ? ev.threats : (ev.threats ? [String(ev.threats)] : []),
      detectionMethods: Array.isArray(ev.detectionMethods) ? ev.detectionMethods : [],
      direction: ev.direction || ev.antiSpamDirection,
      receivedDateTime: ev.receivedDateTime || ev.createdDateTime,
      urls: Array.isArray(ev.urls) ? ev.urls.filter((u: any) => typeof u === 'string' && u.trim().length > 0) : [],
      attachmentsCount: ev.attachmentsCount
    }));
  }, [incident]);

  const currentRawPayload = useMemo(() => {
    if (!incident) return null;
    if (!incident.isChained) return incident.rawPayload || incident;
    if (rawSource === 'defender') {
      const defRef = incident.linkedIncidents?.find(l => l.provider !== 'SENTINEL_SIEM');
      return defRef?.rawPayload || incident.rawPayload?.defenderPayload || incident.rawPayload || incident;
    }
    if (rawSource === 'sentinel') {
      const senRef = incident.linkedIncidents?.find(l => l.provider === 'SENTINEL_SIEM');
      return senRef?.rawPayload || incident.rawPayload?.sentinelPayload || incident.rawPayload || incident;
    }
    return incident.rawPayload || incident;
  }, [incident, rawSource]);

  if (!incident) return null;

  const recommendation = useMemo(() => {
    return recommendPlaybook(incident);
  }, [incident]);

  const assessment = incident.threatAssessment;
  const commentsCount = (incident.comments?.length || 0) + (incident.resolvingComment ? 1 : 0);

  const handleCopy = async (id: string, text: string) => {
    let success = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch (err) {
        console.warn('navigator.clipboard failed, attempting fallback', err);
      }
    }
    if (!success) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand('copy');
        textArea.remove();
      } catch (err) {
        console.error('Fallback clipboard copy failed:', err);
      }
    }
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleDownloadJson = () => {
    if (!incident || !currentRawPayload) return;
    try {
      const data = JSON.stringify(currentRawPayload, null, 2);
      const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileTag = incident.isChained ? `-${rawSource}` : '';
      a.download = `incident-${incident.incidentNumber || incident.id}${fileTag}-payload.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download JSON:', err);
    }
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
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/60 shrink-0">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                incident.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                incident.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {incident.severity}
              </span>
              {incident.isChained ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-950 via-indigo-950 to-purple-950 text-cyan-200 border border-cyan-500/50 flex items-center gap-1 shadow-sm">
                  <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Sentinel SIEM + Defender XDR</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  {incident.provider}
                </span>
              )}
              <span className="text-xs text-slate-400 font-mono">
                #{incident.incidentNumber || incident.id}
              </span>

              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                <Calendar className="w-3 h-3 text-cyan-400" />
                <span>{formatIncidentDateTime(incident.createdTime)}</span>
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

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {incident.incidentWebUrl && (
              <a
                href={incident.incidentWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                title="Open incident in primary security portal"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{incident.isChained ? 'Defender Portal' : (incident.provider === 'SENTINEL_SIEM' ? 'Sentinel Portal' : 'Portal')}</span>
              </a>
            )}

            {incident.isChained && incident.linkedIncidents?.map((link, idx) => {
              if (!link.incidentWebUrl || link.incidentWebUrl === incident.incidentWebUrl) return null;
              return (
                <a
                  key={idx}
                  href={link.incidentWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                  title={`Open incident in ${link.provider === 'SENTINEL_SIEM' ? 'Azure Sentinel' : 'Microsoft Defender'} Portal`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{link.provider === 'SENTINEL_SIEM' ? 'Sentinel Portal' : 'Defender Portal'}</span>
                </a>
              );
            })}

            {onOpenPlaybook && (
              <button
                onClick={() => onOpenPlaybook(incident, recommendation?.playbook.id)}
                title={recommendation ? `Launch Recommended Playbook: ${recommendation.playbook.title}` : "Launch Automated SOAR Containment Playbook"}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm ${
                  recommendation
                    ? 'bg-amber-950/80 hover:bg-amber-900 border border-amber-500/60 text-amber-300 ring-1 ring-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                    : 'bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300'
                }`}
              >
                {recommendation ? (
                  <Zap className="w-3.5 h-3.5 fill-current text-amber-400 animate-pulse" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>{recommendation ? `Playbook: ${recommendation.playbook.category}` : 'Playbook'}</span>
              </button>
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

        {/* Correlated SIEM + XDR Incident Banner */}
        {incident.isChained && (
          <div className="mx-6 mt-3 p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/90 via-slate-900 to-indigo-950/90 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shrink-0">
                <Link2 className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-cyan-200 flex items-center gap-2">
                  <span>Correlated Dual-Platform Telemetry</span>
                  <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-[10px] text-cyan-300 font-mono uppercase font-bold border border-cyan-500/30">
                    SIEM & XDR Chained
                  </span>
                </div>
                <div className="text-slate-300 text-xs mt-0.5">
                  Unified Microsoft Sentinel SIEM (#{incident.linkedIncidents?.find(l => l.provider === 'SENTINEL_SIEM')?.incidentNumber || 'SIEM'}) with Microsoft 365 Defender XDR (#{incident.linkedIncidents?.find(l => l.provider !== 'SENTINEL_SIEM')?.incidentNumber || 'XDR'}). Deduplicated entities, merged MITRE techniques, and unified forensic telemetry.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {incident.linkedIncidents?.map((link, idx) => link.incidentWebUrl ? (
                <a
                  key={idx}
                  href={link.incidentWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/90 hover:bg-slate-800 border border-cyan-700/50 text-cyan-300 text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{link.provider === 'SENTINEL_SIEM' ? 'Azure Sentinel Portal' : 'Defender XDR Portal'}</span>
                </a>
              ) : null)}
            </div>
          </div>
        )}

        {/* Automated Playbook Recommendation Banner for High & Critical Incidents */}
        {recommendation && (
          <div className="mx-6 mt-3 p-4 rounded-2xl bg-gradient-to-r from-amber-950/50 via-slate-900 to-cyan-950/40 border border-amber-500/40 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm animate-pulse">
                    <Zap className="w-3 h-3 fill-current text-amber-400" />
                    Recommended Containment Playbook
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {recommendation.confidence} Confidence ({recommendation.score}% Match)
                  </span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                    Category: {recommendation.playbook.category}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    {recommendation.playbook.title}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {recommendation.rationale}
                  </p>
                </div>

                {/* Pre-configured Containment Target & Steps Preview */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
                  {recommendation.suggestedTarget && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-200 font-mono text-[11px]">
                      <span className="text-amber-400 font-semibold">{recommendation.suggestedTarget.label}:</span>
                      <span className="text-white font-bold">{recommendation.suggestedTarget.value}</span>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <span className="text-slate-500 font-medium">Runbook:</span>
                    <span className="text-cyan-300 font-mono">{recommendation.keyActionSummary}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                {onOpenPlaybook && (
                  <button
                    onClick={() => onOpenPlaybook(incident, recommendation.playbook.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/25 cursor-pointer"
                    title="Launch this recommended playbook with pre-populated targets"
                  >
                    <Zap className="w-4 h-4 fill-current" />
                    <span>Run Suggested Playbook</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {onOpenPlaybook && (
                  <button
                    onClick={() => onOpenPlaybook(incident)}
                    className="text-[11px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                  >
                    Browse other playbooks
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-800 px-6 py-2 bg-slate-950/40 gap-1.5 overflow-x-auto shrink-0 sticky top-0 z-20">
          <button
            onClick={() => setActiveTab('threat')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              activeTab === 'threat'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/60 shadow-sm shadow-cyan-950/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            {emailEvidenceList.length > 0 ? <Mail className="w-4 h-4 text-indigo-400" /> : <ShieldAlert className="w-4 h-4" />}
            <span>{emailEvidenceList.length > 0 ? 'Email Threat & Overview' : 'Threat Oversight'}</span>
            {emailEvidenceList.length > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-900/80 text-indigo-300 text-[10px] font-mono border border-indigo-700/60">
                {emailEvidenceList.length} mail
              </span>
            ) : assessment ? (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-900 text-cyan-300 text-[10px] font-mono">
                {assessment.containmentActions.length}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab('graph')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              activeTab === 'graph'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/60 shadow-sm shadow-cyan-950/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Investigation Graph</span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              activeTab === 'timeline'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/60 shadow-sm shadow-cyan-950/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Timeline & Alerts ({incident.alerts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('entities')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              activeTab === 'entities'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/60 shadow-sm shadow-cyan-950/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Entities & Evidence ({incident.entities.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('comments')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              activeTab === 'comments'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/60 shadow-sm shadow-cyan-950/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Analyst Notes ({commentsCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              activeTab === 'raw'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/60 shadow-sm shadow-cyan-950/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Raw Payload</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-6">
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

          {/* TAB 1: THREAT OVERSIGHT & EMAIL FORENSICS */}
          {activeTab === 'threat' && (
            <div className="space-y-6">
              {/* Email Threat & Delivery Forensics Card (Defender for Office 365 / Email Incidents) */}
              {emailEvidenceList.length > 0 && (
                <div className="rounded-2xl border border-indigo-500/40 bg-gradient-to-b from-indigo-950/40 via-slate-900/90 to-slate-950 p-5 space-y-4 shadow-xl shadow-indigo-950/40">
                  <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                            Email Message Forensics & Delivery Inspection
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                            Defender for Office 365
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-white mt-0.5 select-all">
                          {emailEvidenceList[0].subject || 'No Subject Line'}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {emailEvidenceList[0].deliveryLocation && (
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider border ${
                          emailEvidenceList[0].deliveryLocation.toLowerCase().includes('quarantine')
                            ? 'bg-rose-950/60 border-rose-600/60 text-rose-300'
                            : 'bg-amber-950/60 border-amber-600/60 text-amber-300'
                        }`}>
                          Location: {emailEvidenceList[0].deliveryLocation}
                        </span>
                      )}
                      {emailEvidenceList[0].deliveryAction && (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-800 border border-slate-700 text-slate-300">
                          Action: {emailEvidenceList[0].deliveryAction}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sender / Recipient Matrix */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Sender Forensics</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-slate-200 font-medium flex items-center gap-1.5 flex-wrap">
                          {emailEvidenceList[0].senderDisplayName && (
                            <span className="font-semibold text-white">{emailEvidenceList[0].senderDisplayName}</span>
                          )}
                          {emailEvidenceList[0].senderEmail && (
                            <code className="text-[11px] font-mono bg-slate-950 px-2 py-0.5 rounded text-cyan-300 border border-slate-800">
                              &lt;{emailEvidenceList[0].senderEmail}&gt;
                            </code>
                          )}
                          {emailEvidenceList[0].senderEmail && (
                            <button
                              onClick={() => handleCopy('sender-email', emailEvidenceList[0].senderEmail || '')}
                              title="Copy sender address"
                              className="text-slate-500 hover:text-cyan-400 p-1 rounded hover:bg-slate-800 cursor-pointer"
                            >
                              {copiedId === 'sender-email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                        {emailEvidenceList[0].returnPathEmail && emailEvidenceList[0].returnPathEmail !== emailEvidenceList[0].senderEmail && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                            <span className="text-amber-400 font-semibold">Envelope Return-Path (P1):</span>
                            <code className="font-mono text-slate-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800/80">
                              {emailEvidenceList[0].returnPathEmail}
                            </code>
                          </div>
                        )}
                        {emailEvidenceList[0].senderDomain && (
                          <div className="text-[11px] text-slate-400">
                            Sender Domain: <span className="text-slate-200 font-mono font-semibold">{emailEvidenceList[0].senderDomain}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Inbox className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Recipient & Mail Infrastructure</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-slate-200 font-medium flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-400">Target Recipient:</span>
                          {emailEvidenceList[0].recipientEmail && (
                            <code className="text-[11px] font-mono bg-slate-950 px-2 py-0.5 rounded text-emerald-300 border border-slate-800">
                              {emailEvidenceList[0].recipientEmail}
                            </code>
                          )}
                          {emailEvidenceList[0].recipientEmail && (
                            <button
                              onClick={() => handleCopy('recipient-email', emailEvidenceList[0].recipientEmail || '')}
                              title="Copy recipient address"
                              className="text-slate-500 hover:text-emerald-400 p-1 rounded hover:bg-slate-800 cursor-pointer"
                            >
                              {copiedId === 'recipient-email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                        {emailEvidenceList[0].senderIp && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span>Originating IP:</span>
                            <code className="font-mono text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {emailEvidenceList[0].senderIp}
                            </code>
                            <ThreatIntelBadge indicator={emailEvidenceList[0].senderIp} type="IP" />
                            <button
                              onClick={() => handleCopy('sender-ip', emailEvidenceList[0].senderIp || '')}
                              title="Copy sender IP"
                              className="text-slate-500 hover:text-cyan-400 p-1 rounded hover:bg-slate-800 cursor-pointer"
                            >
                              {copiedId === 'sender-ip' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                        {emailEvidenceList[0].receivedDateTime && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>Received Time: {new Date(emailEvidenceList[0].receivedDateTime).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Threat Tags & Detections */}
                  {emailEvidenceList[0].threats && emailEvidenceList[0].threats.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Threat Classifications:
                      </span>
                      {emailEvidenceList[0].threats.map((threat: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/80 text-rose-300 border border-rose-800/80 flex items-center gap-1"
                        >
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          {threat}
                        </span>
                      ))}
                      {emailEvidenceList[0].detectionMethods?.map((dm: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700"
                        >
                          Detection: {dm}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Extracted URLs */}
                  {emailEvidenceList[0].urls && emailEvidenceList[0].urls.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Link className="w-3.5 h-3.5" />
                          <span>Extracted Email URLs & Embedded Links ({emailEvidenceList[0].urls.length})</span>
                        </div>
                        <span className="text-[10px] text-slate-500">Defanged for SOC safety</span>
                      </div>
                      <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                        {emailEvidenceList[0].urls.map((url: string, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono group"
                          >
                            <span className="text-slate-300 truncate select-all">{url}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <ThreatIntelBadge indicator={url} type="URL" />
                              <button
                                onClick={() => handleCopy(`url-${idx}`, url)}
                                title="Copy URL"
                                className="text-slate-500 hover:text-cyan-400 p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                {copiedId === `url-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Assessment review banner */}
              {assessment ? (
                <>
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
                    {(assessment.containmentActions || []).filter(a => a.status === 'EXECUTED').length} / {(assessment.containmentActions || []).length} Executed
                  </span>
                </div>

                <div className="space-y-2.5">
                  {(assessment.containmentActions || []).map((action) => {
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
                    {(assessment.trustBoundariesViolated || []).map((tb, idx) => (
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
              {(assessment.frontendRisks || []).length > 0 && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    <span>Frontend & Identity Attack Surfaces</span>
                  </h4>
                  <ul className="space-y-1.5">
                    {(assessment.frontendRisks || []).map((fr, idx) => (
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
                  {(assessment.remediationGuidance || []).map((rg, idx) => (
                    <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>{rg}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>Incident Overview & Telemetry Details</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">
                {incident.description || 'No additional summary text provided by security telemetry.'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs">
                <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Provider</span>
                  <span className="text-cyan-400 font-mono font-medium">{incident.provider}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Status</span>
                  <span className="text-slate-200 font-mono font-medium">{incident.status}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Classification</span>
                  <span className="text-slate-300 font-mono font-medium">{incident.classification || 'None'}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Determination</span>
                  <span className="text-slate-300 font-mono font-medium">{incident.determination || 'None'}</span>
                </div>
              </div>
            </div>
          )}
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
                        {ent.type === 'MAILBOX' && <Mail className="w-4 h-4" />}
                        {ent.type === 'URL' && <Link className="w-4 h-4" />}
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
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-400">Payload Source:</span>
                  {incident.isChained ? (
                    <div className="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                      <button
                        onClick={() => setRawSource('unified')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          rawSource === 'unified'
                            ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-700/80 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Unified Merged
                      </button>
                      <button
                        onClick={() => setRawSource('defender')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          rawSource === 'defender'
                            ? 'bg-indigo-950 text-indigo-300 font-bold border border-indigo-700/80 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        M365 Defender
                      </button>
                      <button
                        onClick={() => setRawSource('sentinel')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          rawSource === 'sentinel'
                            ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-700/80 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Sentinel SIEM
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300 font-mono">Original {incident.provider} API JSON</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadJson}
                    title="Download active raw JSON file"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer border border-slate-700 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Download JSON</span>
                  </button>
                  <button
                    onClick={() => handleCopy('raw-json', JSON.stringify(currentRawPayload || incident, null, 2))}
                    title="Copy formatted JSON to clipboard"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer border border-slate-700 shadow-sm"
                  >
                    {copiedId === 'raw-json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'raw-json' ? 'Copied to Clipboard!' : 'Copy JSON'}</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 overflow-x-auto max-h-[500px] select-all">
                {JSON.stringify(currentRawPayload || incident, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

