import React, { useState, useMemo } from 'react';
import { X, ShieldAlert, Crosshair, ExternalLink, Filter, Play, CheckCircle2, ChevronRight, Info } from 'lucide-react';
import { UnifiedIncident } from '../../types';
import { audioService } from '../../utils/audioService';

interface MitreMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: UnifiedIncident[];
  onSelectIncident?: (incident: UnifiedIncident) => void;
  onRunPlaybook?: (incident?: UnifiedIncident) => void;
}

interface MitreTechnique {
  id: string;
  name: string;
  tacticId: string;
  description: string;
  detectionTip: string;
}

interface TacticDefinition {
  id: string;
  name: string;
  shortName: string;
  techniques: MitreTechnique[];
}

const TACTICS: TacticDefinition[] = [
  {
    id: 'TA0043',
    name: 'Reconnaissance',
    shortName: 'Recon',
    techniques: [
      { id: 'T1595', name: 'Active Scanning', tacticId: 'TA0043', description: 'Port and vulnerability scans probing externally facing assets.', detectionTip: 'Monitor perimeter firewall drops and Sentinel anomaly alerts.' },
      { id: 'T1589', name: 'Gather Victim Identity Info', tacticId: 'TA0043', description: 'Scraping employee emails and Entra ID UPNs.', detectionTip: 'Correlate high-rate failed user enumeration against tenant.' }
    ]
  },
  {
    id: 'TA0001',
    name: 'Initial Access',
    shortName: 'Init Access',
    techniques: [
      { id: 'T1566', name: 'Phishing', tacticId: 'TA0001', description: 'Spearphishing emails containing malicious URLs or payload attachments.', detectionTip: 'PhishPilot DMARC/DKIM SPF inspection and Exchange tenant purges.' },
      { id: 'T1078', name: 'Valid Accounts', tacticId: 'TA0001', description: 'Using stolen credentials for unauthorized cloud or VPN sign-ins.', detectionTip: 'Entra ID Identity Protection impossible travel & risky sign-in logs.' },
      { id: 'T1190', name: 'Exploit Public-Facing App', tacticId: 'TA0001', description: 'Exploiting internet-accessible software vulnerabilities.', detectionTip: 'Defender for Cloud web application firewall inspection.' }
    ]
  },
  {
    id: 'TA0002',
    name: 'Execution',
    shortName: 'Execution',
    techniques: [
      { id: 'T1059', name: 'Command & Scripting Interpreter', tacticId: 'TA0002', description: 'Execution via PowerShell, cmd.exe, or bash scripts.', detectionTip: 'Defender for Endpoint ProcessCommandLine telemetry with AMSI inspection.' },
      { id: 'T1204', name: 'User Execution', tacticId: 'TA0002', description: 'Target user clicking attachment or running malicious payload.', detectionTip: 'SmartScreen execution blocks and Office macro restrictions.' }
    ]
  },
  {
    id: 'TA0003',
    name: 'Persistence',
    shortName: 'Persistence',
    techniques: [
      { id: 'T1053', name: 'Scheduled Task/Job', tacticId: 'TA0003', description: 'Creating tasks or cron jobs to maintain recurring execution.', detectionTip: 'Windows Security Event ID 4698 task creation monitoring.' },
      { id: 'T1547', name: 'Boot or Logon Autostart', tacticId: 'TA0003', description: 'Registry Run keys and Startup folder persistence entries.', detectionTip: 'Defender Endpoint registry modification alerts.' }
    ]
  },
  {
    id: 'TA0004',
    name: 'Privilege Escalation',
    shortName: 'Priv Esc',
    techniques: [
      { id: 'T1068', name: 'Exploitation for Privilege Escalation', tacticId: 'TA0004', description: 'Exploiting kernel flaws to elevate to SYSTEM / Administrator.', detectionTip: 'M365 Defender behavioral heuristic alert inspection.' },
      { id: 'T1078.004', name: 'Cloud Privileged Roles', tacticId: 'TA0004', description: 'Activating Global Administrator or Privileged Role via Entra PIM.', detectionTip: 'Audit logs for role assignments outside standard PIM approval.' }
    ]
  },
  {
    id: 'TA0005',
    name: 'Defense Evasion',
    shortName: 'Evasion',
    techniques: [
      { id: 'T1562', name: 'Impair Defenses', tacticId: 'TA0005', description: 'Disabling Defender antivirus, tamper protection, or logging.', detectionTip: 'Tamper Protection alert and Event 5001 Antivirus disabled.' },
      { id: 'T1027', name: 'Obfuscated Files or Info', tacticId: 'TA0005', description: 'Base64, XOR, or encrypted command payloads.', detectionTip: 'AMSI de-obfuscation log in Sentinel DeviceProcessEvents.' }
    ]
  },
  {
    id: 'TA0006',
    name: 'Credential Access',
    shortName: 'Cred Access',
    techniques: [
      { id: 'T1003', name: 'OS Credential Dumping', tacticId: 'TA0006', description: 'Mimikatz or LSASS memory injection harvesting plaintext hashes.', detectionTip: 'Defender Credential Guard and Event 4656 LSASS handle requests.' },
      { id: 'T1110', name: 'Brute Force / Password Spray', tacticId: 'TA0006', description: 'Testing common passwords against large user population.', detectionTip: 'Entra ID Smart Lockout and high-volume 50126 sign-in failures.' }
    ]
  },
  {
    id: 'TA0007',
    name: 'Discovery',
    shortName: 'Discovery',
    techniques: [
      { id: 'T1087', name: 'Account Discovery', tacticId: 'TA0007', description: 'Net user, LDAP queries, or Graph API user enumerations.', detectionTip: 'BloodHound / SharpHound LDAP query bursts.' },
      { id: 'T1046', name: 'Network Service Discovery', tacticId: 'TA0007', description: 'Port scanning internal subnets to find lateral targets.', detectionTip: 'Defender for Identity internal reconnaissance detectors.' }
    ]
  },
  {
    id: 'TA0008',
    name: 'Lateral Movement',
    shortName: 'Lateral',
    techniques: [
      { id: 'T1021', name: 'Remote Services', tacticId: 'TA0008', description: 'SMB, RDP, WinRM, or SSH hops across internal workstations.', detectionTip: 'Port 445 / 3389 inbound connections between unprivileged workstations.' },
      { id: 'T1550', name: 'Use Alternate Auth Material', tacticId: 'TA0008', description: 'Pass-the-Hash, Pass-the-Ticket (Kerberos), or Golden Ticket.', detectionTip: 'Defender for Identity anomalous Kerberos ticket requests.' }
    ]
  },
  {
    id: 'TA0011',
    name: 'Command and Control',
    shortName: 'C2',
    techniques: [
      { id: 'T1071', name: 'Application Layer Protocol', tacticId: 'TA0011', description: 'C2 beaconing over HTTPS/DNS using Cobalt Strike or Mythic.', detectionTip: 'Threat Intel reputation lookups on egress IPs and JA3 TLS fingerprints.' },
      { id: 'T1573', name: 'Encrypted Channel', tacticId: 'TA0011', description: 'Symmetric or asymmetric encryption masking C2 payloads.', detectionTip: 'Periodic beacon timing analysis via Sentinel KQL.' }
    ]
  },
  {
    id: 'TA0010',
    name: 'Exfiltration',
    shortName: 'Exfiltration',
    techniques: [
      { id: 'T1041', name: 'Exfiltration Over C2 Channel', tacticId: 'TA0010', description: 'Stealing corporate data via established beacon connection.', detectionTip: 'Abnormal outbound network egress byte spikes in Netflow/Firewall.' },
      { id: 'T1567', name: 'Exfiltration Over Web Service', tacticId: 'TA0010', description: 'Uploading sensitive data to Mega, Dropbox, or OneDrive.', detectionTip: 'Microsoft Defender for Cloud Apps shadow IT egress policies.' }
    ]
  },
  {
    id: 'TA0040',
    name: 'Impact',
    shortName: 'Impact',
    techniques: [
      { id: 'T1486', name: 'Data Encrypted for Impact', tacticId: 'TA0040', description: 'Ransomware encrypting filesystem files and dropping ransom notes.', detectionTip: 'Rapid volume file rename / extension change alerts in Defender.' },
      { id: 'T1489', name: 'Service Stop', tacticId: 'TA0040', description: 'Stopping critical SQL, Exchange, or backup services.', detectionTip: 'net stop / sc stop commands detected in endpoint telemetry.' }
    ]
  }
];

