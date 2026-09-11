import React, { useState, useEffect } from 'react';
import { 
  UnifiedIncident, 
  IngestionStats, 
  IncidentStatus,
  UserSessionProfile 
} from './types';
import { Header } from './components/Header';
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
import { SecOpsCopilotDrawer } from './components/copilot/SecOpsCopilotDrawer';
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
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

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
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  useEffect(() => {
    fetchIncidents();
    fetchStats();
  }, [selectedSeverity, selectedProvider, selectedStatus, searchQuery]);

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
    try {
      await fetch('/api/demo/reset', { method: 'POST' });
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
    const found = incidents.find(i => i.id === id);
    if (found) {
      setSelectedIncident(found);
    } else {
      fetch(`/api/incidents/${id}`)
        .then(res => res.json())
        .then(data => setSelectedIncident(data))
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
        onOpenMitre={() => setIsMitreOpen(true)}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onOpenShiftHandover={() => setIsShiftHandoverOpen(true)}
        onOpenPlaybooks={() => {
          setPlaybookIncident(null);
          setIsPlaybooksOpen(true);
        }}
        onOpenUserManagement={() => setIsUserManagementOpen(true)}
        onOpenConnectors={() => setIsImportModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Header */}
        <Header
          onOpenImport={() => setIsImportModalOpen(true)}
          onResetDemo={handleResetDemo}
          onRefresh={() => { fetchIncidents(); fetchStats(); }}
          onOpenShiftHandover={() => setIsShiftHandoverOpen(true)}
          onOpenUserManagement={() => setIsUserManagementOpen(true)}
          onOpenWarRoom={() => setIsWarRoomOpen(true)}
          onOpenMitre={() => setIsMitreOpen(true)}
          onOpenCopilot={() => setIsCopilotOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          currentUser={currentUser}
          onLogout={handleLogout}
          isRefreshing={isRefreshing}
          totalIncidents={stats?.totalIncidents || incidents.length}
        />

        {/* Main Viewport Container */}
        <main className="max-w-7xl mx-auto px-6 py-6 flex-1 w-full space-y-6">
          {/* Metric Cards shown on Dashboard and Analytics */}
          {(activeView === 'dashboard' || activeView === 'incidents' || activeView === 'analytics') && (
            <StatsCards 
              stats={stats} 
              onViewAnalytics={() => setActiveView('analytics')} 
            />
          )}

          {/* Content Views */}
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
            />
          )}

          {activeView === 'analytics' && (
            <SocTrendCharts
              onSelectTactic={(tactic) => {
                setSearchQuery(tactic);
                setActiveView('incidents');
              }}
            />
          )}

          {activeView === 'phishpilot' && (
            <PhishPilotDashboard />
          )}

          {activeView === 'entities' && (
            <EntityExplorer
              incidents={incidents}
              onSelectIncidentById={handleSelectIncidentById}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <IncidentDetailModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onExecuteAction={handleExecuteAction}
        onUpdateStatus={handleUpdateStatus}
        onDelete={handleDeleteIncident}
        onOpenPlaybook={(inc) => {
          setPlaybookIncident(inc);
          setIsPlaybooksOpen(true);
        }}
        onOpenCopilot={(inc) => {
          setSelectedIncident(inc);
          setIsCopilotOpen(true);
        }}
      />

      <DataImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          fetchIncidents();
          fetchStats();
        }}
      />

      {isShiftHandoverOpen && (
        <ShiftHandoverModal onClose={() => setIsShiftHandoverOpen(false)} />
      )}

      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
        currentUserId={currentUser?.id}
      />

      {/* MITRE ATT&CK Enterprise Matrix */}
      <MitreMatrixModal
        isOpen={isMitreOpen}
        onClose={() => setIsMitreOpen(false)}
        incidents={incidents}
        onSelectIncident={inc => setSelectedIncident(inc)}
        onRunPlaybook={inc => {
          setPlaybookIncident(inc || null);
          setIsPlaybooksOpen(true);
        }}
      />

      {/* SOAR Automated Playbook Runner */}
      <PlaybookRunnerModal
        isOpen={isPlaybooksOpen}
        onClose={() => {
          setIsPlaybooksOpen(false);
          setPlaybookIncident(null);
        }}
        incident={playbookIncident || selectedIncident}
      />

      {/* Fullscreen SOC War Room HUD */}
      <WarRoomModal
        isOpen={isWarRoomOpen}
        onClose={() => setIsWarRoomOpen(false)}
        incidents={incidents}
        onSelectIncident={inc => setSelectedIncident(inc)}
        onRunPlaybook={inc => {
          setPlaybookIncident(inc || null);
          setIsPlaybooksOpen(true);
        }}
        onOpenShiftHandover={() => setIsShiftHandoverOpen(true)}
      />

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        incidents={incidents}
        currentUser={currentUser || undefined}
        onSelectIncident={inc => setSelectedIncident(inc)}
        onOpenMitre={() => setIsMitreOpen(true)}
        onOpenWarRoom={() => setIsWarRoomOpen(true)}
        onOpenShiftHandover={() => setIsShiftHandoverOpen(true)}
        onOpenUserManagement={() => setIsUserManagementOpen(true)}
        onOpenPlaybooks={inc => {
          setPlaybookIncident(inc || null);
          setIsPlaybooksOpen(true);
        }}
        onOpenConnectors={() => setIsImportModalOpen(true)}
        onOpenCopilot={() => setIsCopilotOpen(true)}
      />

      {/* AI SecOps Copilot Slide-over Drawer */}
      <SecOpsCopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        incident={selectedIncident}
      />
    </div>
  );
};

export default App;
