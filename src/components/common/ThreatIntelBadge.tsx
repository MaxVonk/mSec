import React, { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, ExternalLink, Activity } from 'lucide-react';
import { ThreatIntelItem } from '../../types';

interface ThreatIntelBadgeProps {
  indicator: string;
  type?: 'IP' | 'DOMAIN' | 'URL' | 'FILE_HASH';
  showDetails?: boolean;
}

export const ThreatIntelBadge: React.FC<ThreatIntelBadgeProps> = ({
  indicator,
  type,
  showDetails = false
}) => {
  const [intel, setIntel] = useState<ThreatIntelItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!indicator) return;
    let isMounted = true;
    setIsLoading(true);

    const params = new URLSearchParams({ indicator });
    if (type) params.append('type', type);

    fetch(`/api/threat-intel/lookup?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted) setIntel(data);
      })
      .catch(err => console.error('Threat intel lookup failed:', err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [indicator, type]);

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
        <Activity className="w-2.5 h-2.5 animate-spin text-cyan-400" />
        <span>TI...</span>
      </span>
    );
  }

  if (!intel) return null;

  const isMalicious = intel.reputation === 'MALICIOUS' || intel.riskScore >= 60;
  const isSuspicious = intel.reputation === 'SUSPICIOUS' || (intel.riskScore >= 25 && intel.riskScore < 60);

  const badgeClass = isMalicious
    ? 'bg-red-950/80 text-red-300 border-red-800/80 hover:bg-red-900/80'
    : isSuspicious
    ? 'bg-amber-950/80 text-amber-300 border-amber-800/80 hover:bg-amber-900/80'
    : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60';

  const externalLink = intel.type === 'IP'
    ? `https://www.abuseipdb.com/check/${encodeURIComponent(intel.indicator)}`
    : intel.type === 'FILE_HASH'
    ? `https://www.virustotal.com/gui/file/${encodeURIComponent(intel.indicator)}`
    : `https://www.virustotal.com/gui/domain/${encodeURIComponent(intel.indicator)}`;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border transition-all cursor-pointer select-none ${badgeClass}`}
      >
        {isMalicious ? (
          <ShieldAlert className="w-2.5 h-2.5 text-red-400" />
        ) : isSuspicious ? (
          <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
        ) : (
          <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
        )}
        <span>{intel.riskScore > 0 ? `${intel.riskScore}/100` : 'Clean'}</span>
      </button>

      {/* Hover / Click Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full mb-1 left-0 z-50 w-64 p-3 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-2 pointer-events-auto animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              {isMalicious ? (
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              )}
              {intel.reputation}
            </span>
            <span className="font-mono font-bold text-cyan-400 text-[11px]">
              Score: {intel.riskScore}/100
            </span>
          </div>

          <div className="space-y-1 text-[11px] text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-500">Source:</span>
              <span className="font-semibold">{intel.source}</span>
            </div>
            {intel.details.country && (
              <div className="flex justify-between">
                <span className="text-slate-500">Country / ISP:</span>
                <span className="truncate max-w-[130px]">{intel.details.country} ({intel.details.isp || 'N/A'})</span>
              </div>
            )}
            {intel.details.totalReports !== undefined && intel.details.totalReports > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Abuse Reports:</span>
                <span className="font-mono text-red-400 font-bold">{intel.details.totalReports}</span>
              </div>
            )}
            {intel.details.detectionEngines && (
              <div className="flex justify-between">
                <span className="text-slate-500">VT Engines:</span>
                <span className="font-mono font-bold text-red-400">
                  {intel.details.detectionEngines.malicious} / {intel.details.detectionEngines.total}
                </span>
              </div>
            )}
            {intel.details.tags && intel.details.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {intel.details.tags.map((tag, i) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <a
            href={externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-semibold transition-colors mt-1"
          >
            <span>External Threat Dossier</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
};
