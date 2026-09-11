import { store } from './store.js';
import { ShiftHandoverReport, UnifiedIncident, ContainmentAction } from '../types/security.js';

export class SocReportService {
  /**
   * Generates a structured Shift Handover Report for the specified timeframe
   */
  public static generateShiftHandover(timeframeHours: number = 12, analystName?: string, notes?: string): { report: ShiftHandoverReport; markdown: string } {
    const allIncidents = store.getAll();
    const cutoffTime = new Date(Date.now() - timeframeHours * 60 * 60 * 1000).getTime();

    // Incidents within timeframe or currently active/in progress
    const shiftIncidents = allIncidents.filter(inc => {
      const created = new Date(inc.createdTime || Date.now()).getTime();
      const updated = new Date(inc.lastUpdatedTime || inc.createdTime || Date.now()).getTime();
      return created >= cutoffTime || updated >= cutoffTime || inc.status === 'ACTIVE' || inc.status === 'IN_PROGRESS';
    });

    let criticalCount = 0;
    let highCount = 0;
    let resolvedCount = 0;
    let containmentExecuted = 0;
    let containmentPending = 0;

    const userTally: Record<string, number> = {};
    const ipTally: Record<string, number> = {};
    const pendingActionsList: { incidentId: string; incidentTitle: string; action: ContainmentAction }[] = [];

    shiftIncidents.forEach(inc => {
      if (inc.severity === 'CRITICAL') criticalCount++;
      if (inc.severity === 'HIGH') highCount++;
      if (inc.status === 'RESOLVED' || inc.status === 'CLOSED') resolvedCount++;

      inc.entities.forEach(ent => {
        if (ent.type === 'USER') {
          userTally[ent.value] = (userTally[ent.value] || 0) + 1;
        }
        if (ent.type === 'IP') {
          ipTally[ent.value] = (ipTally[ent.value] || 0) + 1;
        }
      });

      if (inc.threatAssessment?.containmentActions) {
        inc.threatAssessment.containmentActions.forEach(act => {
          if (act.status === 'EXECUTED') {
            containmentExecuted++;
          } else {
            containmentPending++;
            pendingActionsList.push({
              incidentId: inc.id,
              incidentTitle: inc.title,
              action: act
            });
          }
        });
      }
    });

    const topTargetedUsers = Object.entries(userTally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([user, incidentCount]) => ({ user, incidentCount }));

    const topAttackerIps = Object.entries(ipTally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ip, count]) => ({ ip, count }));

    const keyIncidents = shiftIncidents
      .filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH')
      .slice(0, 8)
      .map(i => ({
        id: i.id,
        incidentNumber: i.incidentNumber,
        title: i.title,
        severity: i.severity,
        provider: i.provider,
        status: i.status,
        affectedUsers: i.entities.filter(e => e.type === 'USER').map(e => e.value).slice(0, 3),
        attackScenario: i.threatAssessment?.attackScenario
      }));

    const report: ShiftHandoverReport = {
      shiftId: `SHIFT-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36).toUpperCase()}`,
      generatedAt: new Date().toISOString(),
      timeframeHours,
      analystName: analystName || 'SOC Analyst on Duty',
      notes: notes || '',
      metrics: {
        totalIncidents: shiftIncidents.length,
        criticalIncidents: criticalCount,
        highIncidents: highCount,
        resolvedIncidents: resolvedCount,
        containmentExecuted,
        containmentPending
      },
      keyIncidents,
      topTargetedUsers,
      topAttackerIps,
      pendingActions: pendingActionsList.slice(0, 10)
    };

    const markdown = this.formatShiftMarkdown(report);
    return { report, markdown };
  }

  /**
   * Formats an incident investigation post-mortem report as Markdown
   */
  public static generateIncidentMarkdown(incident: UnifiedIncident): string {
    const lines: string[] = [];
    lines.push(`# Incident Forensic Report: #${incident.incidentNumber || incident.id}`);
    lines.push(`**Title:** ${incident.title}`);
    lines.push(`**Provider:** ${incident.provider} | **Severity:** ${incident.severity} | **Status:** ${incident.status}`);
    lines.push(`**Classification:** ${incident.classification || 'N/A'} | **Determination:** ${incident.determination || 'N/A'}`);
    lines.push(`**Created:** ${incident.createdTime} | **Updated:** ${incident.lastUpdatedTime}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 1. Executive Summary & Attack Scenario');
    lines.push(incident.threatAssessment?.attackScenario || incident.description);
    lines.push('');

    if (incident.threatAssessment?.trustBoundariesViolated?.length) {
      lines.push('### Trust Boundaries Violated');
      incident.threatAssessment.trustBoundariesViolated.forEach(tb => lines.push(`* ${tb}`));
      lines.push('');
    }

    lines.push('## 2. Correlated Entities & Evidence');
    lines.push('| Type | Value | Role / Context |');
    lines.push('| :--- | :--- | :--- |');
    incident.entities.forEach(e => {
      lines.push(`| **${e.type}** | \`${e.value}\` | ${e.role || 'Observed Indicator'} |`);
    });
    lines.push('');

    if (incident.mitreTechniques.length) {
      lines.push('## 3. MITRE ATT&CK Matrix');
      lines.push('| Tactic | Technique ID | Technique Name |');
      lines.push('| :--- | :--- | :--- |');
      incident.mitreTechniques.forEach(m => {
        lines.push(`| ${m.tactic} | \`${m.techniqueId}\` | ${m.techniqueName} |`);
      });
      lines.push('');
    }

    if (incident.threatAssessment?.containmentActions?.length) {
      lines.push('## 4. Remediation & Containment Audit Trail');
      lines.push('| Action | Target | Status | Type |');
      lines.push('| :--- | :--- | :--- | :--- |');
      incident.threatAssessment.containmentActions.forEach(a => {
        lines.push(`| ${a.title} | \`${a.target}\` | **${a.status}** | ${a.actionType} |`);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push(`*Report generated by mSec Incident Response Engine at ${new Date().toUTCString()}*`);
    return lines.join('\n');
  }

  private static formatShiftMarkdown(report: ShiftHandoverReport): string {
    const lines: string[] = [];
    lines.push(`# SOC Shift Handover Report: ${report.shiftId}`);
    lines.push(`**Generated At:** ${new Date(report.generatedAt).toUTCString()}`);
    lines.push(`**Timeframe:** Last ${report.timeframeHours} Hours | **Analyst:** ${report.analystName}`);
    lines.push('');

    if (report.notes) {
      lines.push('## 📝 Analyst Handover Observations');
      lines.push(report.notes);
      lines.push('');
    }

    lines.push('## 📊 Operational Telemetry Metrics');
    lines.push(`* **Total Active Incidents:** ${report.metrics.totalIncidents}`);
    lines.push(`* **Critical Severity Alerts:** ${report.metrics.criticalIncidents}`);
    lines.push(`* **High Severity Alerts:** ${report.metrics.highIncidents}`);
    lines.push(`* **Resolved / Closed:** ${report.metrics.resolvedIncidents}`);
    lines.push(`* **Containment Actions Executed:** ${report.metrics.containmentExecuted}`);
    lines.push(`* **Pending Actions Requiring Next Shift:** ${report.metrics.containmentPending}`);
    lines.push('');

    if (report.keyIncidents.length) {
      lines.push('## 🚨 Priority Incidents (Critical & High)');
      lines.push('| ID | Title | Severity | Provider | Status | Targeted Users |');
      lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |');
      report.keyIncidents.forEach(k => {
        lines.push(`| #${k.incidentNumber || k.id} | ${k.title} | **${k.severity}** | ${k.provider} | ${k.status} | ${k.affectedUsers.join(', ') || 'N/A'} |`);
      });
      lines.push('');
    }

    if (report.pendingActions.length) {
      lines.push('## ⚠️ Action Items for Next Shift');
      report.pendingActions.forEach(p => {
        lines.push(`* **${p.action.title}** on target \`${p.action.target}\` (Incident #${p.incidentId}: *${p.incidentTitle}*)`);
      });
      lines.push('');
    }

    if (report.topTargetedUsers.length) {
      lines.push('## 👤 Top Targeted Identities');
      report.topTargetedUsers.forEach(u => {
        lines.push(`* \`${u.user}\`: ${u.incidentCount} active incident(s)`);
      });
      lines.push('');
    }

    if (report.topAttackerIps.length) {
      lines.push('## 🌐 Top Attacker / External IPs');
      report.topAttackerIps.forEach(ip => {
        lines.push(`* \`${ip.ip}\`: ${ip.count} alert connection(s)`);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push(`*Generated via mSec Platform • All timestamps UTC*`);
    return lines.join('\n');
  }
}
