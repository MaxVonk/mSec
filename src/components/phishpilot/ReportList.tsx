import React, { useState } from 'react';
import { 
  ShieldAlert, ShieldCheck, ShieldQuestion, 
  Trash2, Search, Filter, AlertTriangle
} from 'lucide-react';
import { PhishPilotReport, PhishPilotVerdict } from '../../phishpilotTypes';

interface Props {
  reports: PhishPilotReport[];
  onSelectReport: (report: PhishPilotReport) => void;
  onDeleteReport: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onClearAll: () => void;
  verdictFilter: string;
  setVerdictFilter: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
}

export const ReportList: React.FC<Props> = ({
  reports,
  onSelectReport,
  onDeleteReport,
  onBulkDelete,
  onClearAll,
  verdictFilter,
  setVerdictFilter,
  searchQuery,
  setSearchQuery
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const getVerdictIcon = (verdict: PhishPilotVerdict) => {
    switch (verdict) {
      case 'PHISHING': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'SUSPICIOUS': return <ShieldQuestion className="w-5 h-5 text-amber-500" />;
      case 'LEGITIMATE': return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
    }
  };

  const getVerdictBadge = (verdict: PhishPilotVerdict) => {
    switch (verdict) {
      case 'PHISHING': return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'SUSPICIOUS': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'LEGITIMATE': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(reports.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDeleteClick = () => {
    if (selectedIds.size > 0 && confirm(`Delete ${selectedIds.size} selected reports?`)) {
      onBulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const handleClearAllClick = () => {
    if (confirm('Are you sure you want to delete all reports? This cannot be undone.')) {
      onClearAll();
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[600px]">
      
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap gap-4 items-center justify-between bg-slate-900">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative max-w-md w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search subject or sender..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={verdictFilter}
              onChange={(e) => setVerdictFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Verdicts</option>
              <option value="PHISHING">Phishing</option>
              <option value="SUSPICIOUS">Suspicious</option>
              <option value="LEGITIMATE">Legitimate</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDeleteClick}
              className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-lg text-sm font-bold border border-red-500/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete ({selectedIds.size})
            </button>
          )}
          <button
            onClick={handleClearAllClick}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg text-sm font-bold transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
            <ShieldCheck className="w-12 h-12 mb-2 opacity-20" />
            <p>No reports found matching criteria.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-950/50 text-slate-400 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input 
                    type="checkbox" 
                    checked={reports.length > 0 && selectedIds.size === reports.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-950"
                  />
                </th>
                <th className="px-4 py-3 font-semibold w-32">Verdict</th>
                <th className="px-4 py-3 font-semibold">Subject & Sender</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Risk / Conf</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {reports.map((report) => (
                <tr 
                  key={report.id}
                  onClick={() => onSelectReport(report)}
                  className={`hover:bg-slate-800/50 cursor-pointer transition-colors group ${selectedIds.has(report.id) ? 'bg-cyan-950/20' : ''}`}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox"
                      checked={selectedIds.has(report.id)}
                      onChange={(e) => handleToggleSelect(report.id, e as any)}
                      className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-950 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold ${getVerdictBadge(report.verdict)}`}>
                      {getVerdictIcon(report.verdict)}
                      {report.verdict}
                    </div>
                  </td>
                  <td className="px-4 py-3 min-w-0 max-w-[300px]">
                    <div className="font-bold text-slate-200 truncate">{report.emailSummary.subject || '(No Subject)'}</div>
                    <div className="text-xs text-slate-500 truncate">{report.emailSummary.from}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {new Date(report.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="text-xs">
                        <span className="text-slate-500">Score:</span>{' '}
                        <span className={`font-bold ${report.riskScore > 75 ? 'text-red-400' : report.riskScore > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {report.riskScore}
                        </span>
                      </div>
                      <div className="text-xs">
                        <span className="text-slate-500">Conf:</span>{' '}
                        <span className="text-cyan-400 font-bold">{(report.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this report?')) onDeleteReport(report.id);
                      }}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
