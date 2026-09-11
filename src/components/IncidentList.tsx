import React, { useState, useMemo } from 'react';
import { 
  UnifiedIncident, 
  IncidentSeverity, 
  ProviderSource, 
  IncidentStatus 
} from '../types';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  Laptop, 
  User, 
  Globe, 
  FileCode, 
  Clock, 
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Trash2,
  SquareCheck,
  Square,
  MinusSquare,
  XCircle,
  Calendar,
  ArrowUpDown
} from 'lucide-react';

interface IncidentListProps {
  incidents: UnifiedIncident[];
  selectedSeverity: string;
  setSelectedSeverity: (val: string) => void;
  selectedProvider: string;
  setSelectedProvider: (val: string) => void;
  selectedStatus: string;
  setSelectedStatus: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onSelectIncident: (inc: UnifiedIncident) => void;
  onUpdateStatus: (id: string, status: IncidentStatus) => void;
  onDeleteIncident: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onClearAll: () => void;
}

export const IncidentList: React.FC<IncidentListProps> = ({
  incidents,
  selectedSeverity,
  setSelectedSeverity,
  selectedProvider,
  setSelectedProvider,
  selectedStatus,
  setSelectedStatus,
  searchQuery,
  setSearchQuery,
  onSelectIncident,
  onUpdateStatus,
  onDeleteIncident,
  onBulkDelete,
  onClearAll
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [timeRange, setTimeRange] = useState<'ALL' | '24H' | '7D' | '30D'>('ALL');
  const [sortBy, setSortBy] = useState<'recent' | 'severity' | 'oldest' | 'entities'>('recent');

  const filteredAndSortedIncidents = useMemo(() => {
    let list = [...incidents];

    // Timeframe filtering
    if (timeRange !== 'ALL') {
      const now = Date.now();
      let windowMs = 24 * 60 * 60 * 1000;
      if (timeRange === '7D') windowMs = 7 * 24 * 60 * 60 * 1000;
      if (timeRange === '30D') windowMs = 30 * 24 * 60 * 60 * 1000;

      const cutoff = now - windowMs;
      list = list.filter(inc => {
        const timeStr = inc.createdTime || inc.lastUpdatedTime;
        if (!timeStr) return true;
        const t = new Date(timeStr).getTime();
        return !isNaN(t) && t >= cutoff;
      });
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'severity') {
        const order: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFORMATIONAL: 0 };
        const diff = (order[b.severity] ?? 0) - (order[a.severity] ?? 0);
        if (diff !== 0) return diff;
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdTime || 0).getTime() - new Date(b.createdTime || 0).getTime();
      }
      if (sortBy === 'entities') {
        return (b.entities?.length || 0) - (a.entities?.length || 0);
      }
      // Default: 'recent' (newest first)
      return new Date(b.createdTime || 0).getTime() - new Date(a.createdTime || 0).getTime();
    });

    return list;
  }, [incidents, timeRange, sortBy]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedIncidents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedIncidents.map(i => i.id)));
    }
  };

  const handleBulkDelete = () => {
    onBulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowBulkConfirm(false);
  };

  const handleClearAll = () => {
    onClearAll();
    setSelectedIds(new Set());
    setShowClearConfirm(false);
  };

  const handleDeleteSingle = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    await onDeleteIncident(id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setDeletingId(null);
  };

  const getSeverityBadge = (severity: IncidentSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-400 border-red-500/30 ring-1 ring-red-500/20';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'LOW':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-700/30 text-slate-400 border-slate-700';
    }
  };

  const getProviderBadge = (provider: ProviderSource) => {
    switch (provider) {
      case 'M365_DEFENDER':
      case 'DEFENDER_ENDPOINT':
      case 'DEFENDER_OFFICE365':
      case 'DEFENDER_IDENTITY':
        return { label: 'M365 Defender XDR', color: 'bg-indigo-950/80 text-indigo-300 border-indigo-800/80' };
      case 'SENTINEL_SIEM':
        return { label: 'Sentinel SIEM', color: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80' };
      case 'ENTRA_ID':
        return { label: 'Microsoft Entra ID', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80' };
      case 'PURVIEW_COMPLIANCE':
        return { label: 'Purview DLP', color: 'bg-purple-950/80 text-purple-300 border-purple-800/80' };
      default:
        return { label: 'Imported Security Event', color: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const allSelected = filteredAndSortedIncidents.length > 0 && selectedIds.size === filteredAndSortedIncidents.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredAndSortedIncidents.length;

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, IP, user account, host, or MITRE technique..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-medium">Severity:</span>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All</option>
              <option value="CRITICAL" className="bg-slate-900">Critical</option>
              <option value="HIGH" className="bg-slate-900">High</option>
              <option value="MEDIUM" className="bg-slate-900">Medium</option>
              <option value="LOW" className="bg-slate-900">Low</option>
              <option value="INFORMATIONAL" className="bg-slate-900">Informational</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
            <span className="text-slate-400 font-medium">Source:</span>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Sources</option>
              <option value="M365_DEFENDER" className="bg-slate-900">M365 Defender XDR</option>
              <option value="SENTINEL_SIEM" className="bg-slate-900">Sentinel SIEM</option>
              <option value="ENTRA_ID" className="bg-slate-900">Entra ID</option>
              <option value="PURVIEW_COMPLIANCE" className="bg-slate-900">Purview Compliance</option>
              <option value="GENERIC_IMPORT" className="bg-slate-900">Generic Import</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
            <span className="text-slate-400 font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Statuses</option>
              <option value="ACTIVE" className="bg-slate-900">Active</option>
              <option value="IN_PROGRESS" className="bg-slate-900">In Progress</option>
              <option value="RESOLVED" className="bg-slate-900">Resolved</option>
            </select>
          </div>

          {/* Time Range Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <Calendar className="w-3.5 h-3.5 text-cyan-400 ml-1.5 mr-0.5 shrink-0" />
            {[
              { id: 'ALL', label: 'All Time' },
              { id: '24H', label: 'Last 24h' },
              { id: '7D', label: 'Last 7d' },
              { id: '30D', label: 'Last 30d' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTimeRange(t.id as any)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  timeRange === t.id
                    ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-700/80 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400 font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="recent" className="bg-slate-900">Most Recent</option>
              <option value="severity" className="bg-slate-900">Highest Severity</option>
              <option value="oldest" className="bg-slate-900">Oldest First</option>
              <option value="entities" className="bg-slate-900">Most Entities</option>
            </select>
          </div>

          {/* Clear All Incidents */}
          {incidents.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-950/40 hover:bg-red-950/70 border border-red-900/50 hover:border-red-800 rounded-lg text-xs text-red-300 font-medium transition-colors cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Clear All Confirmation */}
      {showClearConfirm && (
        <div className="bg-red-950/30 border border-red-800/60 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-300">Clear all {incidents.length} incidents?</p>
              <p className="text-xs text-red-400/80 mt-0.5">This will permanently remove all ingested security data. This action cannot be undone.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-md shadow-red-900/30 transition-colors cursor-pointer"
            >
              Yes, Clear All
            </button>
          </div>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-cyan-950/30 border border-cyan-800/60 rounded-xl px-4 py-3 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-semibold text-cyan-300">
              {selectedIds.size} incident{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Deselect All
            </button>
            <button
              onClick={() => setShowBulkConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-md shadow-red-900/30 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      {showBulkConfirm && (
        <div className="bg-red-950/30 border border-red-800/60 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Trash2 className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-300">Delete {selectedIds.size} selected incident{selectedIds.size !== 1 ? 's' : ''}?</p>
              <p className="text-xs text-red-400/80 mt-0.5">This will permanently remove the selected records and their threat assessments.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowBulkConfirm(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-md shadow-red-900/30 transition-colors cursor-pointer"
            >
              Yes, Delete {selectedIds.size}
            </button>
          </div>
        </div>
      )}

      {/* Incidents Count + Select All */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          {filteredAndSortedIncidents.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title={allSelected ? 'Deselect all' : 'Select all'}
            >
              {allSelected ? (
                <SquareCheck className="w-4 h-4 text-cyan-400" />
              ) : someSelected ? (
                <MinusSquare className="w-4 h-4 text-cyan-400" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span className="text-[11px]">{allSelected ? 'Deselect all' : 'Select all'}</span>
            </button>
          )}
          <span>
            Showing <strong className="text-slate-200">{filteredAndSortedIncidents.length}</strong>
            {timeRange !== 'ALL' && <span className="text-cyan-400 font-medium"> ({timeRange === '24H' ? 'Last 24 Hours' : timeRange === '7D' ? 'Last 7 Days' : 'Last 30 Days'})</span>}
            {filteredAndSortedIncidents.length !== incidents.length && ` of ${incidents.length} total`}
          </span>
        </div>
        <span className="text-slate-500 font-mono text-[11px]">
          Sorted by {sortBy === 'recent' ? 'most recent' : sortBy === 'severity' ? 'highest severity' : sortBy === 'oldest' ? 'oldest first' : 'most entities'}
        </span>
      </div>

      {/* Incident Cards */}
      {filteredAndSortedIncidents.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center">
          <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">
            {timeRange !== 'ALL'
              ? `No incidents found in ${timeRange === '24H' ? 'the Last 24 Hours' : timeRange === '7D' ? 'the Last 7 Days' : 'the Last 30 Days'}`
              : 'No security incidents found'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {timeRange !== 'ALL'
              ? 'Try widening your timeframe to "Last 7d" or "All Time" to view older ingested incidents.'
              : 'Try adjusting your filters or search query, or click "Import Data" to ingest files from M365 Defender or Sentinel.'}
          </p>
          {timeRange !== 'ALL' && (
            <button
              onClick={() => setTimeRange('ALL')}
              className="mt-4 px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Reset to All Time
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAndSortedIncidents.map((incident) => {
            const providerInfo = getProviderBadge(incident.provider);
            const pendingActions = incident.threatAssessment?.containmentActions.filter(a => a.status === 'PENDING').length || 0;
            const isSelected = selectedIds.has(incident.id);
            const isDeleting = deletingId === incident.id;

            return (
              <div
                key={incident.id}
                className={`bg-slate-900 hover:bg-slate-850/80 border rounded-xl p-5 transition-all shadow-sm group ${
                  isSelected
                    ? 'border-cyan-700/80 bg-cyan-950/10'
                    : 'border-slate-800 hover:border-slate-700'
                } ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Left Column: Checkbox + Badges and Title */}
                  <div className="flex gap-3 flex-1 min-w-[280px]">
                    {/* Selection Checkbox */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelect(incident.id); }}
                      className="mt-0.5 shrink-0 cursor-pointer text-slate-500 hover:text-cyan-400 transition-colors"
                    >
                      {isSelected ? (
                        <SquareCheck className="w-4.5 h-4.5 text-cyan-400" />
                      ) : (
                        <Square className="w-4.5 h-4.5" />
                      )}
                    </button>

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getSeverityBadge(incident.severity)}`}>
                          {incident.severity}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${providerInfo.color}`}>
                          {providerInfo.label}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                          #{incident.incidentNumber || incident.id}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(incident.createdTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <h4 
                        onClick={() => onSelectIncident(incident)}
                        className="text-base font-semibold text-slate-100 group-hover:text-cyan-400 cursor-pointer transition-colors"
                      >
                        {incident.title}
                      </h4>

                      <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                        {incident.description}
                      </p>

                      {/* Entities preview chips */}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {incident.entities.slice(0, 4).map((ent) => (
                          <span
                            key={ent.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-mono"
                          >
                            {ent.type === 'USER' && <User className="w-3 h-3 text-cyan-400" />}
                            {ent.type === 'HOST' && <Laptop className="w-3 h-3 text-purple-400" />}
                            {ent.type === 'IP' && <Globe className="w-3 h-3 text-amber-400" />}
                            {ent.type === 'FILE' && <FileCode className="w-3 h-3 text-emerald-400" />}
                            <span className="truncate max-w-[180px]">{ent.value}</span>
                          </span>
                        ))}
                        {incident.entities.length > 4 && (
                          <span className="text-[11px] text-slate-500">
                            +{incident.entities.length - 4} more
                          </span>
                        )}
                      </div>

                      {/* MITRE Badges */}
                      {incident.mitreTechniques.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                          {incident.mitreTechniques.map((m, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-[10px] text-slate-400"
                            >
                              <strong className="text-slate-300">{m.techniqueId}</strong>: {m.techniqueName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Actions and Status */}
                  <div className="flex sm:flex-col items-end justify-between gap-3 self-stretch">
                    <div className="flex items-center gap-2">
                      {/* Status selector */}
                      <select
                        value={incident.status}
                        onChange={(e) => onUpdateStatus(incident.id, e.target.value as IncidentStatus)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-colors ${
                          incident.status === 'RESOLVED'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                            : incident.status === 'IN_PROGRESS'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        <option value="ACTIVE" className="bg-slate-900 text-slate-100">Active</option>
                        <option value="IN_PROGRESS" className="bg-slate-900 text-slate-100">In Progress</option>
                        <option value="RESOLVED" className="bg-slate-900 text-slate-100">Resolved</option>
                      </select>

                      {/* Delete single incident */}
                      <button
                        onClick={(e) => handleDeleteSingle(e, incident.id)}
                        title="Delete incident"
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {pendingActions > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-red-950/40 border border-red-900/50 rounded-md text-[11px] text-red-300">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                        <span>{pendingActions} containment actions</span>
                      </div>
                    )}

                    <button
                      onClick={() => onSelectIncident(incident)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg shadow-md shadow-cyan-950/50 transition-all cursor-pointer"
                      title="Open full Incident Threat Oversight"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-cyan-200" />
                      <span>Threat Oversight</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
