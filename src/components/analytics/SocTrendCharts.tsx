import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  ShieldAlert, 
  Target, 
  PieChart, 
  Activity, 
  Calendar,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import { AnalyticsTrends, TimelinePoint, MitreTacticMetric } from '../../types';

interface SocTrendChartsProps {
  onSelectTactic?: (tactic: string) => void;
}

export const SocTrendCharts: React.FC<SocTrendChartsProps> = ({ onSelectTactic }) => {
  const [trends, setTrends] = useState<AnalyticsTrends | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'tactics' | 'distribution'>('timeline');
  const [hoveredPoint, setHoveredPoint] = useState<TimelinePoint | null>(null);
  const [selectedTactic, setSelectedTactic] = useState<MitreTacticMetric | null>(null);

  useEffect(() => {
    fetch('/api/analytics/trends')
      .then(res => res.json())
      .then(data => {
        setTrends(data);
        if (data.mitreTactics?.length > 0) {
          setSelectedTactic(data.mitreTactics[0]);
        }
      })
      .catch(err => console.error('Failed to load analytics trends:', err))
      .finally(() => setIsLoading(false));
  }, []);

  // Timeline SVG calculations
  const timelineData = trends?.timeline || [];
  const maxCount = useMemo(() => {
    return Math.max(1, ...timelineData.map(p => p.count));
  }, [timelineData]);

  const svgWidth = 600;
  const svgHeight = 160;
  const paddingX = 40;
  const paddingY = 25;
  const chartW = svgWidth - paddingX * 2;
  const chartH = svgHeight - paddingY * 2;

  // Build points for area chart
  const points = useMemo(() => {
    if (timelineData.length === 0) return [];
    return timelineData.map((pt, idx) => {
      const x = paddingX + (idx / Math.max(1, timelineData.length - 1)) * chartW;
      const y = paddingY + chartH - (pt.count / maxCount) * chartH;
      return { ...pt, x, y };
    });
  }, [timelineData, maxCount, chartW, chartH]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const first = points[0];
    const last = points[points.length - 1];
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return `${pathD} L ${last.x} ${paddingY + chartH} L ${first.x} ${paddingY + chartH} Z`;
  }, [points, chartH]);

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [points]);

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-400">
        <Activity className="w-5 h-5 text-cyan-500 animate-spin mx-auto mb-2" />
        Loading SOC telemetry trends...
      </div>
    );
  }

  if (!trends) return null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
      {/* Header with Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              SOC Analytics & Ingestion Trends
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                Live Telemetry
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Multi-feed alert volume, attack tactic matrix, and threat posture
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'timeline'
                ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Timeline</span>
          </button>

          <button
            onClick={() => setActiveTab('tactics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'tactics'
                ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>MITRE ATT&CK</span>
          </button>

          <button
            onClick={() => setActiveTab('distribution')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'distribution'
                ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Breakdown</span>
          </button>
        </div>
      </div>

      {/* TAB 1: TIMELINE TREND */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SVG Area Chart */}
            <div className="lg:col-span-2 bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300">
                  Incident Intake Velocity (Last 7 Days)
                </span>
                {hoveredPoint && (
                  <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                    {hoveredPoint.date}: {hoveredPoint.count} alert(s)
                  </span>
                )}
              </div>

              <div className="relative w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-44 overflow-visible"
                >
                  <defs>
                    <linearGradient id="trend-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0, 0.5, 1].map((ratio, i) => {
                    const y = paddingY + chartH * (1 - ratio);
                    return (
                      <g key={i}>
                        <line
                          x1={paddingX}
                          y1={y}
                          x2={svgWidth - paddingX}
                          y2={y}
                          stroke="#1e293b"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={paddingX - 8}
                          y={y + 3}
                          textAnchor="end"
                          fontSize="9"
                          fill="#475569"
                          className="font-mono"
                        >
                          {Math.round(maxCount * ratio)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Area fill & curve */}
                  {areaPath && (
                    <path d={areaPath} fill="url(#trend-grad)" />
                  )}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Data Point Circles */}
                  {points.map((pt, i) => (
                    <g key={i} className="cursor-pointer">
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={hoveredPoint?.isoDate === pt.isoDate ? 5.5 : 3.5}
                        fill="#06b6d4"
                        stroke="#0f172a"
                        strokeWidth="2"
                        className="transition-all"
                        onMouseEnter={() => setHoveredPoint(pt)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                      {/* X-axis date labels */}
                      <text
                        x={pt.x}
                        y={svgHeight - 6}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#64748b"
                        className="font-medium select-none"
                      >
                        {pt.date}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Provider Breakdown Cards */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-300 block">
                Feed Ingestion Share
              </span>
              <div className="space-y-2">
                {trends.providerBreakdown.map((prov, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: prov.color }}
                      />
                      <span className="text-xs font-semibold text-slate-200">
                        {prov.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-100">
                        {prov.count}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {prov.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MITRE ATT&CK TACTICS MATRIX */}
      {activeTab === 'tactics' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Tactical Bar Chart */}
          <div className="lg:col-span-7 space-y-3">
            <span className="text-xs font-bold text-slate-300 block">
              Observed ATT&CK Tactics (Ranked by Alert Volume)
            </span>
            <div className="space-y-2">
              {trends.mitreTactics.map(tac => {
                const maxTacCount = Math.max(1, trends.mitreTactics[0]?.count || 1);
                const percent = Math.round((tac.count / maxTacCount) * 100);
                const isSelected = selectedTactic?.tactic === tac.tactic;

                return (
                  <button
                    key={tac.tactic}
                    onClick={() => {
                      setSelectedTactic(tac);
                      if (onSelectTactic) onSelectTactic(tac.tactic);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/70 border-cyan-600/80 shadow-md'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-200 flex items-center gap-2">
                        <Target className="w-3.5 h-3.5 text-cyan-400" />
                        {tac.tactic}
                      </span>
                      <span className="font-mono text-cyan-400 font-bold">
                        {tac.count} technique{tac.count === 1 ? '' : 's'}
                      </span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Technique Detail Drawer */}
          <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
            {selectedTactic ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                      Tactic Inspection
                    </span>
                    <h4 className="text-sm font-bold text-slate-100">
                      {selectedTactic.tactic}
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-mono font-bold">
                    {selectedTactic.techniques.length} Techniques
                  </span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {selectedTactic.techniques.map((tech, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 flex items-start justify-between gap-2"
                    >
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">
                          {tech.name}
                        </span>
                        <code className="text-[10px] text-cyan-400 font-mono">
                          {tech.id}
                        </code>
                      </div>
                      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                        {tech.count} alert{tech.count === 1 ? '' : 's'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Select a tactic to inspect mapped ATT&CK techniques
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SEVERITY & STATUS BREAKDOWN */}
      {activeTab === 'distribution' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Severity Breakdown */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              Incident Severity Distribution
            </span>
            <div className="space-y-2.5">
              {trends.severityBreakdown.map((sev, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{sev.name}</span>
                    <span className="font-mono text-slate-400">
                      {sev.count} ({sev.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${sev.percentage}%`,
                        backgroundColor: sev.color
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Triage Status Breakdown */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Triage Lifecycle Progression
            </span>
            <div className="space-y-2.5">
              {trends.statusBreakdown.map((st, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{st.name}</span>
                    <span className="font-mono text-slate-400">
                      {st.count} ({st.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${st.percentage}%`,
                        backgroundColor: st.color
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
