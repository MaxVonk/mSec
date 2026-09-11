import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, 
  Laptop, 
  Globe, 
  FileCode, 
  Shield, 
  Search, 
  ArrowRight, 
  ExternalLink,
  Layers,
  LayoutGrid
} from 'lucide-react';
import { UnifiedIncident } from '../types';
import { InvestigationGraph } from './graph/InvestigationGraph';
import { buildCrossIncidentCorrelationGraph } from '../utils/graphBuilder';

interface EntityItem {
  type: string;
  value: string;
  incidentCount: number;
  incidents: string[];
}

interface EntityExplorerProps {
  onSelectIncidentById: (id: string) => void;
  incidents: UnifiedIncident[];
}

export const EntityExplorer: React.FC<EntityExplorerProps> = ({ onSelectIncidentById, incidents }) => {
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<'graph' | 'cards'>('graph');

  useEffect(() => {
    fetch('/api/entities')
      .then(res => res.json())
      .then(data => setEntities(data))
      .catch(err => console.error('Failed to load entities:', err));
  }, [incidents]);

  const filtered = useMemo(() => {
    return entities.filter(e => {
      if (filterType !== 'ALL' && e.type !== filterType) return false;
      if (search && !e.value.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [entities, filterType, search]);

  const correlationGraphData = useMemo(() => {
    return buildCrossIncidentCorrelationGraph(incidents, filtered);
  }, [incidents, filtered]);

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'USER':
        return <User className="w-4 h-4 text-cyan-400" />;
      case 'HOST':
        return <Laptop className="w-4 h-4 text-purple-400" />;
      case 'IP':
        return <Globe className="w-4 h-4 text-amber-400" />;
      case 'FILE':
        return <FileCode className="w-4 h-4 text-emerald-400" />;
      default:
        return <Shield className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entity by name, email, hostname, or IP..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Entity Type Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['ALL', 'USER', 'HOST', 'IP', 'FILE'].map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                filterType === t
                  ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {t === 'ALL' ? 'All Entities' : t}
            </button>
          ))}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode('graph')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              viewMode === 'graph'
                ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Interactive Graph</span>
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Card List</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: INTERACTIVE GRAPH */}
      {viewMode === 'graph' && (
        <div>
          <InvestigationGraph
            data={correlationGraphData}
            height={580}
            onSelectIncident={onSelectIncidentById}
            title="Enterprise Threat Correlation Network"
            subtitle={`${filtered.length} entities mapped across active multi-source incidents`}
          />
        </div>
      )}

      {/* VIEW 2: CARD GRID */}
      {viewMode === 'cards' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((ent, idx) => (
            <div
              key={idx}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-slate-950 border border-slate-800">
                      {getEntityIcon(ent.type)}
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      {ent.type}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 text-[11px] font-mono font-semibold">
                    {ent.incidentCount} {ent.incidentCount === 1 ? 'incident' : 'incidents'}
                  </span>
                </div>

                <div className="font-mono text-xs font-bold text-slate-200 break-all mb-3">
                  {ent.value}
                </div>
              </div>

              <div className="space-y-1.5 border-t border-slate-800/80 pt-2.5">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Associated Incidents
                </span>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {ent.incidents.map((incId) => {
                    const inc = incidents.find(i => i.id === incId);
                    return (
                      <button
                        key={incId}
                        onClick={() => onSelectIncidentById(incId)}
                        className="w-full text-left flex items-center justify-between gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 bg-slate-950/50 hover:bg-slate-800/50 px-2 py-1 rounded transition-colors cursor-pointer group"
                      >
                        <span className="truncate max-w-[200px]">
                          {inc ? `#${inc.incidentNumber || inc.id}: ${inc.title}` : incId}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
              No security entities match the selected filter or search criteria.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
