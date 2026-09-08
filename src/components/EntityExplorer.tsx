import React, { useState, useEffect } from 'react';
import { User, Laptop, Globe, FileCode, Shield, Search, ArrowRight, ExternalLink } from 'lucide-react';
import { UnifiedIncident } from '../types';

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

  useEffect(() => {
    fetch('/api/entities')
      .then(res => res.json())
      .then(data => setEntities(data))
      .catch(err => console.error('Failed to load entities:', err));
  }, [incidents]);

  const filtered = entities.filter(e => {
    if (filterType !== 'ALL' && e.type !== filterType) return false;
    if (search && !e.value.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
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

        <div className="flex items-center gap-2">
          {['ALL', 'USER', 'HOST', 'IP', 'FILE'].map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterType === t
                  ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {t === 'ALL' ? 'All Entities' : t}
            </button>
          ))}
        </div>
      </div>

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

              <h4 className="text-xs font-semibold text-slate-100 font-mono break-all line-clamp-2">
                {ent.value}
              </h4>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Related feed IDs</span>
              <div className="flex items-center gap-1.5">
                {ent.incidents.slice(0, 2).map((incId) => (
                  <button
                    key={incId}
                    onClick={() => onSelectIncidentById(incId)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-750 text-cyan-400 transition-colors cursor-pointer"
                  >
                    {incId.substring(0, 10)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

