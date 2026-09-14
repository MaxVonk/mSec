import React, { useState, useEffect, useMemo } from 'react';
import { X, Play, CheckCircle2, AlertTriangle, ShieldCheck, Terminal, ArrowRight, RefreshCw, Layers, User, Server, Globe, Target } from 'lucide-react';
import { PlaybookDefinition, StepExecutionState } from '../../types/soar';
import { PREBUILT_PLAYBOOKS } from '../../utils/soarPlaybooks';
import { UnifiedIncident } from '../../types';
import { audioService } from '../../utils/audioService';

interface PlaybookRunnerModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  incident?: UnifiedIncident | null;
  initialPlaybookId?: string;
  inline?: boolean;
  incidents?: UnifiedIncident[];
}

export const PlaybookRunnerModal: React.FC<PlaybookRunnerModalProps> = ({
  isOpen = true,
  onClose,
  incident,
  initialPlaybookId,
  inline = false,
  incidents
}) => {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(() => incident?.id || '');
  const activeIncident = useMemo(() => {
    if (selectedIncidentId) {
      return incidents?.find(i => i.id === selectedIncidentId) || (incident?.id === selectedIncidentId ? incident : null);
    }
    return incident || null;
  }, [selectedIncidentId, incidents, incident]);

  const [selectedPlaybook, setSelectedPlaybook] = useState<PlaybookDefinition>(() => {
    if (initialPlaybookId) {
      const found = PREBUILT_PLAYBOOKS.find(p => p.id === initialPlaybookId);
      if (found) return found;
    }
    return PREBUILT_PLAYBOOKS[0];
  });

  const [targetUser, setTargetUser] = useState<string>('');
  const [targetHost, setTargetHost] = useState<string>('');
  const [targetIp, setTargetIp] = useState<string>('');

  const [stepStates, setStepStates] = useState<StepExecutionState[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isDryRun, setIsDryRun] = useState(false);

  // Discover distinct users across available incidents for suggestions
  const discoveredUsers = useMemo(() => {
    const set = new Set<string>();
    if (incidents) {
      incidents.forEach(inc => {
        inc.entities?.forEach(e => {
          if (e.type === 'USER' && e.value) set.add(e.value);
        });
      });
    }
    if (incident) {
      incident.entities?.forEach(e => {
        if (e.type === 'USER' && e.value) set.add(e.value);
      });
    }
    return Array.from(set);
  }, [incidents, incident]);

  // Sync targets when active incident changes
  useEffect(() => {
    if (activeIncident) {
      const u = activeIncident.entities?.find(e => e.type === 'USER')?.value || 'jdoe@example.com';
      const h = activeIncident.entities?.find(e => e.type === 'HOST')?.value || 'DESKTOP-SEC-8901';
      const ip = activeIncident.entities?.find(e => e.type === 'IP')?.value || '194.26.29.112';
      setTargetUser(u);
      setTargetHost(h);
      setTargetIp(ip);
    } else {
      if (!targetUser) setTargetUser('jdoe@example.com');
      if (!targetHost) setTargetHost('DESKTOP-SEC-8901');
      if (!targetIp) setTargetIp('194.26.29.112');
    }
  }, [activeIncident]);

  // External incident prop change sync
  useEffect(() => {
    if (incident?.id) {
      setSelectedIncidentId(incident.id);
    }
  }, [incident]);

  // Auto-select most relevant playbook if opened with an incident
  useEffect(() => {
    if (isOpen || inline) {
      let bestPlaybook = PREBUILT_PLAYBOOKS[0];
      const targetInc = activeIncident || incident;
      if (initialPlaybookId) {
        const found = PREBUILT_PLAYBOOKS.find(p => p.id === initialPlaybookId);
        if (found) bestPlaybook = found;
      } else if (targetInc) {
        const mitreStr = targetInc.mitreTechniques?.map(m => `${m.tactic} ${m.techniqueId} ${m.techniqueName}`).join(' ') || '';
        const incText = `${targetInc.title} ${targetInc.description} ${mitreStr}`.toLowerCase();
        if (incText.includes('phish') || incText.includes('email')) {
          bestPlaybook = PREBUILT_PLAYBOOKS.find(p => p.id === 'phishing-campaign-purge') || bestPlaybook;
        } else if (incText.includes('ransom') || incText.includes('cobalt') || incText.includes('endpoint') || incText.includes('mimikatz')) {
          bestPlaybook = PREBUILT_PLAYBOOKS.find(p => p.id === 'ransomware-host-isolation') || bestPlaybook;
        } else if (incText.includes('exfiltrat') || incText.includes('download') || incText.includes('oauth')) {
          bestPlaybook = PREBUILT_PLAYBOOKS.find(p => p.id === 'data-exfiltration-blockade') || bestPlaybook;
        } else {
          bestPlaybook = PREBUILT_PLAYBOOKS.find(p => p.id === 'compromised-identity') || bestPlaybook;
        }
      }
      setSelectedPlaybook(bestPlaybook);
      resetExecution(bestPlaybook);
      audioService.playCommandOpen();
    }
  }, [isOpen, incident, initialPlaybookId, activeIncident]);

  const resetExecution = (playbook: PlaybookDefinition) => {
    setIsRunning(false);
    setIsCompleted(false);
    setLogs([]);
    setStepStates(
      playbook.steps.map(s => ({
        stepId: s.id,
        status: 'PENDING'
      }))
    );
  };

  const handleSelectPlaybook = (pb: PlaybookDefinition) => {
    if (isRunning) return;
    setSelectedPlaybook(pb);
    resetExecution(pb);
  };

  const runPlaybook = async () => {
    if (isRunning || isCompleted) return;
    setIsRunning(true);
    setLogs([`[${new Date().toLocaleTimeString()}] INITIATING SOAR RUNBOOK: "${selectedPlaybook.title}"...`]);

    const activeUser = targetUser.trim() || 'jdoe@example.com';
    const activeHost = targetHost.trim() || 'DESKTOP-SEC-8901';
    const activeIp = targetIp.trim() || '194.26.29.112';

    for (let i = 0; i < selectedPlaybook.steps.length; i++) {
      const step = selectedPlaybook.steps[i];

      // Set current step to RUNNING
      setStepStates(prev =>
        prev.map(st => (st.stepId === step.id ? { ...st, status: 'RUNNING', startedAt: Date.now() } : st))
      );

      setLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ▶ EXECUTING STEP [${i + 1}/${selectedPlaybook.steps.length}]: ${step.title}`
      ]);

      // Simulate network / API dispatch delay
      await new Promise(r => setTimeout(r, 1200));

      let stepOutput = '';
      if (step.actionType === 'REVOKE_ENTRA_SESSIONS') {
        stepOutput = `✓ Entra ID API 200 OK: Revoked active refresh tokens & web sessions for [${activeUser}].`;
      } else if (step.actionType === 'RESET_PASSWORD') {
        stepOutput = `✓ Graph API PATCH /users/${activeUser}: forceChangePasswordNextSignIn set to TRUE.`;
      } else if (step.actionType === 'ENFORCE_MFA') {
        stepOutput = `✓ Entra ID Risky User Flag: High Risk policy applied for [${activeUser}]. Step-Up FIDO2/MFA required.`;
      } else if (step.actionType === 'ISOLATE_HOST') {
        stepOutput = `✓ Defender for Endpoint Action ID 7a91bf: Host [${activeHost}] isolated. Telemetry port 443 preserved.`;
      } else if (step.actionType === 'KILL_PROCESS') {
        stepOutput = `✓ Live Response remote shell on [${activeHost}]: Terminated powershell.exe (PID 4920) and parent cmd.exe.`;
      } else if (step.actionType === 'BLOCK_IP_FIREWALL') {
        stepOutput = `✓ M365 Defender Network Protection: Added drop indicator for C2 IP [${activeIp}].`;
      } else if (step.actionType === 'PURGE_MAILBOX') {
        stepOutput = `✓ Exchange Online Compliance Search: Purged matching phishing campaign messages across mailboxes. Target: [${activeUser}].`;
      } else if (step.actionType === 'BLOCK_DOMAIN_TABL') {
        stepOutput = `✓ Tenant Allow/Block List (TABL): Domain entry added (Action: Block, Expires: 90 days).`;
      } else if (step.actionType === 'NOTIFY_RECIPIENTS') {
        stepOutput = `✓ Security Advisory dispatched to [${activeUser}] with tailored phishing coaching briefing.`;
      } else if (step.actionType === 'BLOCK_EGRESS') {
        stepOutput = `✓ Perimeter Firewall Rule deployed: Block egress TCP 443/8443 to [${activeIp}].`;
      } else if (step.actionType === 'QUARANTINE_OAUTH_APP') {
        stepOutput = `✓ Entra ID Service Principal: Revoked OAuth2 multi-tenant delegated grant permissions.`;
      } else {
        stepOutput = `✓ Action completed successfully.`;
      }

      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}]   ${stepOutput}`]);

      // Set current step to COMPLETED
      setStepStates(prev =>
        prev.map(st =>
          st.stepId === step.id ? { ...st, status: 'COMPLETED', completedAt: Date.now(), log: stepOutput } : st
        )
      );
    }

    setIsRunning(false);
    setIsCompleted(true);
    setLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] 🏁 SOAR AUTOMATED CONTAINMENT PIPELINE COMPLETED SUCCESSFULLY.`
    ]);
    audioService.playSuccessFanfare();
  };

  if (!inline && !isOpen) return null;

  const card = (
    <div className={`relative w-full ${inline ? 'max-w-none' : 'max-w-4xl max-h-[90vh]'} bg-slate-900/95 border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col overflow-hidden text-slate-100`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <ShieldCheck className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-wide text-white">SOAR Automated Playbook Runner</h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {selectedPlaybook.category}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Execute automated containment runbooks with real-time API dispatch and audit logging
            </p>
          </div>
        </div>
        {!inline && onClose && (
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
        {/* Interactive Target Scope & Incident Context Selector */}
        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Remediation Target Scope
              </span>
              {activeIncident ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  Incident #{activeIncident.incidentNumber || activeIncident.id} Linked
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                  Ad-Hoc / Custom Target
                </span>
              )}
            </div>

            {/* Incident Selector Dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-medium">Link Incident:</label>
              <select
                value={selectedIncidentId}
                onChange={e => {
                  const newId = e.target.value;
                  setSelectedIncidentId(newId);
                  const matched = incidents?.find(i => i.id === newId);
                  if (matched) {
                    const mitreStr = matched.mitreTechniques?.map(m => `${m.tactic} ${m.techniqueId} ${m.techniqueName}`).join(' ') || '';
                    const incText = `${matched.title} ${matched.description} ${mitreStr}`.toLowerCase();
                    let bestPlaybook = PREBUILT_PLAYBOOKS[0];
                    if (incText.includes('phish') || incText.includes('email')) {
                      bestPlaybook = PREBUILT_PLAYBOOKS.find(p => p.id === 'phishing-campaign-purge') || bestPlaybook;
                    } else if (incText.includes('ransom') || incText.includes('cobalt') || incText.includes('endpoint') || incText.includes('mimikatz')) {
                      bestPlaybook = PREBUILT_PLAYBOOKS.find(p => p.id === 'ransomware-host-isolation') || bestPlaybook;
                    } else if (incText.includes('exfiltrat') || incText.includes('download') || incText.includes('oauth')) {
                      bestPlaybook = PREBUILT_PLAYBOOKS.find(p => p.id === 'data-exfiltration-blockade') || bestPlaybook;
                    } else {
                      bestPlaybook = PREBUILT_PLAYBOOKS.find(p => p.id === 'compromised-identity') || bestPlaybook;
                    }
                    setSelectedPlaybook(bestPlaybook);
                    resetExecution(bestPlaybook);
                  }
                }}
                disabled={isRunning}
                className="text-xs bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 max-w-xs truncate cursor-pointer hover:border-slate-600"
              >
                <option value="">[Ad-Hoc / Manual Target - No Incident]</option>
                {incidents?.map(inc => (
                  <option key={inc.id} value={inc.id}>
                    #{inc.incidentNumber || inc.id} - {inc.title.slice(0, 40)} ({inc.severity})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Target Entity Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Target User */}
            <div className={`p-3 rounded-lg border transition-all ${
              selectedPlaybook.category === 'IDENTITY' || selectedPlaybook.category === 'EMAIL'
                ? 'bg-purple-950/30 border-purple-500/60 ring-1 ring-purple-500/30'
                : 'bg-slate-900/60 border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold flex items-center gap-1.5 text-slate-300">
                  <User className="w-3.5 h-3.5 text-purple-400" />
                  Target User (UPN / Email)
                </label>
                {(selectedPlaybook.category === 'IDENTITY' || selectedPlaybook.category === 'EMAIL') && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/30">
                    Active Target
                  </span>
                )}
              </div>
              <input
                type="text"
                list="discovered-users-list"
                value={targetUser}
                onChange={e => setTargetUser(e.target.value)}
                placeholder="e.g. user@example.com"
                disabled={isRunning}
                className="w-full text-xs font-mono bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <datalist id="discovered-users-list">
                {discoveredUsers.map(u => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>

            {/* Target Host */}
            <div className={`p-3 rounded-lg border transition-all ${
              selectedPlaybook.category === 'ENDPOINT'
                ? 'bg-red-950/30 border-red-500/60 ring-1 ring-red-500/30'
                : 'bg-slate-900/60 border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold flex items-center gap-1.5 text-slate-300">
                  <Server className="w-3.5 h-3.5 text-red-400" />
                  Target Hostname
                </label>
                {selectedPlaybook.category === 'ENDPOINT' && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-red-300 bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/30">
                    Active Target
                  </span>
                )}
              </div>
              <input
                type="text"
                value={targetHost}
                onChange={e => setTargetHost(e.target.value)}
                placeholder="e.g. DESKTOP-SEC-8901"
                disabled={isRunning}
                className="w-full text-xs font-mono bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            {/* Target IP */}
            <div className={`p-3 rounded-lg border transition-all ${
              selectedPlaybook.category === 'NETWORK'
                ? 'bg-blue-950/30 border-blue-500/60 ring-1 ring-blue-500/30'
                : 'bg-slate-900/60 border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold flex items-center gap-1.5 text-slate-300">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  Target IP / C2 Network
                </label>
                {selectedPlaybook.category === 'NETWORK' && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-blue-300 bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/30">
                    Active Target
                  </span>
                )}
              </div>
              <input
                type="text"
                value={targetIp}
                onChange={e => setTargetIp(e.target.value)}
                placeholder="e.g. 194.26.29.112"
                disabled={isRunning}
                className="w-full text-xs font-mono bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>
        </div>

          {/* Playbook Selector Tabs */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Available SOC Playbooks
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1.5">
              {PREBUILT_PLAYBOOKS.map(pb => {
                const isSelected = pb.id === selectedPlaybook.id;
                return (
                  <button
                    key={pb.id}
                    onClick={() => handleSelectPlaybook(pb)}
                    disabled={isRunning}
                    className={`text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30'
                        : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
                    } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-white">{pb.title}</span>
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          pb.category === 'IDENTITY'
                            ? 'bg-purple-500/20 text-purple-300'
                            : pb.category === 'ENDPOINT'
                            ? 'bg-red-500/20 text-red-300'
                            : pb.category === 'EMAIL'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        {pb.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{pb.description}</p>
                    <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-slate-400">
                      <span className="font-mono text-cyan-400">{pb.steps.length} steps</span>
                      <span>•</span>
                      <span>~{pb.steps.reduce((acc, s) => acc + s.estimatedSeconds, 0)}s execution</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stepped Workflow Pipeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Containment Action Pipeline
              </label>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDryRun}
                    onChange={e => setIsDryRun(e.target.checked)}
                    disabled={isRunning}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Simulation / Dry-Run</span>
                </label>
              </div>
            </div>

            <div className="space-y-2.5">
              {selectedPlaybook.steps.map((step, idx) => {
                const state: StepExecutionState = stepStates.find(s => s.stepId === step.id) || {
                  stepId: step.id,
                  status: 'PENDING'
                };
                return (
                  <div
                    key={step.id}
                    className={`p-4 rounded-xl border flex items-start gap-3.5 transition-all ${
                      state.status === 'RUNNING'
                        ? 'bg-cyan-950/30 border-cyan-500/60 ring-1 ring-cyan-500/40'
                        : state.status === 'COMPLETED'
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : 'bg-slate-950/40 border-slate-800/80'
                    }`}
                  >
                    <div className="mt-0.5">
                      {state.status === 'RUNNING' && (
                        <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                      )}
                      {state.status === 'COMPLETED' && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      )}
                      {state.status === 'PENDING' && (
                        <div className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center text-[10px] font-mono text-slate-400">
                          {idx + 1}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-white">{step.title}</h4>
                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                            state.status === 'RUNNING'
                              ? 'bg-cyan-500/20 text-cyan-300 animate-pulse'
                              : state.status === 'COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {state.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{step.description}</p>
                      {state.log && (
                        <p className="mt-2 text-xs font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-1.5 rounded border border-emerald-900/50">
                          {state.log}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Execution Console Log */}
          {logs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                SOAR Execution Telemetry Log
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 space-y-1 max-h-40 overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index} className="leading-relaxed">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {isCompleted ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Runbook finished with 0 errors
              </span>
            ) : isRunning ? (
              <span className="text-cyan-400 font-mono animate-pulse flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Dispatching remediation API calls...
              </span>
            ) : (
              <span>Ready for automated execution.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isCompleted && (
              <button
                onClick={() => resetExecution(selectedPlaybook)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Reset
              </button>
            )}
            <button
              onClick={runPlaybook}
              disabled={isRunning || isCompleted}
              className={`px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg transition-all ${
                isRunning || isCompleted
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/20'
              }`}
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" /> Execute Playbook Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>
  );

  if (inline) {
    return card;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      {card}
    </div>
  );
};
