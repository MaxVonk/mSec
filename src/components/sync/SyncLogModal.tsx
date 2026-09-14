import React, { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Cloud, 
  Shield, 
  Mail, 
  Zap, 
  Trash2, 
  Download, 
  ChevronDown, 
  ChevronRight, 
  Copy, 
  Check, 
  Filter,
  Layers
} from 'lucide-react';
import { SyncLogEntry, SyncLogStats, SyncSource, SyncStatus, SyncTrigger } from '../../types';

interface SyncLogModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  inline?: boolean;
  onSyncComplete?: () => void;
}

export const SyncLogModal: React.FC<SyncLogModalProps> = ({
  isOpen = true,
  onClose,
  inline = false,
  onSyncComplete
}) => {
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [stats, setStats] = useState<SyncLogStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filterSource, setFilterSource] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterTrigger, setFilterTrigger] = useState<string>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSource !== 'ALL') params.append('source', filterSource);
      if (filterStatus !== 'ALL') params.append('status', filterStatus);
      if (filterTrigger !== 'ALL') params.append('trigger', filterTrigger);

      const res = await fetch(`/api/sync/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error('Failed to load sync logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen || inline) {
      fetchLogs();
    }
  }, [isOpen, inline, filterSource, filterStatus, filterTrigger]);

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/sync/all', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({
          type: 'success',
          text: `Sync complete! Total imported: ${data.totalImported} items.`
        });
        await fetchLogs();
        if (onSyncComplete) onSyncComplete();
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to sync connectors.'
        });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: `Sync request error: ${e.message}` });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Clear all synchronization history logs?')) return;
    try {
      await fetch('/api/sync/clear', { method: 'POST' });
      setLogs([]);
      if (stats) {
        setStats({
          totalRuns: 0,
          successCount: 0,
          errorCount: 0,
          totalImported: 0,
          lastSync: undefined
        });
      }
      setStatusMessage({ type: 'success', text: 'Synchronization logs cleared.' });
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: `Failed to clear logs: ${e.message}` });
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `msec-sync-logs-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyDetails = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
    const now = Date.now();
    const diffSec = Math.floor((now - date.getTime()) / 1000);

    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSourceIcon = (source: SyncSource) => {
    switch (source) {
      case 'SENTINEL':
        return <Cloud className="w-3.5 h-3.5 text-cyan-400" />;
      case 'GRAPH_DEFENDER':
        return <Shield className="w-3.5 h-3.5 text-indigo-400" />;
      case 'PHISHPILOT_MAILBOX':
        return <Mail className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  if (!isOpen && !inline) return null;

  const content = (
    <div className={`space-y-4 ${inline ? '' : 'text-slate-100 font-sans'}`}>
      {/* Top Header & Stat Cards */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-tight">Synchronization & Connector History</h2>
            <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px] font-mono">
              Audit Trail
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time execution log of automated cron schedulers, manual on-demand syncs, and API connector events.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-cyan-500/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Zap className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : 'text-amber-300'}`} />
            <span>{isSyncingAll ? 'Syncing All Sources...' : 'Sync All Feeds Now'}</span>
          </button>

          <button
            onClick={fetchLogs}
            disabled={isLoading}
            title="Refresh Logs"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {logs.length > 0 && (
            <button
              onClick={handleExportJson}
              title="Export Log as JSON"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          {logs.length > 0 && (
            <button
              onClick={handleClearLogs}
              title="Clear All Logs"
              className="p-1.5 bg-rose-950/40 hover:bg-rose-950/70 border border-rose-900/60 rounded-lg text-rose-300 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {!inline && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Notification Banner */}
      {statusMessage && (
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 animate-in fade-in ${
          statusMessage.type === 'success'
            ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-300'
            : 'bg-rose-950/30 border-rose-800/80 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
          <div className="text-[11px] font-medium text-slate-400">Total Sync Runs</div>
          <div className="text-xl font-black text-white font-mono mt-0.5">{stats?.totalRuns || logs.length}</div>
        </div>
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
          <div className="text-[11px] font-medium text-slate-400">Successful</div>
          <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">{stats?.successCount || 0}</div>
        </div>
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
          <div className="text-[11px] font-medium text-slate-400">Failed / Errors</div>
          <div className={`text-xl font-black font-mono mt-0.5 ${(stats?.errorCount || 0) > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
            {stats?.errorCount || 0}
          </div>
        </div>
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
          <div className="text-[11px] font-medium text-slate-400">Items Ingested</div>
          <div className="text-xl font-black text-cyan-400 font-mono mt-0.5">+{stats?.totalImported || 0}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400 font-medium">Connector:</span>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Sources</option>
              <option value="SENTINEL" className="bg-slate-900">Microsoft Sentinel</option>
              <option value="GRAPH_DEFENDER" className="bg-slate-900">M365 Defender (Graph)</option>
              <option value="PHISHPILOT_MAILBOX" className="bg-slate-900">PhishPilot Mailbox</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-slate-400 font-medium">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Statuses</option>
              <option value="SUCCESS" className="bg-slate-900">Success</option>
              <option value="ERROR" className="bg-slate-900">Error</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-slate-400 font-medium">Trigger:</span>
            <select
              value={filterTrigger}
              onChange={(e) => setFilterTrigger(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Triggers</option>
              <option value="SCHEDULED" className="bg-slate-900">⚡ Scheduled Cron</option>
              <option value="MANUAL" className="bg-slate-900">👤 Manual Trigger</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          Showing {logs.length} entries
        </div>
      </div>

      {/* Log Entries Table / List */}
      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
        {logs.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3">
            <Activity className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">No synchronization events recorded yet.</p>
            <button
              onClick={handleSyncAll}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              Trigger First Sync Now
            </button>
          </div>
        ) : (
          logs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            return (
              <div
                key={log.id}
                className="bg-slate-900/70 hover:bg-slate-900 border border-slate-800/90 rounded-xl transition-all p-3 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {/* Left: Source, Trigger, Status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-[11px]">
                      {getSourceIcon(log.source)}
                      <span>{log.sourceLabel}</span>
                    </span>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                      log.status === 'SUCCESS'
                        ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80'
                        : 'bg-rose-950/60 text-rose-400 border-rose-800/80'
                    }`}>
                      {log.status}
                    </span>

                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-750">
                      {log.trigger === 'SCHEDULED' ? '⚡ Cron' : '👤 Manual'}
                    </span>

                    {log.importedCount > 0 ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800">
                        +{log.importedCount} ingested
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-mono">0 new</span>
                    )}

                    <span className="text-[11px] text-slate-500 font-mono">
                      {log.durationMs}ms
                    </span>
                  </div>

                  {/* Right: Timestamp & Expand */}
                  <div className="flex items-center gap-2">
                    <span 
                      title={new Date(log.timestamp).toLocaleString()}
                      className="text-[11px] text-slate-400 font-mono flex items-center gap-1"
                    >
                      <Clock className="w-3 h-3 text-slate-500" />
                      {formatRelativeTime(log.timestamp)}
                    </span>

                    {(log.details || log.errors?.length) && (
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                        title={isExpanded ? 'Collapse details' : 'Expand details'}
                      >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Main Message */}
                <div className="text-slate-300 text-[11px] pl-1 font-mono">
                  {log.message}
                </div>

                {/* Collapsible Details / Errors Drawer */}
                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-2 bg-slate-950/50 p-3 rounded-lg animate-in fade-in">
                    {log.details && (
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                          Connector Metadata
                        </span>
                        <div className="text-[11px] font-mono text-slate-300 bg-slate-900 p-2 rounded border border-slate-800">
                          {log.details}
                        </div>
                      </div>
                    )}

                    {log.errors && log.errors.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider block">
                            Error Log Trace
                          </span>
                          <button
                            onClick={() => handleCopyDetails(log.id, log.errors!.join('\n'))}
                            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                          >
                            {copiedId === log.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedId === log.id ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <div className="text-[11px] font-mono text-rose-300 bg-rose-950/20 p-2 rounded border border-rose-900/40 whitespace-pre-wrap break-all">
                          {log.errors.join('\n')}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div 
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto pr-1">
          {content}
        </div>
      </div>
    </div>
  );
};
