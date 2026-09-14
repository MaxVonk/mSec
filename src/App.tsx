import React, { useState, useEffect } from 'react';
import { 
  UnifiedIncident, 
  IngestionStats, 
  IncidentStatus,
  UserSessionProfile 
} from './types';
import { StatsCards } from './components/StatsCards';
import { IncidentList } from './components/IncidentList';
import { IncidentDetailModal } from './components/IncidentDetailModal';
import { DataImportModal } from './components/DataImportModal';
import { EntityExplorer } from './components/EntityExplorer';
import { PhishPilotDashboard } from './components/phishpilot/PhishPilotDashboard';
import { SocTrendCharts } from './components/analytics/SocTrendCharts';
import { ShiftHandoverModal } from './components/reporting/ShiftHandoverModal';
import { LoginPage } from './components/auth/LoginPage';
import { UserManagementModal } from './components/auth/UserManagementModal';
import { MitreMatrixModal } from './components/mitre/MitreMatrixModal';
import { PlaybookRunnerModal } from './components/soar/PlaybookRunnerModal';
import { WarRoomModal } from './components/warroom/WarRoomModal';
import { CommandPaletteModal } from './components/command/CommandPaletteModal';
import { SyncLogModal } from './components/sync/SyncLogModal';
import { Sidebar, MainNavView } from './components/navigation/Sidebar';
import { 
  Users, 
  Settings, 
  Activity, 
  Shield, 
  TrendingUp
} from 'lucide-react';

