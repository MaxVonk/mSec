import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShieldAlert, 
  Shield, 
  User, 
  Laptop, 
  Globe, 
  FileCode, 
  ExternalLink, 
  Target, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Search, 
  Copy, 
  Check, 
  Crosshair,
  Layers,
  Filter
} from 'lucide-react';
import { GraphData, GraphNode, GraphEdge, EntityType, IncidentSeverity } from '../../types';
import { ThreatIntelBadge } from '../common/ThreatIntelBadge';

interface InvestigationGraphProps {
  data: GraphData;
  height?: number | string;
  onSelectNode?: (node: GraphNode) => void;
  onSelectIncident?: (incidentId: string) => void;
  title?: string;
  subtitle?: string;
}

export const InvestigationGraph: React.FC<InvestigationGraphProps> = ({
  data,
  height = 550,
  onSelectNode,
  onSelectIncident,
  title,
  subtitle
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtering toggles
  const [activeTypeFilters, setActiveTypeFilters] = useState<Record<string, boolean>>({
    incident: true,
    alert: true,
    user: true,
    host: true,
    ip: true,
    file: true,
    url: true,
    mitre: true
  });

  // Pan & Zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Dragging node state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Compute Layout when data changes
  useEffect(() => {
    if (!data.nodes.length) {
      setNodes([]);
      return;
    }

    const width = 850;
    const h = typeof height === 'number' ? height : 550;
    const centerX = width / 2;
    const centerY = h / 2;

    const incidentNodes = data.nodes.filter(n => n.type === 'incident');
    const alertNodes = data.nodes.filter(n => n.type === 'alert');
    const mitreNodes = data.nodes.filter(n => n.type === 'mitre');
    const entityNodes = data.nodes.filter(n => !['incident', 'alert', 'mitre'].includes(n.type));

    const positionedNodes: GraphNode[] = [];

    // Center Incidents
    incidentNodes.forEach((node, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(1, incidentNodes.length);
      const r = incidentNodes.length > 1 ? 70 : 0;
      positionedNodes.push({
        ...node,
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle)
      });
    });

    // Ring 1: Alerts (Radius 160)
    alertNodes.forEach((node, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(1, alertNodes.length) - Math.PI / 2;
      positionedNodes.push({
        ...node,
        x: centerX + 155 * Math.cos(angle),
        y: centerY + 130 * Math.sin(angle)
      });
    });

    // Ring 2: Entities (Radius 270)
    entityNodes.forEach((node, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(1, entityNodes.length) + (Math.PI / 4);
      positionedNodes.push({
        ...node,
        x: centerX + 280 * Math.cos(angle),
        y: centerY + 220 * Math.sin(angle)
      });
    });

    // Ring 3 / Side: MITRE Tactics
    mitreNodes.forEach((node, idx) => {
      const angle = Math.PI + ((idx + 0.5) * Math.PI) / Math.max(1, mitreNodes.length);
      positionedNodes.push({
        ...node,
        x: centerX + 360 * Math.cos(angle),
        y: centerY + 260 * Math.sin(angle)
      });
    });

    setNodes(positionedNodes);
    setTransform({ x: 0, y: 0, scale: 1 });
  }, [data, height]);

  // Filtered nodes and edges
  const filteredNodes = useMemo(() => {
    return nodes.filter(n => {
      if (!activeTypeFilters[n.type]) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          n.label.toLowerCase().includes(q) ||
          (n.sublabel && n.sublabel.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [nodes, activeTypeFilters, searchQuery]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    return data.edges.filter(
      e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
    );
  }, [data.edges, filteredNodeIds]);

  // Selected node & neighbors
  const selectedNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const neighborNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const neighbors = new Set<string>([selectedNodeId]);
    filteredEdges.forEach(e => {
      if (e.source === selectedNodeId) neighbors.add(e.target);
      if (e.target === selectedNodeId) neighbors.add(e.source);
    });
    return neighbors;
  }, [selectedNodeId, filteredEdges]);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (draggingNodeId) return;
    if (e.button !== 0) return; // Only left click
    setIsPanning(true);
    setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      }));
    } else if (draggingNodeId) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const rawX = (e.clientX - rect.left - transform.x) / transform.scale;
      const rawY = (e.clientY - rect.top - transform.y) / transform.scale;

      setNodes(prev =>
        prev.map(node =>
          node.id === draggingNodeId
            ? { ...node, x: rawX - dragOffset.x, y: rawY - dragOffset.y }
            : node
        )
      );
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(0.4, transform.scale * zoomFactor), 2.5);
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  const handleZoom = (delta: number) => {
    setTransform(prev => ({
      ...prev,
      scale: Math.min(Math.max(0.4, prev.scale + delta), 2.5)
    }));
  };

  const handleReset = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
    setSelectedNodeId(null);
  };

  const handleStartNodeDrag = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();
    setDraggingNodeId(node.id);
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const currentMouseX = (e.clientX - rect.left - transform.x) / transform.scale;
    const currentMouseY = (e.clientY - rect.top - transform.y) / transform.scale;
    setDragOffset({
      x: currentMouseX - (node.x || 0),
      y: currentMouseY - (node.y || 0)
    });
    setSelectedNodeId(node.id);
    if (onSelectNode) onSelectNode(node);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Node styles and colors
  const getNodeColor = (node: GraphNode) => {
    switch (node.type) {
      case 'incident':
        if (node.severity === 'CRITICAL') return { fill: '#ef4444', ring: '#dc2626', text: '#fca5a5' };
        if (node.severity === 'HIGH') return { fill: '#f97316', ring: '#ea580c', text: '#fdba74' };
        return { fill: '#0284c7', ring: '#0369a1', text: '#7dd3fc' };
      case 'alert':
        return { fill: '#3b82f6', ring: '#1d4ed8', text: '#93c5fd' };
      case 'user':
        return { fill: '#06b6d4', ring: '#0891b2', text: '#67e8f9' };
      case 'host':
        return { fill: '#a855f7', ring: '#9333ea', text: '#d8b4fe' };
      case 'ip':
        return { fill: '#f59e0b', ring: '#d97706', text: '#fcd34d' };
      case 'file':
        return { fill: '#10b981', ring: '#059669', text: '#6ee7b7' };
      case 'url':
        return { fill: '#ec4899', ring: '#db2777', text: '#f472b6' };
      case 'mitre':
        return { fill: '#f97316', ring: '#ea580c', text: '#fdba74' };
      default:
        return { fill: '#64748b', ring: '#475569', text: '#cbd5e1' };
    }
  };

  const renderNodeIcon = (node: GraphNode) => {
    switch (node.type) {
      case 'incident':
        return <ShieldAlert className="w-5 h-5 text-white" />;
      case 'alert':
        return <Shield className="w-3.5 h-3.5 text-white" />;
      case 'user':
        return <User className="w-3.5 h-3.5 text-white" />;
      case 'host':
        return <Laptop className="w-3.5 h-3.5 text-white" />;
      case 'ip':
        return <Globe className="w-3.5 h-3.5 text-white" />;
      case 'file':
        return <FileCode className="w-3.5 h-3.5 text-white" />;
      case 'url':
        return <ExternalLink className="w-3.5 h-3.5 text-white" />;
      case 'mitre':
        return <Target className="w-3.5 h-3.5 text-white" />;
      default:
        return <Crosshair className="w-3.5 h-3.5 text-white" />;
    }
  };

  return (
    <div className="relative flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Graph Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900/90 border-b border-slate-800 z-10">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-200">
            {title || 'Interactive Investigation & Correlation Graph'}
          </span>
          {subtitle && (
            <span className="text-[11px] text-slate-500 hidden sm:inline">• {subtitle}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search graph..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-2.5 py-1 bg-slate-950 border border-slate-700/80 rounded-md text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-36 sm:w-48"
            />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-950 border border-slate-700/80 rounded-md p-0.5">
            <button
              onClick={() => handleZoom(0.15)}
              title="Zoom In"
              className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleZoom(-0.15)}
              title="Zoom Out"
              className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleReset}
              title="Reset View"
              className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 bg-slate-950/70 border-b border-slate-800/60 text-[11px]">
        <span className="text-slate-500 flex items-center gap-1 mr-1">
          <Filter className="w-3 h-3" /> Filter:
        </span>
        {Object.entries(activeTypeFilters).map(([type, active]) => (
          <button
            key={type}
            onClick={() => setActiveTypeFilters(prev => ({ ...prev, [type]: !prev[type] }))}
            className={`px-2 py-0.5 rounded-full font-semibold transition-all cursor-pointer capitalize border ${
              active
                ? type === 'incident' ? 'bg-red-950/60 text-red-300 border-red-800/60'
                : type === 'alert' ? 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                : type === 'user' ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60'
                : type === 'host' ? 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                : type === 'ip' ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                : type === 'file' ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                : type === 'url' ? 'bg-pink-950/60 text-pink-300 border-pink-800/60'
                : 'bg-orange-950/60 text-orange-300 border-orange-800/60'
                : 'bg-slate-900/50 text-slate-500 border-slate-800 opacity-50 line-through'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{ height }}
        className="relative w-full overflow-hidden select-none cursor-grab active:cursor-grabbing bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]"
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0'
          }}
        >
          <defs>
            <marker
              id="graph-arrow"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
            </marker>
            <marker
              id="graph-arrow-active"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
            </marker>
          </defs>

          {/* Render Edges */}
          {filteredEdges.map(edge => {
            const sourceNode = filteredNodes.find(n => n.id === edge.source);
            const targetNode = filteredNodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            const isHighlighted =
              selectedNodeId &&
              (edge.source === selectedNodeId || edge.target === selectedNodeId);

            const isDimmed = selectedNodeId && !isHighlighted;

            const x1 = sourceNode.x || 0;
            const y1 = sourceNode.y || 0;
            const x2 = targetNode.x || 0;
            const y2 = targetNode.y || 0;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const cx = (x1 + x2) / 2 - dy * 0.1;
            const cy = (y1 + y2) / 2 + dx * 0.1;

            return (
              <g key={edge.id} className="transition-opacity duration-200">
                <path
                  d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                  fill="none"
                  stroke={isHighlighted ? '#06b6d4' : '#334155'}
                  strokeWidth={isHighlighted ? 2.5 : 1.2}
                  strokeDasharray={edge.label?.includes('alert') ? '4 2' : undefined}
                  markerEnd={isHighlighted ? 'url(#graph-arrow-active)' : 'url(#graph-arrow)'}
                  opacity={isDimmed ? 0.15 : 0.8}
                />
                {edge.label && (
                  <text
                    x={cx}
                    y={cy - 4}
                    textAnchor="middle"
                    fill={isHighlighted ? '#67e8f9' : '#64748b'}
                    fontSize="9"
                    className="font-mono font-medium select-none pointer-events-none"
                    opacity={isDimmed ? 0.1 : 0.9}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Render HTML Nodes positioned on top */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0'
          }}
        >
          {filteredNodes.map(node => {
            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const isNeighbor = selectedNodeId && neighborNodeIds.has(node.id);
            const isDimmed = selectedNodeId && !isNeighbor;
            const colors = getNodeColor(node);

            const isIncident = node.type === 'incident';
            const radius = isIncident ? 48 : 34;

            return (
              <div
                key={node.id}
                onMouseDown={e => handleStartNodeDrag(e, node)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                style={{
                  left: (node.x || 0) - radius / 2,
                  top: (node.y || 0) - radius / 2,
                  width: radius,
                  height: radius
                }}
                className={`absolute pointer-events-auto rounded-full flex flex-col items-center justify-center transition-transform duration-100 cursor-pointer ${
                  isSelected
                    ? 'ring-4 ring-cyan-400 scale-110 shadow-[0_0_25px_rgba(6,182,212,0.6)] z-30'
                    : isHovered
                    ? 'scale-105 shadow-[0_0_15px_rgba(255,255,255,0.2)] z-20'
                    : isDimmed
                    ? 'opacity-20 scale-95'
                    : 'shadow-lg z-10'
                }`}
              >
                {/* Visual node circle */}
                <div
                  style={{
                    backgroundColor: colors.fill,
                    borderColor: colors.ring
                  }}
                  className={`w-full h-full rounded-full border flex items-center justify-center relative overflow-hidden transition-all ${
                    isIncident ? 'animate-pulse' : ''
                  }`}
                >
                  {renderNodeIcon(node)}
                </div>

                {/* Node Label badge */}
                <div
                  className={`absolute top-full mt-1.5 px-2 py-0.5 rounded text-[10px] whitespace-nowrap font-medium pointer-events-none flex flex-col items-center backdrop-blur-md transition-opacity ${
                    isSelected
                      ? 'bg-cyan-950/90 text-cyan-200 border border-cyan-500/50 shadow-md z-40'
                      : 'bg-slate-950/80 text-slate-300 border border-slate-800'
                  } ${isDimmed ? 'opacity-20' : 'opacity-100'}`}
                >
                  <span className="font-semibold max-w-[140px] truncate">{node.label}</span>
                  {node.sublabel && (
                    <span className="text-[9px] text-slate-400 font-mono truncate max-w-[140px]">
                      {node.sublabel}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="absolute top-4 right-4 w-72 bg-slate-900/95 border border-slate-700/80 rounded-xl p-4 shadow-2xl backdrop-blur-md z-40 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <div
                  style={{ backgroundColor: getNodeColor(selectedNode).fill }}
                  className="p-1.5 rounded-lg text-white"
                >
                  {renderNodeIcon(selectedNode)}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    {selectedNode.type}
                  </span>
                  <h4 className="text-xs font-bold text-slate-100 truncate max-w-[160px]">
                    {selectedNode.label}
                  </h4>
                </div>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="text-slate-400 hover:text-slate-200 text-xs px-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {selectedNode.sublabel && (
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Role / Context</span>
                  <span className="text-slate-300 font-mono text-[11px]">{selectedNode.sublabel}</span>
                </div>
              )}

              {selectedNode.severity && (
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Severity</span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-0.5 ${
                      selectedNode.severity === 'CRITICAL'
                        ? 'bg-red-950 text-red-400 border border-red-800'
                        : selectedNode.severity === 'HIGH'
                        ? 'bg-orange-950 text-orange-400 border border-orange-800'
                        : 'bg-blue-950 text-blue-400 border border-blue-800'
                    }`}
                  >
                    {selectedNode.severity}
                  </span>
                </div>
              )}

              {/* Connected edges summary */}
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Connected Entities</span>
                <span className="text-slate-300 font-bold">
                  {neighborNodeIds.size - 1} related elements
                </span>
              </div>

              {(selectedNode.type === 'ip' || selectedNode.type === 'file' || selectedNode.type === 'url') && (
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block mb-1">Threat Intelligence</span>
                  <ThreatIntelBadge indicator={selectedNode.label} type={selectedNode.type === 'file' ? 'FILE_HASH' : (selectedNode.type.toUpperCase() as any)} />
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800 flex flex-col gap-1.5">
                <button
                  onClick={() => handleCopy(selectedNode.id, selectedNode.label)}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  {copiedId === selectedNode.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Value</span>
                    </>
                  )}
                </button>

                {selectedNode.data?.incidentId && onSelectIncident && (
                  <button
                    onClick={() => onSelectIncident(selectedNode.data.incidentId)}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Incident Details</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-900/90 border-t border-slate-800 text-[11px] text-slate-400">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Incident
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Alert
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-500" /> User
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500" /> Host
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> IP
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> File
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-pink-500" /> URL
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500" /> MITRE
          </span>
        </div>
        <div className="text-[10px] text-slate-500">
          Tip: Drag nodes • Scroll to zoom • Click to inspect blast radius
        </div>
      </div>
    </div>
  );
};

