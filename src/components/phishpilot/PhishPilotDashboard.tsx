import React, { useState, useEffect, useMemo } from 'react';
import { PhishPilotStatsCard } from './PhishPilotStats';
import { EmailSubmitForm } from './EmailSubmitForm';
import { ReportList } from './ReportList';
import { AnalysisReport } from './AnalysisReport';
import { PhishPilotReport, PhishPilotStats, MailboxPollerConfig } from '../../phishpilotTypes';
import { RefreshCw, Mail, Settings2, CheckCircle2, AlertCircle, ExternalLink, Download, Sparkles, X } from 'lucide-react';

export const PhishPilotDashboard: React.FC = () => {
  const [stats, setStats] = useState<PhishPilotStats | null>(null);
  const [reports, setReports] = useState<PhishPilotReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<PhishPilotReport | null>(null);
  const [mailboxConfig, setMailboxConfig] = useState<MailboxPollerConfig | null>(null);
  const [isSyncingMailbox, setIsSyncingMailbox] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Modals
  const [showMailboxModal, setShowMailboxModal] = useState(false);
  const [showAddinModal, setShowAddinModal] = useState(false);

  // Mailbox form state
  const [tempMailbox, setTempMailbox] = useState('');
  const [tempInterval, setTempInterval] = useState(5);
  const [tempEnabled, setTempEnabled] = useState(false);
  const [tempAutoReply, setTempAutoReply] = useState(true);
  
  const [verdictFilter, setVerdictFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/phishpilot/stats');
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/phishpilot/reports');
      if (res.ok) {
        setReports(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    }
  };

  const fetchMailboxStatus = async () => {
    try {
      const res = await fetch('/api/phishpilot/mailbox/status');
      if (res.ok) {
        const data: MailboxPollerConfig = await res.json();
        setMailboxConfig(data);
        setTempMailbox(data.mailbox);
        setTempInterval(data.pollingIntervalMinutes);
        setTempEnabled(data.enabled);
        setTempAutoReply(data.enableAutoReply ?? true);
      }
    } catch (err) {
      console.error('Failed to fetch mailbox status:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchReports();
    fetchMailboxStatus();
  }, []);

  const handleSyncMailbox = async () => {
    setIsSyncingMailbox(true);
    setSyncFeedback(null);
    try {
      const res = await fetch('/api/phishpilot/mailbox/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok && !data.error) {
        setSyncFeedback({
          type: 'success',
          message: `Polled mailbox: ${data.processedCount} new reported email(s) analyzed.`
        });
        await fetchStats();
        await fetchReports();
        await fetchMailboxStatus();
      } else {
        setSyncFeedback({
          type: 'error',
          message: data.error || 'Failed to poll mailbox. Check Graph API credentials in Connectors.'
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Network error polling mailbox'
      });
    } finally {
      setIsSyncingMailbox(false);
      setTimeout(() => setSyncFeedback(null), 7000);
    }
  };

  const handleSaveMailboxConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/phishpilot/mailbox/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mailbox: tempMailbox,
          pollingIntervalMinutes: Number(tempInterval),
          enabled: tempEnabled,
          enableAutoReply: tempAutoReply
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setMailboxConfig(updated);
        setShowMailboxModal(false);
      }
    } catch (err) {
      console.error('Failed to save mailbox config:', err);
    }
  };

  const handleAnalysisComplete = (report: PhishPilotReport) => {
    setSelectedReport(report);
    fetchStats();
    fetchReports();
  };

  const handleDeleteReport = async (id: string) => {
    try {
      const res = await fetch(`/api/phishpilot/reports/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchStats();
        fetchReports();
        if (selectedReport?.id === id) setSelectedReport(null);
      }
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      const res = await fetch('/api/phishpilot/reports/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (res.ok) {
        fetchStats();
        fetchReports();
        if (selectedReport && ids.includes(selectedReport.id)) setSelectedReport(null);
      }
    } catch (err) {
      console.error('Failed to bulk delete reports:', err);
    }
  };

  const handleClearAll = async () => {
    try {
      const res = await fetch('/api/phishpilot/reports', { method: 'DELETE' });
      if (res.ok) {
        fetchStats();
        fetchReports();
        setSelectedReport(null);
      }
    } catch (err) {
      console.error('Failed to clear reports:', err);
    }
  };

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (verdictFilter !== 'ALL' && r.verdict !== verdictFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!r.emailSummary.subject?.toLowerCase().includes(q) && 
            !r.emailSummary.from?.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [reports, verdictFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Mailbox Sync Header Action Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800/80 text-cyan-400">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100">Automated Mailbox Polling</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                mailboxConfig?.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
              }`}>
                {mailboxConfig?.enabled ? 'Active Auto-Sync' : 'Manual / Idle'}
              </span>
              {mailboxConfig?.enableAutoReply && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Auto-Reply Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Target: <code className="text-cyan-300 font-mono">{mailboxConfig?.mailbox || 'phish@company.com'}</code>
              {mailboxConfig?.lastPollTimestamp && (
                <span className="ml-2 text-slate-500">
                  • Last poll: {new Date(mailboxConfig.lastPollTimestamp).toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Outlook Add-in Button */}
          <button
            onClick={() => setShowAddinModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-300 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/80 rounded-lg transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Outlook 365 Add-in</span>
          </button>

          <button
            onClick={() => setShowMailboxModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-850 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Configure Mailbox</span>
          </button>

          <button
            onClick={handleSyncMailbox}
            disabled={isSyncingMailbox}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-400 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/80 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMailbox ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{isSyncingMailbox ? 'Polling Mailbox...' : 'Poll Mailbox Now'}</span>
          </button>
        </div>
      </div>

      {/* Sync feedback notification */}
      {syncFeedback && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
          syncFeedback.type === 'success' 
            ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300' 
            : 'bg-red-950/30 border-red-800/60 text-red-300'
        }`}>
          {syncFeedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span className="text-xs font-medium">{syncFeedback.message}</span>
        </div>
      )}

      {/* Stats Cards */}
      <PhishPilotStatsCard stats={stats} />
      
      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <EmailSubmitForm onAnalysisComplete={handleAnalysisComplete} />
        </div>
        
        <div className="xl:col-span-2">
          <ReportList 
            reports={filteredReports}
            onSelectReport={setSelectedReport}
            onDeleteReport={handleDeleteReport}
            onBulkDelete={handleBulkDelete}
            onClearAll={handleClearAll}
            verdictFilter={verdictFilter}
            setVerdictFilter={setVerdictFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        </div>
      </div>

      {/* Detail Modal */}
      <AnalysisReport 
        report={selectedReport} 
        onClose={() => setSelectedReport(null)}
        onReportUpdated={(updatedReport) => {
          setSelectedReport(updatedReport);
          setReports(prev => prev.map(r => r.id === updatedReport.id ? updatedReport : r));
          fetchStats();
        }}
      />

      {/* Outlook 365 Add-in Modal */}
      {showAddinModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Microsoft Outlook 365 Web & Desktop Add-in
              </h3>
              <button 
                onClick={() => setShowAddinModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Empower your employees to report suspicious emails with 1 click directly inside Microsoft Outlook (Web, Desktop, and Mac) and receive instant multi-engine verdicts.
            </p>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-200">Office.js Manifest File</div>
                  <div className="text-[11px] text-slate-500 font-mono">manifest.xml (v1.0.0)</div>
                </div>
                <a
                  href="/outlook/manifest.xml"
                  download="phishpilot-outlook-manifest.xml"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download XML</span>
                </a>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Side-Loading Instructions</h4>
              <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1.5 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <li>Download the <strong className="text-purple-300">manifest.xml</strong> file above.</li>
                <li>In <strong>Outlook on the web</strong>, open any email and click the <strong>&quot;...&quot;</strong> (More actions) menu &rarr; <strong>Get Add-ins</strong>.</li>
                <li>Select <strong>My add-ins</strong> &rarr; <strong>Add a custom add-in</strong> &rarr; <strong>Add from file</strong>.</li>
                <li>Select your downloaded manifest. The <strong>&quot;Report Phish (PhishPilot)&quot;</strong> button is now installed!</li>
              </ol>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddinModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-850 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mailbox Poller Config Modal */}
      {showMailboxModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Mail className="w-5 h-5 text-cyan-400" />
              Graph Mailbox Ingestion Settings
            </h3>
            <p className="text-xs text-slate-400">
              Configure the shared inbox monitored by PhishPilot. Ensure the Graph app registration has <code className="text-cyan-300 font-mono">Mail.ReadWrite</code> permissions.
            </p>

            <form onSubmit={handleSaveMailboxConfig} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Mailbox Address</label>
                <input
                  type="email"
                  value={tempMailbox}
                  onChange={(e) => setTempMailbox(e.target.value)}
                  placeholder="phish@yourcompany.com"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Polling Interval (Minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={tempInterval}
                  onChange={(e) => setTempInterval(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enablePoll"
                    checked={tempEnabled}
                    onChange={(e) => setTempEnabled(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                  />
                  <label htmlFor="enablePoll" className="text-xs text-slate-300 font-medium cursor-pointer">
                    Enable automatic background polling
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enableAutoReply"
                    checked={tempAutoReply}
                    onChange={(e) => setTempAutoReply(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                  />
                  <label htmlFor="enableAutoReply" className="text-xs text-slate-300 font-medium cursor-pointer">
                    Educational coaching loop: Dispatch automated reply to reporting user
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMailboxModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