export const App: React.FC = () => {
  // Auth state
  const [currentUser, setCurrentUser] = useState<UserSessionProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);

  const [incidents, setIncidents] = useState<UnifiedIncident[]>([]);
  const [stats, setStats] = useState<IngestionStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeView, setActiveView] = useState<MainNavView>('incidents');

  // Filtering states
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedProvider, setSelectedProvider] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [selectedIncident, setSelectedIncident] = useState<UnifiedIncident | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isShiftHandoverOpen, setIsShiftHandoverOpen] = useState(false);
  const [isMitreOpen, setIsMitreOpen] = useState(false);
  const [isPlaybooksOpen, setIsPlaybooksOpen] = useState(false);
  const [playbookIncident, setPlaybookIncident] = useState<UnifiedIncident | null>(null);
  const [isWarRoomOpen, setIsWarRoomOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSyncLogOpen, setIsSyncLogOpen] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(new Date());
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('msec_auto_refresh_interval');
      return saved !== null ? parseInt(saved, 10) : 30;
    } catch {
      return 30;
    }
  });

  const handleSetAutoRefreshInterval = (interval: number) => {
    setAutoRefreshInterval(interval);
    try {
      localStorage.setItem('msec_auto_refresh_interval', interval.toString());
    } catch {}
  };

  // Global Ctrl + K / Cmd + K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data: UserSessionProfile = await res.json();
        setCurrentUser(data);
      }
    } catch {
      // Ignore
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const fetchIncidents = async () => {
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (selectedSeverity !== 'ALL') params.append('severity', selectedSeverity);
      if (selectedProvider !== 'ALL') params.append('provider', selectedProvider);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/incidents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setIncidents(data);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  useEffect(() => {
    fetchIncidents();
    fetchStats();
  }, [selectedSeverity, selectedProvider, selectedStatus, searchQuery]);

  // Automated background polling timer
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const intervalMs = autoRefreshInterval * 1000;
    const timer = setInterval(() => {
      fetchIncidents();
      fetchStats();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, selectedSeverity, selectedProvider, selectedStatus, searchQuery]);

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      const res = await fetch('/api/sync/all', { method: 'POST' });
      if (res.ok) {
        await Promise.all([fetchIncidents(), fetchStats()]);
      }
    } catch (err) {
      console.error('Sync all error:', err);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: IncidentStatus) => {
    try {
      const res = await fetch(`/api/incidents/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const updated = await res.json();
        setIncidents(prev => prev.map(i => i.id === id ? updated : i));
        if (selectedIncident && selectedIncident.id === id) {
          setSelectedIncident(updated);
        }
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleExecuteAction = async (incidentId: string, actionId: string) => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}/actions/${actionId}/execute`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.incident) {
          setIncidents(prev => prev.map(i => i.id === incidentId ? data.incident : i));
          setSelectedIncident(data.incident);
        }
      }
    } catch (err) {
      console.error('Failed to execute containment action:', err);
    }
  };

  const handleResetDemo = async () => {
    if (stats?.demoMode === false) {
      alert('Demo mode is disabled in production environment.');
      return;
    }
    if (!window.confirm('Reset dataset to demo sample incidents? Any live data will be replaced with demo incidents.')) {
      return;
    }
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Failed to reset demo dataset');
        return;
      }
      await fetchIncidents();
      await fetchStats();
    } catch (err) {
      console.error('Failed to reset demo data:', err);
    }
  };

  const handleDeleteIncident = async (id: string) => {
    try {
      const res = await fetch(`/api/incidents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setIncidents(prev => prev.filter(i => i.id !== id));
        if (selectedIncident?.id === id) {
          setSelectedIncident(null);
        }
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to delete incident:', err);
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const res = await fetch('/api/incidents/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (res.ok) {
        const idSet = new Set(ids);
        setIncidents(prev => prev.filter(i => !idSet.has(i.id)));
        if (selectedIncident && idSet.has(selectedIncident.id)) {
          setSelectedIncident(null);
        }
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to bulk delete incidents:', err);
    }
  };

  const handleClearAll = async () => {
    try {
      const res = await fetch('/api/incidents', { method: 'DELETE' });
      if (res.ok) {
        setIncidents([]);
        setSelectedIncident(null);
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to clear all incidents:', err);
    }
  };

  const handleSelectIncidentById = (id: string) => {
    if (!id) return;
    const cleanId = id.startsWith('inc-') ? id.slice(4) : id;
    const found = incidents.find(
      i => i.id === id || i.id === cleanId || `inc-${i.id}` === id || String(i.incidentNumber) === id || String(i.incidentNumber) === cleanId
    );
    if (found) {
      setSelectedIncident(found);
    } else {
      fetch(`/api/incidents/${encodeURIComponent(cleanId)}`)
        .then(res => res.ok ? res.json() : fetch(`/api/incidents/${encodeURIComponent(id)}`).then(r => r.ok ? r.json() : null))
        .then(data => {
          if (data && data.id) setSelectedIncident(data);
        })
        .catch(err => console.error('Could not fetch incident:', err));
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3 select-none">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
        <span className="text-xs font-mono tracking-wider text-slate-400">Verifying Security Session...</span>
      </div>
    );
  }

  if (!currentUser?.isAuthenticated) {
    return (
      <LoginPage 
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          fetchIncidents();
          fetchStats();
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans selection:bg-cyan-500 selection:text-white">
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        incidentCount={incidents.length}
        currentUser={currentUser}
        onOpenWarRoom={() => setIsWarRoomOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onRefresh={() => { fetchIncidents(); fetchStats(); }}
        isRefreshing={isRefreshing}
        onResetDemo={handleResetDemo}
        onLogout={handleLogout}
        demoMode={stats?.demoMode}
        onOpenSyncLog={() => setIsSyncLogOpen(true)}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Main Viewport Container */}
        <main className="max-w-7xl mx-auto px-6 py-6 flex-1 w-full space-y-6">
          {/* Metric Cards shown on Dashboard, Incidents, and Analytics */}
          {(activeView === 'dashboard' || activeView === 'incidents' || activeView === 'analytics') && (
            <StatsCards 
              stats={stats} 
              onViewAnalytics={() => setActiveView('analytics')} 
            />
          )}

          {/* View: Dashboard / Incidents */}
          {(activeView === 'dashboard' || activeView === 'incidents') && (
            <IncidentList
              incidents={incidents}
              selectedSeverity={selectedSeverity}
              setSelectedSeverity={setSelectedSeverity}
              selectedProvider={selectedProvider}
              setSelectedProvider={setSelectedProvider}
              selectedStatus={selectedStatus}
              setSelectedStatus={setSelectedStatus}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSelectIncident={(inc) => setSelectedIncident(inc)}
              onUpdateStatus={handleUpdateStatus}
              onDeleteIncident={handleDeleteIncident}
              onBulkDelete={handleBulkDelete}
              onClearAll={handleClearAll}
              onRefresh={() => { fetchIncidents(); fetchStats(); }}
              isRefreshing={isRefreshing}
              onOpenSyncLog={() => setIsSyncLogOpen(true)}
              lastRefreshed={lastRefreshed}
              autoRefreshInterval={autoRefreshInterval}
              setAutoRefreshInterval={handleSetAutoRefreshInterval}
              onSyncAll={handleSyncAll}
              isSyncingAll={isSyncingAll}
            />
          )}

          {/* View: Threat Insights / Analytics */}
          {activeView === 'analytics' && (
            <SocTrendCharts
              onSelectTactic={(tactic) => {
                setSearchQuery(tactic);
                setActiveView('incidents');
              }}
            />
          )}

          {/* View: Threat Notices / PhishPilot */}
          {activeView === 'phishpilot' && (
            <PhishPilotDashboard />
          )}

          {/* View: Assets & Entities */}
          {activeView === 'entities' && (
            <EntityExplorer
              incidents={incidents}
              onSelectIncidentById={handleSelectIncidentById}
            />
          )}

          {/* View: Ransomware Insights / MITRE ATT&CK Matrix (Full Page) */}
          {activeView === 'mitre' && (
            <MitreMatrixModal
              inline={true}
              incidents={incidents}
              onSelectIncident={inc => setSelectedIncident(inc)}
              onRunPlaybook={inc => {
                setPlaybookIncident(inc || null);
                setActiveView('playbooks');
              }}
            />
          )}

          {/* View: Automations & Playbooks (Full Page) */}
          {activeView === 'playbooks' && (
            <PlaybookRunnerModal
              inline={true}
              incident={playbookIncident || selectedIncident}
              incidents={incidents}
            />
          )}

          {/* View: Operational Reports (Full Page) */}
          {activeView === 'reports' && (
            <ShiftHandoverModal
              inline={true}
            />
          )}

          {/* View: Settings & Connectors (Full Page) */}
          {activeView === 'settings' && (
            <DataImportModal
              inline={true}
              onImportSuccess={() => {
                fetchIncidents();
                fetchStats();
              }}
            />
          )}

          {/* View: Tenant Members (Full Page - Admin Only) */}
          {activeView === 'users' && currentUser?.role === 'ADMIN' && (
            <UserManagementModal
              inline={true}
              currentUserId={currentUser?.id}
            />
          )}
        </main>
      </div>

      {/* Incident Detail Drawer */}
      <IncidentDetailModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onExecuteAction={handleExecuteAction}
        onUpdateStatus={handleUpdateStatus}
        onDelete={handleDeleteIncident}
        onOpenPlaybook={(inc) => {
          setPlaybookIncident(inc);
          setActiveView('playbooks');
        }}
      />

      {/* Popups triggered contextually when not on the dedicated page */}
      {isSyncLogOpen && (
        <SyncLogModal
          isOpen={isSyncLogOpen}
          onClose={() => setIsSyncLogOpen(false)}
          onSyncComplete={() => {
            fetchIncidents();
            fetchStats();
          }}
        />
      )}

      {isImportModalOpen && activeView !== 'settings' && (
        <DataImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportSuccess={() => {
            fetchIncidents();
            fetchStats();
          }}
        />
      )}

      {isShiftHandoverOpen && activeView !== 'reports' && (
        <ShiftHandoverModal onClose={() => setIsShiftHandoverOpen(false)} />
      )}

      {isUserManagementOpen && activeView !== 'users' && (
        <UserManagementModal
          isOpen={isUserManagementOpen}
          onClose={() => setIsUserManagementOpen(false)}
          currentUserId={currentUser?.id}
        />
      )}

      {isMitreOpen && activeView !== 'mitre' && (
        <MitreMatrixModal
          isOpen={isMitreOpen}
          onClose={() => setIsMitreOpen(false)}
          incidents={incidents}
          onSelectIncident={inc => setSelectedIncident(inc)}
          onRunPlaybook={inc => {
            setPlaybookIncident(inc || null);
            setActiveView('playbooks');
          }}
        />
      )}

      {isPlaybooksOpen && activeView !== 'playbooks' && (
        <PlaybookRunnerModal
          isOpen={isPlaybooksOpen}
          onClose={() => {
            setIsPlaybooksOpen(false);
            setPlaybookIncident(null);
          }}
          incident={playbookIncident || selectedIncident}
          incidents={incidents}
        />
      )}

      {/* Fullscreen SOC War Room HUD */}
      <WarRoomModal
        isOpen={isWarRoomOpen}
        onClose={() => setIsWarRoomOpen(false)}
        incidents={incidents}
        onSelectIncident={inc => setSelectedIncident(inc)}
        onRunPlaybook={inc => {
          setPlaybookIncident(inc || null);
          setActiveView('playbooks');
        }}
        onOpenShiftHandover={() => setActiveView('reports')}
      />

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        incidents={incidents}
        currentUser={currentUser || undefined}
        onSelectIncident={inc => setSelectedIncident(inc)}
        onOpenMitre={() => setActiveView('mitre')}
        onOpenWarRoom={() => setIsWarRoomOpen(true)}
        onOpenShiftHandover={() => setActiveView('reports')}
        onOpenUserManagement={() => setActiveView('users')}
        onOpenPlaybooks={inc => {
          setPlaybookIncident(inc || null);
          setActiveView('playbooks');
        }}
        onOpenConnectors={() => setActiveView('settings')}
      />
    </div>
  );
};

export default App;
