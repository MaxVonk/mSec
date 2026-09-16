import React, { useState, useEffect, useMemo } from 'react';
import {
  Rss,
  Search,
  RefreshCw,
  Plus,
  SlidersHorizontal,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  Tag,
  Calendar,
  Radio,
  Check,
  Copy,
  Trash2,
  Globe,
  X,
  ChevronRight,
  Filter,
  Layers,
  Info,
  ArrowUpRight
} from 'lucide-react';
import { ThreatFeedSource, ThreatFeedItem } from '../../types';

interface ThreatInsightDashboardProps {
  onSelectIncidentSearch?: (query: string) => void;
}

export const ThreatInsightDashboard: React.FC<ThreatInsightDashboardProps> = ({
  onSelectIncidentSearch
}) => {
  const [sources, setSources] = useState<ThreatFeedSource[]>([]);
  const [items, setItems] = useState<ThreatFeedItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFeedId, setSelectedFeedId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [cvesOnly, setCvesOnly] = useState<boolean>(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState<boolean>(false);

  // Add Feed Form State
  const [newFeedName, setNewFeedName] = useState<string>('');
  const [newFeedUrl, setNewFeedUrl] = useState<string>('');
  const [newFeedCategory, setNewFeedCategory] = useState<string>('');
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<{ title: string; items: any[] } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Copied CVE feedback tracker
  const [copiedCve, setCopiedCve] = useState<string | null>(null);

  // Fetch sources
  const fetchSources = async () => {
    try {
      const res = await fetch('/api/threat-feeds/sources');
      if (res.ok) {
        const data = await res.json();
        setSources(data);
      }
    } catch (err) {
      console.error('Failed to fetch threat feed sources:', err);
    }
  };

  // Fetch items
  const fetchItems = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedFeedId !== 'ALL') params.append('feedId', selectedFeedId);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedCategory !== 'ALL') params.append('category', selectedCategory);
      if (selectedSeverity !== 'ALL') params.append('severity', selectedSeverity);
      if (cvesOnly) params.append('hasCves', 'true');
      params.append('limit', '150');

      const res = await fetch(`/api/threat-feeds/items?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotalCount(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch threat feed items:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [selectedFeedId, selectedCategory, selectedSeverity, cvesOnly, searchQuery]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch('/api/threat-feeds/refresh', { method: 'POST' });
      await fetchSources();
      await fetchItems();
    } catch (err) {
      console.error('Failed to refresh feeds:', err);
      setIsRefreshing(false);
    }
  };

  const handleToggleFeed = async (sourceId: string, currentEnabled: boolean) => {
    try {
      const res = await fetch(`/api/threat-feeds/sources/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      if (res.ok) {
        await fetchSources();
        await fetchItems();
      }
    } catch (err) {
      console.error('Failed to toggle source:', err);
    }
  };

  const handleDeleteFeed = async (sourceId: string) => {
    if (!confirm('Are you sure you want to remove this threat feed source?')) return;
    try {
      const res = await fetch(`/api/threat-feeds/sources/${sourceId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchSources();
        await fetchItems();
      }
    } catch (err) {
      console.error('Failed to delete source:', err);
    }
  };

  const handlePreviewFeed = async () => {
    if (!newFeedUrl.trim()) {
      setPreviewError('Please enter a valid RSS or Atom feed URL');
      return;
    }
    setIsPreviewing(true);
    setPreviewError(null);
    setPreviewData(null);
    try {
      const res = await fetch(`/api/threat-feeds/preview?url=${encodeURIComponent(newFeedUrl.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse feed');
      }
      setPreviewData(data);
      if (!newFeedName.trim() && data.title) {
        setNewFeedName(data.title);
      }
    } catch (err: any) {
      setPreviewError(err.message || 'Could not fetch or parse RSS feed.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedUrl.trim()) return;

    setIsSubmitting(true);
    setPreviewError(null);
    try {
      const res = await fetch('/api/threat-feeds/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFeedName.trim() || undefined,
          url: newFeedUrl.trim(),
          category: newFeedCategory.trim() || 'General'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save source');
      }
      // Reset and close
      setNewFeedName('');
      setNewFeedUrl('');
      setNewFeedCategory('');
      setPreviewData(null);
      setIsAddModalOpen(false);
      await fetchSources();
      await fetchItems();
    } catch (err: any) {
      setPreviewError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCve = (cve: string) => {
    navigator.clipboard.writeText(cve);
    setCopiedCve(cve);
    setTimeout(() => setCopiedCve(null), 2000);
  };

  // Compute category list from items & sources
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(it => {
      (it.categories || []).forEach(c => set.add(c));
    });
    return Array.from(set).slice(0, 15);
  }, [items]);

  // Metrics
  const cveCount = useMemo(() => {
    return items.filter(i => i.cves && i.cves.length > 0).length;
  }, [items]);

  const criticalCount = useMemo(() => {
    return items.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH').length;
  }, [items]);

  const activeSourcesCount = useMemo(() => {
    return sources.filter(s => s.enabled).length;
  }, [sources]);

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHrs < 1) {
        const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
        return `${diffMins}m ago`;
      }
      if (diffHrs < 24) return `${diffHrs}h ago`;
      const diffDays = Math.floor(diffHrs / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  const getSeverityBadge = (sev?: string) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800/80 uppercase">
            Critical
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800/80 uppercase">
            High
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-yellow-950/60 text-yellow-300 border border-yellow-800/60 uppercase">
            Medium
          </span>
        );
      case 'LOW':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/60 uppercase">
            Low
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700 uppercase">
            Info
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="p-2.5 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20 text-white">
                <Rss className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  Threat Insight
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/80 font-bold">
                    Cyber Intel Feeds
                  </span>
                </h1>
              </div>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Live automated security intelligence ingestion from CERT-SE, CISA, NCSC, and custom RSS/Atom feeds. Includes real-time CVE extraction, severity classification, and cross-incident correlation.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/80 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
              title="Fetch latest articles from all enabled feeds"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Feeds'}</span>
            </button>

            <button
              onClick={() => setIsManageModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/80 text-xs font-medium transition-all cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span>Manage Sources</span>
            </button>

            <button
              onClick={() => {
                setPreviewData(null);
                setPreviewError(null);
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-cyan-600/25 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add RSS Feed</span>
            </button>
          </div>
        </div>

        {/* Telemetry Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Feed Advisories</p>
              <p className="text-xl font-bold font-mono text-white mt-0.5">{totalCount}</p>
            </div>
            <div className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/50">
              <Radio className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Sources</p>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                {activeSourcesCount} <span className="text-xs text-slate-500 font-normal">/ {sources.length}</span>
              </p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/50">
              <Globe className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">CVE Identifiers</p>
              <p className="text-xl font-bold font-mono text-cyan-400 mt-0.5">{cveCount}</p>
            </div>
            <div className="p-2 rounded-lg bg-blue-950 text-blue-400 border border-blue-800/50">
              <Tag className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">High / Critical</p>
              <p className="text-xl font-bold font-mono text-rose-400 mt-0.5">{criticalCount}</p>
            </div>
            <div className="p-2 rounded-lg bg-rose-950 text-rose-400 border border-rose-800/50">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Query Bar */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Omnisearch */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search advisories, CVE-2026-..., Swedish alerts, software names..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-9 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Severity Dropdown */}
          <select
            value={selectedSeverity}
            onChange={e => setSelectedSeverity(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* CVEs only toggle */}
          <button
            onClick={() => setCvesOnly(!cvesOnly)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
              cvesOnly
                ? 'bg-cyan-950 text-cyan-300 border-cyan-700/80 shadow-sm'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>CVEs Only</span>
            {cvesOnly && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
          </button>
        </div>

        {/* Source Pills and Categories */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
          <span className="text-[11px] font-semibold text-slate-500 uppercase mr-1">Source:</span>
          <button
            onClick={() => setSelectedFeedId('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
              selectedFeedId === 'ALL'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold'
                : 'bg-slate-950/70 text-slate-400 hover:text-slate-200 border border-slate-800/80'
            }`}
          >
            All Sources ({sources.length})
          </button>
          {sources.map(src => (
            <button
              key={src.id}
              onClick={() => setSelectedFeedId(src.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                selectedFeedId === src.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold'
                  : 'bg-slate-950/70 text-slate-400 hover:text-slate-200 border border-slate-800/80'
              } ${!src.enabled ? 'opacity-40 line-through' : ''}`}
            >
              <span>{src.name}</span>
            </button>
          ))}

          {availableCategories.length > 0 && (
            <>
              <span className="text-[11px] font-semibold text-slate-500 uppercase ml-2 mr-1">Category:</span>
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'bg-slate-950/50 text-slate-400 hover:text-slate-300 border border-slate-800'
                }`}
              >
                All
              </button>
              {availableCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? 'ALL' : cat)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white font-medium'
                      : 'bg-slate-950/50 text-slate-400 hover:text-slate-300 border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Main Feed Content List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800/80">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">Loading Threat Intelligence Feeds...</p>
            <p className="text-xs text-slate-500 mt-1">Ingesting live RSS/Atom feeds and matching CVE definitions</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800/80">
            <Radio className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">No Intelligence Advisories Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No feed items match your active filters. Try clearing your search query or refreshing the active feeds.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedFeedId('ALL');
                setSelectedCategory('ALL');
                setSelectedSeverity('ALL');
                setCvesOnly(false);
              }}
              className="mt-4 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-400 font-medium transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-5 transition-all shadow-sm group"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/80">
                      {item.feedName}
                    </span>

                    {getSeverityBadge(item.severity)}

                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {new Date(item.pubDate).toLocaleDateString()} {new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      <span className="text-slate-600">({formatRelativeTime(item.pubDate)})</span>
                    </span>
                  </div>

                  {/* Title & Link */}
                  <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline flex items-center gap-1.5"
                    >
                      <span>{item.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                    </a>
                  </h3>

                  {/* Summary */}
                  {item.summary && (
                    <p className="text-xs text-slate-300/90 line-clamp-3 leading-relaxed">
                      {item.summary}
                    </p>
                  )}

                  {/* Badges: CVEs & Categories */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {(item.cves || []).map(cve => (
                      <div
                        key={cve}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-950/70 border border-rose-800/80 text-[11px] font-mono font-bold text-rose-300 shadow-sm"
                      >
                        <span>{cve}</span>
                        <button
                          onClick={() => handleCopyCve(cve)}
                          title="Copy CVE ID"
                          className="hover:text-white cursor-pointer ml-1"
                        >
                          {copiedCve === cve ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    ))}

                    {(item.categories || []).map(cat => (
                      <span
                        key={cat}
                        className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 text-[10px] font-medium"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right side Pivot Actions */}
                <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-2 md:pt-0">
                  {item.cves && item.cves.length > 0 && onSelectIncidentSearch && (
                    <button
                      onClick={() => onSelectIncidentSearch(item.cves![0])}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-cyan-400 hover:text-cyan-300 border border-slate-700/80 text-xs font-semibold transition-all cursor-pointer shadow-sm"
                      title={`Search incidents affecting ${item.cves[0]}`}
                    >
                      <Search className="w-3 h-3" />
                      <span>Search {item.cves[0]}</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  )}

                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs transition-all"
                  >
                    <span>Read Advisory</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL: ADD RSS FEED */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-4">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
                  <Rss className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add Threat Intel RSS Feed</h3>
                  <p className="text-xs text-slate-400">Connect custom CERT, vendor, or OSINT RSS/Atom streams</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddFeed} className="p-5 pt-0 space-y-4">
              {previewError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{previewError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Feed URL (RSS or Atom) <span className="text-cyan-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    required
                    placeholder="https://example.com/feed.xml"
                    value={newFeedUrl}
                    onChange={e => setNewFeedUrl(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={handlePreviewFeed}
                    disabled={isPreviewing || !newFeedUrl.trim()}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-cyan-400 border border-slate-700 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isPreviewing ? 'Testing...' : 'Test Feed'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Example: <code className="text-cyan-400">https://www.cert.se/feed.rss</code> or CISA/NCSC feeds
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Feed Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. CERT-SE Sårbarheter"
                  value={newFeedName}
                  onChange={e => setNewFeedName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Primary Category
                </label>
                <input
                  type="text"
                  placeholder="Advisory, Vulnerability, OSINT..."
                  value={newFeedCategory}
                  onChange={e => setNewFeedCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Preview Box */}
              {previewData && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> Valid Feed Detected
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {previewData.items.length} items parsed
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 font-bold truncate">{previewData.title}</p>
                  {previewData.items.length > 0 && (
                    <div className="text-[11px] text-slate-400 bg-slate-900 p-2 rounded border border-slate-800 truncate">
                      Latest: <span className="text-slate-300">{previewData.items[0].title}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newFeedUrl.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-cyan-600/25 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Adding...' : 'Add Feed Source'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE FEEDS */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-4">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-800 text-slate-200">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Manage Threat Feed Sources</h3>
                  <p className="text-xs text-slate-400">Enable, disable, or remove configured intelligence providers</p>
                </div>
              </div>
              <button
                onClick={() => setIsManageModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 pt-0 max-h-96 overflow-y-auto space-y-2.5">
              {sources.map(src => (
                <div
                  key={src.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">{src.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800">
                        {src.category}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 truncate">{src.url}</p>
                    {src.lastFetched && (
                      <p className="text-[10px] text-slate-500">
                        Last synced: {new Date(src.lastFetched).toLocaleTimeString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => handleToggleFeed(src.id, src.enabled)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        src.enabled
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                          : 'bg-slate-900 text-slate-500 border border-slate-800'
                      }`}
                    >
                      {src.enabled ? 'Enabled' : 'Disabled'}
                    </button>

                    <button
                      onClick={() => handleDeleteFeed(src.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-all cursor-pointer"
                      title="Remove Feed Source"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => {
                  setIsManageModalOpen(false);
                  setIsAddModalOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs text-cyan-400 hover:underline cursor-pointer font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add new feed source</span>
              </button>
              <button
                onClick={() => setIsManageModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
