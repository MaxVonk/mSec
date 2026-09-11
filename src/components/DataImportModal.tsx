import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  Cloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Server, 
  Key, 
  Shield, 
  FileSpreadsheet, 
  Code,
  Copy,
  Check,
  Terminal,
  Bell,
  Send,
  Zap
} from 'lucide-react';
import { ConnectorConfig, IngestionSchedulerConfig, WebhookConfig } from '../types';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'graph' | 'sentinel' | 'raw' | 'automation'>('file');
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Raw JSON state
  const [rawJsonText, setRawJsonText] = useState('');

  // Graph Connector state
  const [graphConfig, setGraphConfig] = useState({
    tenantId: '',
    clientId: '',
    clientSecret: '',
  });
  const [testingGraph, setTestingGraph] = useState(false);
  const [syncingGraph, setSyncingGraph] = useState(false);

  // Sentinel Connector state
  const [sentinelConfig, setSentinelConfig] = useState({
    tenantId: '',
    clientId: '',
    clientSecret: '',
    subscriptionId: '',
    resourceGroup: '',
    workspaceName: '',
  });
  const [testingSentinel, setTestingSentinel] = useState(false);
  const [syncingSentinel, setSyncingSentinel] = useState(false);
  const [copiedAzCmd, setCopiedAzCmd] = useState(false);

  // Scheduler state
  const [schedulerConfig, setSchedulerConfig] = useState<IngestionSchedulerConfig>({
    sentinelEnabled: false,
    sentinelIntervalMinutes: 5,
    graphEnabled: false,
    graphIntervalMinutes: 5,
    status: 'IDLE',
    totalAutoIngested: 0
  });

  // Webhook state
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
    teamsWebhookUrl: '',
    slackWebhookUrl: '',
    customWebhookUrl: '',
    enabled: false,
    minSeverity: 'HIGH',
    notifyOnPhishing: true,
    notifyOnContainmentAction: true
  });
  const [testingWebhook, setTestingWebhook] = useState<'teams' | 'slack' | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      fetch('/api/connectors')
        .then(res => res.json())
        .then((data: any) => {
          if (data?.graph) {
            setGraphConfig(prev => ({
              tenantId: data.graph.tenantId || prev.tenantId,
              clientId: data.graph.clientId || prev.clientId,
              clientSecret: data.graph.clientSecret || prev.clientSecret,
            }));
          }
          if (data?.sentinel) {
            setSentinelConfig(prev => ({
              tenantId: data.sentinel.tenantId || prev.tenantId,
              clientId: data.sentinel.clientId || prev.clientId,
              clientSecret: data.sentinel.clientSecret || prev.clientSecret,
              subscriptionId: data.sentinel.subscriptionId || prev.subscriptionId,
              resourceGroup: data.sentinel.resourceGroup || prev.resourceGroup,
              workspaceName: data.sentinel.workspaceName || prev.workspaceName,
            }));
          }
        })
        .catch(() => {});

      fetch('/api/scheduler/config')
        .then(res => res.json())
        .then(data => { if (data) setSchedulerConfig(data); })
        .catch(() => {});

      fetch('/api/webhooks/config')
        .then(res => res.json())
        .then(data => { if (data) setWebhookConfig(data); })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSaveScheduler = async () => {
    try {
      const res = await fetch('/api/scheduler/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedulerConfig)
      });
      if (res.ok) {
        const data = await res.json();
        setSchedulerConfig(data);
        setStatusMessage({ type: 'success', text: 'Automated ingestion schedule saved successfully!' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: `Failed to save scheduler: ${e.message}` });
    }
  };

  const handleSaveWebhooks = async () => {
    try {
      const res = await fetch('/api/webhooks/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookConfig)
      });
      if (res.ok) {
        const data = await res.json();
        setWebhookConfig(data);
        setStatusMessage({ type: 'success', text: 'Alert webhook integration settings saved!' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: `Failed to save webhooks: ${e.message}` });
    }
  };

  const handleTestWebhook = async (target: 'teams' | 'slack') => {
    setTestingWebhook(target);
    try {
      const url = target === 'teams' ? webhookConfig.teamsWebhookUrl : webhookConfig.slackWebhookUrl;
      const res = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, url })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: data.message });
      } else {
        setStatusMessage({ type: 'error', text: data.message });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: `Webhook test failed: ${e.message}` });
    } finally {
      setTestingWebhook(null);
    }
  };

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setStatusMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/import/file', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setStatusMessage({
        type: 'success',
        text: `Successfully ingested ${data.count} security incidents from ${data.filename}!`,
      });
      onImportSuccess();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error processing uploaded file',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleTestGraph = async () => {
    setTestingGraph(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/connectors/graph/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(graphConfig),
      });
      const data = await res.json();
      setStatusMessage({
        type: data.success ? 'success' : 'error',
        text: data.message,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setTestingGraph(false);
    }
  };

  const handleSyncGraph = async () => {
    setSyncingGraph(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/connectors/graph/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(graphConfig),
      });
      const data = await res.json();
      setStatusMessage({
        type: 'success',
        text: `Graph sync complete: ${data.importedCount} items imported.`,
      });
      onImportSuccess();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setSyncingGraph(false);
    }
  };

  const handleTestSentinel = async () => {
    setTestingSentinel(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/connectors/sentinel/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sentinelConfig),
      });
      const data = await res.json();
      setStatusMessage({
        type: data.success ? 'success' : 'error',
        text: data.message,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setTestingSentinel(false);
    }
  };

  const handleSyncSentinel = async () => {
    setSyncingSentinel(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/connectors/sentinel/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sentinelConfig),
      });
      const data = await res.json();
      setStatusMessage({
        type: 'success',
        text: `Sentinel sync complete: ${data.importedCount} incidents imported.`,
      });
      onImportSuccess();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setSyncingSentinel(false);
    }
  };

  const handleRawJsonSubmit = async () => {
    if (!rawJsonText.trim()) return;
    setIsUploading(true);
    setStatusMessage(null);
    try {
      const parsed = JSON.parse(rawJsonText);
      const res = await fetch('/api/import/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStatusMessage({
        type: 'success',
        text: `Successfully imported ${data.count} security records!`,
      });
      setRawJsonText('');
      onImportSuccess();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Invalid JSON or import error: ${err.message}` });
    } finally {
      setIsUploading(false);
    }
  };

  const loadSampleFile = async (type: 'defender' | 'sentinel_csv') => {
    setIsUploading(true);
    setStatusMessage(null);
    try {
      let samplePayload: any;
      if (type === 'defender') {
        samplePayload = [
          {
            incidentId: `INC-MDE-${Math.floor(1000 + Math.random() * 9000)}`,
            displayName: "Suspicious PowerShell Invocations and Defense Evasion",
            severity: "High",
            status: "Active",
            createdDateTime: new Date().toISOString(),
            description: "Obfuscated PowerShell script attempted to disable Windows Defender Real-time Protection on executive laptop.",
            evidence: [
              { "@odata.type": "#microsoft.graph.security.userEvidence", userAccount: { userPrincipalName: "cfo.corp@contoso.com" } },
              { "@odata.type": "#microsoft.graph.security.deviceEvidence", deviceDnsName: "CFO-SURFACE-BOOK.corp.contoso.com" },
              { "@odata.type": "#microsoft.graph.security.ipEvidence", ipAddress: "89.208.104.12" },
              { "@odata.type": "#microsoft.graph.security.fileEvidence", fileName: "calc_payload.ps1" }
            ],
            mitreTechniques: [
              { tactic: "Execution", techniqueId: "T1059.001", techniqueName: "PowerShell" },
              { tactic: "Defense Evasion", techniqueId: "T1562.001", techniqueName: "Disable or Modify Tools" }
            ],
            alerts: [
              { id: "ALT-MDE-881", title: "Set-MpPreference -DisableRealtimeMonitoring executed", severity: "High", serviceSource: "microsoftDefenderForEndpoint" }
            ]
          }
        ];
      } else {
        samplePayload = [
          {
            IncidentId: `SEC-SENTINEL-${Math.floor(100 + Math.random() * 900)}`,
            Title: "Brute Force Authentication on Azure Portal",
            Severity: "High",
            Status: "Active",
            User: "billing.admin@contoso.com",
            Host: "AzureAD-Gateway",
            IP: "195.154.60.21",
            TimeGenerated: new Date().toISOString(),
            Description: "Multiple failed logins from single IP within 3 minutes detected by Sentinel Analytics Rule."
          }
        ];
      }

      const res = await fetch('/api/import/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(samplePayload),
      });

      const data = await res.json();
      setStatusMessage({
        type: 'success',
        text: `Loaded ${data.count} sample ${type === 'defender' ? 'M365 Defender' : 'Sentinel'} incidents!`,
      });
      onImportSuccess();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Import Security Data</h2>
              <p className="text-xs text-slate-400">Ingest from files, Microsoft Graph, or Microsoft Sentinel</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/20">
          <button
            onClick={() => { setActiveTab('file'); setStatusMessage(null); }}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'file' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>File Upload (JSON / CSV)</span>
          </button>

          <button
            onClick={() => { setActiveTab('graph'); setStatusMessage(null); }}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'graph' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>M365 Defender API</span>
          </button>

          <button
            onClick={() => { setActiveTab('sentinel'); setStatusMessage(null); }}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'sentinel' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>Microsoft Sentinel</span>
          </button>

          <button
            onClick={() => { setActiveTab('raw'); setStatusMessage(null); }}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'raw' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>Raw JSON Paste</span>
          </button>

          <button
            onClick={() => { setActiveTab('automation'); setStatusMessage(null); }}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'automation' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Automated Poller & Webhooks</span>
          </button>
        </div>

        {/* Status Alert Banner */}
        {statusMessage && (
          <div className={`mx-6 mt-4 p-3.5 rounded-xl border flex items-center gap-3 text-xs ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-300'
              : 'bg-red-950/30 border-red-800/80 text-red-300'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span className="flex-1">{statusMessage.text}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
          {/* TAB 1: FILE UPLOAD */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              {/* Drag and drop zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                  dragActive
                    ? 'border-cyan-500 bg-cyan-950/20'
                    : 'border-slate-750 hover:border-slate-600 bg-slate-950/50'
                }`}
              >
                <Upload className="w-10 h-10 text-cyan-400 mx-auto mb-3 opacity-80" />
                <h3 className="text-sm font-semibold text-slate-200">
                  Drag and drop export files here
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Supports <strong>.json</strong> and <strong>.csv</strong> exports from M365 Defender, Microsoft Sentinel, and Entra ID.
                </p>

                <div className="mt-4">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg cursor-pointer border border-slate-700 transition-colors">
                    <span>Browse Local Files</span>
                    <input
                      type="file"
                      accept=".json,.csv"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Quick Load Pre-packaged Samples */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Test With Instant Pre-packaged Samples:
                </span>
                <div className="grid sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => loadSampleFile('defender')}
                    disabled={isUploading}
                    className="flex items-center justify-between p-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-left text-xs transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="font-semibold text-slate-200">M365 Defender Export</p>
                      <p className="text-[11px] text-slate-400">PowerShell & Defense Evasion incident (.json)</p>
                    </div>
                    <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                  </button>

                  <button
                    onClick={() => loadSampleFile('sentinel_csv')}
                    disabled={isUploading}
                    className="flex items-center justify-between p-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-left text-xs transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="font-semibold text-slate-200">Sentinel Analytics CSV</p>
                      <p className="text-[11px] text-slate-400">Brute Force & Role Assignment (.csv)</p>
                    </div>
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MICROSOFT GRAPH / DEFENDER API */}
          {activeTab === 'graph' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start gap-2">
                <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  Connects to Microsoft Graph Security API (`/v1.0/security/incidents` and `/alerts_v2`). Requires an Azure App Registration with `SecurityIncident.Read.All` or `SecurityAlert.Read.All`.
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Directory (Tenant) ID</label>
                  <input
                    type="text"
                    placeholder="e.g. 72f988bf-86f1-41af-91ab-2d7cd011db47"
                    value={graphConfig.tenantId}
                    onChange={(e) => setGraphConfig({ ...graphConfig, tenantId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Application (Client) ID</label>
                  <input
                    type="text"
                    placeholder="e.g. 3a7c6f01-9876-4321-abcd-ef0123456789"
                    value={graphConfig.clientId}
                    onChange={(e) => setGraphConfig({ ...graphConfig, clientId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Client Secret Value</label>
                  <input
                    type="password"
                    placeholder="••••••••••••••••••••••••"
                    value={graphConfig.clientSecret}
                    onChange={(e) => setGraphConfig({ ...graphConfig, clientSecret: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={handleTestGraph}
                  disabled={testingGraph || !graphConfig.tenantId}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {testingGraph ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  onClick={handleSyncGraph}
                  disabled={syncingGraph || !graphConfig.tenantId}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-900/30 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingGraph ? 'animate-spin' : ''}`} />
                  <span>{syncingGraph ? 'Syncing...' : 'Sync Graph Incidents'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: MICROSOFT SENTINEL */}
          {activeTab === 'sentinel' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start gap-2">
                <Cloud className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  Connects to Microsoft Sentinel via Azure Resource Manager (`Microsoft.SecurityInsights/incidents`). Requires Azure Contributor or Microsoft Sentinel Reader role on the workspace.
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Azure Subscription ID</label>
                  <input
                    type="text"
                    placeholder="e.g. 1a2b3c4d-5e6f-7a8b-..."
                    value={sentinelConfig.subscriptionId}
                    onChange={(e) => setSentinelConfig({ ...sentinelConfig, subscriptionId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Resource Group Name</label>
                  <input
                    type="text"
                    placeholder="e.g. rg-security-prod"
                    value={sentinelConfig.resourceGroup}
                    onChange={(e) => setSentinelConfig({ ...sentinelConfig, resourceGroup: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Log Analytics Workspace Name</label>
                  <input
                    type="text"
                    placeholder="e.g. law-sentinel-hub"
                    value={sentinelConfig.workspaceName}
                    onChange={(e) => setSentinelConfig({ ...sentinelConfig, workspaceName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Directory (Tenant) ID</label>
                  <input
                    type="text"
                    placeholder="e.g. 72f988bf-86f1-41af-..."
                    value={sentinelConfig.tenantId}
                    onChange={(e) => setSentinelConfig({ ...sentinelConfig, tenantId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Application (Client) ID</label>
                  <input
                    type="text"
                    placeholder="e.g. 3a7c6f01-9876-..."
                    value={sentinelConfig.clientId}
                    onChange={(e) => setSentinelConfig({ ...sentinelConfig, clientId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Client Secret</label>
                  <input
                    type="password"
                    placeholder="••••••••••••••••••••••••"
                    value={sentinelConfig.clientSecret}
                    onChange={(e) => setSentinelConfig({ ...sentinelConfig, clientSecret: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Azure RBAC Setup Helper */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">Azure RBAC Role Assignment Command</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const scope = `/subscriptions/${sentinelConfig.subscriptionId || '<subscription-id>'}/resourceGroups/${sentinelConfig.resourceGroup || '<resource-group>'}/providers/Microsoft.OperationalInsights/workspaces/${sentinelConfig.workspaceName || '<workspace-name>'}`;
                      const cmd = `az role assignment create --assignee "${sentinelConfig.clientId || '<client-id>'}" --role "Microsoft Sentinel Reader" --scope "${scope}"`;
                      navigator.clipboard.writeText(cmd);
                      setCopiedAzCmd(true);
                      setTimeout(() => setCopiedAzCmd(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded text-xs font-mono transition-colors cursor-pointer border border-slate-700"
                  >
                    {copiedAzCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                    <span>{copiedAzCmd ? 'Copied' : 'Copy Az CLI Command'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  If getting <span className="text-red-400 font-mono">403 Forbidden</span>: Azure Sentinel uses ARM RBAC on the workspace, not Entra App permissions. Run this in Azure Cloud Shell or assign <strong className="text-slate-200">Microsoft Sentinel Reader</strong> in Azure Portal under your Log Analytics Workspace &gt; Access Control (IAM).
                </p>
                <div className="p-2.5 bg-black/60 border border-slate-800/80 rounded-lg font-mono text-[11px] text-cyan-300 select-all break-all whitespace-pre-wrap">
                  az role assignment create --assignee &quot;{sentinelConfig.clientId || '<client-id>'}&quot; --role &quot;Microsoft Sentinel Reader&quot; --scope &quot;/subscriptions/{sentinelConfig.subscriptionId || '<subscription-id>'}/resourceGroups/{sentinelConfig.resourceGroup || '<resource-group>'}/providers/Microsoft.OperationalInsights/workspaces/{sentinelConfig.workspaceName || '<workspace-name>'}&quot;
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={handleTestSentinel}
                  disabled={testingSentinel || !sentinelConfig.workspaceName}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {testingSentinel ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  onClick={handleSyncSentinel}
                  disabled={syncingSentinel || !sentinelConfig.workspaceName}
                  className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-cyan-900/30 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingSentinel ? 'animate-spin' : ''}`} />
                  <span>{syncingSentinel ? 'Syncing...' : 'Sync Sentinel Incidents'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: RAW JSON PASTE */}
          {activeTab === 'raw' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Paste any raw JSON incident payload (M365 Graph, Sentinel ARM, or custom security event) to immediately normalize and store:
              </p>
              <textarea
                rows={8}
                value={rawJsonText}
                onChange={(e) => setRawJsonText(e.target.value)}
                placeholder='[ { "incidentId": "INC-123", "displayName": "Suspicious login", "severity": "high", "evidence": [...] } ]'
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 focus:border-cyan-500 focus:outline-none resize-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleRawJsonSubmit}
                  disabled={isUploading || !rawJsonText.trim()}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? 'Ingesting...' : 'Ingest JSON Payload'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: AUTOMATION & WEBHOOKS */}
          {activeTab === 'automation' && (
            <div className="space-y-6">
              {/* Automated Ingestion Poller */}
              <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Automated Background Ingestion Engine</h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                    schedulerConfig.status === 'RUNNING'
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                      : schedulerConfig.status === 'ERROR'
                      ? 'bg-rose-950/40 text-rose-400 border-rose-800/60'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {schedulerConfig.status} (Total Ingested: {schedulerConfig.totalAutoIngested || 0})
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  Configure automated cron polling to fetch newly generated alerts and incidents directly from Microsoft Sentinel and M365 Defender.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Sentinel Poller */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-xs font-semibold text-slate-200">Microsoft Sentinel</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={schedulerConfig.sentinelEnabled}
                          onChange={(e) => setSchedulerConfig(prev => ({ ...prev, sentinelEnabled: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                      </label>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">Poll Every:</span>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={schedulerConfig.sentinelIntervalMinutes}
                        onChange={(e) => setSchedulerConfig(prev => ({ ...prev, sentinelIntervalMinutes: Math.max(1, parseInt(e.target.value) || 5) }))}
                        className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-center text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                      />
                      <span className="text-slate-400">min</span>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      {sentinelConfig.workspaceName ? `Using workspace "${sentinelConfig.workspaceName}"` : 'Configure Sentinel credentials in the Sentinel tab.'}
                    </p>
                  </div>

                  {/* Defender Poller */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-xs font-semibold text-slate-200">M365 Defender (Graph)</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={schedulerConfig.graphEnabled}
                          onChange={(e) => setSchedulerConfig(prev => ({ ...prev, graphEnabled: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                      </label>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">Poll Every:</span>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={schedulerConfig.graphIntervalMinutes}
                        onChange={(e) => setSchedulerConfig(prev => ({ ...prev, graphIntervalMinutes: Math.max(1, parseInt(e.target.value) || 5) }))}
                        className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-center text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                      />
                      <span className="text-slate-400">min</span>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      {graphConfig.tenantId ? `Using Tenant "${graphConfig.tenantId.substring(0, 8)}..."` : 'Configure Defender credentials in the Defender tab.'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleSaveScheduler}
                    className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Save Scheduler Settings
                  </button>
                </div>
              </div>

              {/* Webhook Notifications */}
              <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Alert & Incident Webhook Dispatcher</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={webhookConfig.enabled}
                      onChange={(e) => setWebhookConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>

                <p className="text-xs text-slate-400">
                  Broadcast high-priority incidents, phishing analysis verdicts, and containment actions automatically into Microsoft Teams or Slack channels.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Minimum Alert Severity</label>
                    <select
                      value={webhookConfig.minSeverity}
                      onChange={(e) => setWebhookConfig(prev => ({ ...prev, minSeverity: e.target.value as any }))}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="INFORMATIONAL">INFORMATIONAL & Higher</option>
                      <option value="LOW">LOW & Higher</option>
                      <option value="MEDIUM">MEDIUM & Higher</option>
                      <option value="HIGH">HIGH & CRITICAL only</option>
                      <option value="CRITICAL">CRITICAL only</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-center space-y-1.5 pt-2">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={webhookConfig.notifyOnPhishing}
                        onChange={(e) => setWebhookConfig(prev => ({ ...prev, notifyOnPhishing: e.target.checked }))}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span>Notify on PhishPilot confirmed malicious</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={webhookConfig.notifyOnContainmentAction}
                        onChange={(e) => setWebhookConfig(prev => ({ ...prev, notifyOnContainmentAction: e.target.checked }))}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span>Notify on device isolation / user disable</span>
                    </label>
                  </div>
                </div>

                {/* Teams Webhook */}
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-semibold text-slate-300">Microsoft Teams Incoming Webhook URL</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={webhookConfig.teamsWebhookUrl || ''}
                      onChange={(e) => setWebhookConfig(prev => ({ ...prev, teamsWebhookUrl: e.target.value }))}
                      placeholder="https://outlook.office.com/webhook/..."
                      className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={() => handleTestWebhook('teams')}
                      disabled={!webhookConfig.teamsWebhookUrl || testingWebhook === 'teams'}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3 h-3" />
                      <span>{testingWebhook === 'teams' ? 'Testing...' : 'Test Teams'}</span>
                    </button>
                  </div>
                </div>

                {/* Slack Webhook */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Slack Incoming Webhook URL</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={webhookConfig.slackWebhookUrl || ''}
                      onChange={(e) => setWebhookConfig(prev => ({ ...prev, slackWebhookUrl: e.target.value }))}
                      placeholder="https://hooks.slack.com/services/..."
                      className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={() => handleTestWebhook('slack')}
                      disabled={!webhookConfig.slackWebhookUrl || testingWebhook === 'slack'}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3 h-3" />
                      <span>{testingWebhook === 'slack' ? 'Testing...' : 'Test Slack'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleSaveWebhooks}
                    className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Save Webhook Settings
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