export const MitreMatrixModal: React.FC<MitreMatrixModalProps> = ({
  isOpen,
  onClose,
  incidents,
  onSelectIncident,
  onRunPlaybook
}) => {
  const [selectedTechnique, setSelectedTechnique] = useState<MitreTechnique | null>(null);

  // Map each technique to matched incidents
  const techniqueMatches = useMemo(() => {
    const map = new Map<string, UnifiedIncident[]>();

    TACTICS.forEach(tactic => {
      tactic.techniques.forEach(tech => {
        const matches = incidents.filter(inc => {
          const mitreStr = inc.mitreTechniques?.map(m => `${m.tactic} ${m.techniqueId} ${m.techniqueName}`).join(' ') || '';
          const alertsStr = inc.alerts?.map(a => `${a.title} ${a.description}`).join(' ') || '';
          const haystack = `${inc.title} ${inc.description} ${mitreStr} ${alertsStr} ${inc.classification || ''} ${inc.determination || ''}`.toLowerCase();
          const techId = tech.id.toLowerCase();
          const techName = tech.name.toLowerCase();

          if (haystack.includes(techId) || haystack.includes(techName)) return true;

          // Heuristic semantic mappings
          if (tech.id === 'T1003' && (haystack.includes('mimikatz') || haystack.includes('credential') || haystack.includes('lsass'))) return true;
          if (tech.id === 'T1566' && (haystack.includes('phish') || haystack.includes('email') || haystack.includes('spoof'))) return true;
          if (tech.id === 'T1071' && (haystack.includes('c2') || haystack.includes('cobalt') || haystack.includes('beacon'))) return true;
          if (tech.id === 'T1078' && (haystack.includes('risky') || haystack.includes('impossible travel') || haystack.includes('sign-in'))) return true;
          if (tech.id === 'T1486' && (haystack.includes('ransom') || haystack.includes('encrypt'))) return true;
          if (tech.id === 'T1059' && (haystack.includes('powershell') || haystack.includes('cmd') || haystack.includes('script'))) return true;
          if (tech.id === 'T1021' && (haystack.includes('lateral') || haystack.includes('rdp') || haystack.includes('smb'))) return true;
          if (tech.id === 'T1041' && (haystack.includes('exfiltrat') || haystack.includes('egress'))) return true;

          return false;
        });

        if (matches.length > 0) {
          map.set(tech.id, matches);
        }
      });
    });

    return map;
  }, [incidents]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-7xl bg-slate-900/95 border border-purple-500/30 rounded-2xl shadow-[0_0_50px_rgba(168,85,247,0.15)] flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Crosshair className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-wide text-white">MITRE ATT&CK® Enterprise Heatmap</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {techniqueMatches.size} Active Techniques Detected
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Interactive matrix mapping active incidents across 12 enterprise attack tactics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Matrix Viewport */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-6">
          <div className="grid grid-flow-col auto-cols-[200px] gap-3 min-w-max pb-4">
            {TACTICS.map(tactic => {
              return (
                <div key={tactic.id} className="flex flex-col gap-2">
                  {/* Tactic Column Header */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                    <span className="text-[10px] font-mono text-purple-400 block">{tactic.id}</span>
                    <h3 className="text-xs font-bold text-white truncate" title={tactic.name}>
                      {tactic.name}
                    </h3>
                  </div>

                  {/* Techniques in this Tactic */}
                  <div className="space-y-2">
                    {tactic.techniques.map(tech => {
                      const matchedIncidents = techniqueMatches.get(tech.id) || [];
                      const isObserved = matchedIncidents.length > 0;
                      const hasCritical = matchedIncidents.some(i => i.severity === 'CRITICAL');
                      const isSelected = selectedTechnique?.id === tech.id;

                      return (
                        <button
                          key={tech.id}
                          onClick={() => {
                            setSelectedTechnique(tech);
                            audioService.playInfoChime();
                          }}
                          className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-purple-950/50 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)] ring-1 ring-purple-400'
                              : isObserved
                              ? hasCritical
                                ? 'bg-red-950/30 border-red-500/50 hover:border-red-400 hover:bg-red-900/30 shadow-[0_0_10px_rgba(239,68,68,0.15)]'
                                : 'bg-amber-950/30 border-amber-500/50 hover:border-amber-400 hover:bg-amber-900/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                              : 'bg-slate-950/30 border-slate-800/60 hover:border-slate-700 hover:bg-slate-900/30 opacity-70'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-mono text-slate-400">{tech.id}</span>
                            {isObserved && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                                  hasCritical
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                }`}
                              >
                                {matchedIncidents.length} alert{matchedIncidents.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-slate-200 leading-snug line-clamp-2">
                            {tech.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Drill-down Detail Panel */}
          {selectedTechnique && (
            <div className="mt-6 p-5 rounded-2xl bg-slate-950 border border-purple-500/40 shadow-2xl space-y-4 animate-fadeIn">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      {selectedTechnique.id}
                    </span>
                    <h3 className="text-base font-bold text-white">{selectedTechnique.name}</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{selectedTechnique.description}</p>
                </div>
                <button
                  onClick={() => setSelectedTechnique(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Guidance & Detection Tip */}
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-900/40 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                <div className="text-xs text-purple-200">
                  <strong className="text-purple-300">Detection & Containment Tip: </strong>
                  {selectedTechnique.detectionTip}
                </div>
              </div>

              {/* Matched Incidents List */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Correlated Active Incidents ({techniqueMatches.get(selectedTechnique.id)?.length || 0})
                </h4>
                {techniqueMatches.get(selectedTechnique.id)?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {techniqueMatches.get(selectedTechnique.id)!.map(inc => (
                      <div
                        key={inc.id}
                        className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-all"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              {inc.id}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                inc.severity === 'CRITICAL'
                                  ? 'bg-red-500/20 text-red-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {inc.severity}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-white truncate mt-1">{inc.title}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          {onRunPlaybook && (
                            <button
                              onClick={() => {
                                onRunPlaybook(inc);
                                onClose();
                              }}
                              className="px-2.5 py-1 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <Play className="w-3 h-3 fill-current" /> Playbook
                            </button>
                          )}
                          {onSelectIncident && (
                            <button
                              onClick={() => {
                                onSelectIncident(inc);
                                onClose();
                              }}
                              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                              title="Inspect Incident"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                    No active incidents currently map to this technique.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" /> Critical Severity
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" /> High / Medium Severity
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" /> Monitored Baseline
            </span>
          </div>

          <a
            href="https://attack.mitre.org/matrices/enterprise/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
          >
            MITRE ATT&CK® v14 Official Framework <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
