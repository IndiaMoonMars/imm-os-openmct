/*
 * IMM-OS alarms in OpenMCT, from the health monitor (imm-os-backend services/health_monitor.py):
 *   - a status-bar indicator: mission mode (NOMINAL / DEGRADED / EMERGENCY) and open alarms
 *   - a notification when an alarm is raised or escalates (error for warning / emergency,
 *     alert for caution, info for advisory) and when an EVA crew member's LOS state changes
 * Acknowledging is done in the IMM-OS console (Health tab / annunciator).
 * Statistical anomalies (z-score, /api/alerts) are shown as info only: they are not alarms.
 */
function IMM_AlertsPlugin() {
    return function install(openmct) {
        const indicator = openmct.indicators.simpleIndicator();
        indicator.text('HEALTH …');
        indicator.statusClass('s-status-off');
        openmct.indicators.add(indicator);

        const MODE_CLASS = { NOMINAL: 's-status-on', DEGRADED: 's-status-caution', EMERGENCY: 's-status-error' };
        const RANK = { advisory: 0, caution: 1, warning: 2, emergency: 3 };
        const seen = {};          // alarm id -> severity already announced
        const losSeen = {};       // crew -> state already announced
        let first = true;

        function notify(sev, text) {
            if (sev === 'warning' || sev === 'emergency') openmct.notifications.error(text);
            else if (sev === 'caution') openmct.notifications.alert(text);
            else openmct.notifications.info(text);
        }

        function pollHealth() {
            IMM_AUTH.fetch('/api/health/summary')
                .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
                .then(s => {
                    const alarms = (s.alarms || []).filter(a => !a.simulated);
                    const unacked = alarms.filter(a => !a.acked).length;
                    indicator.text(`${s.mode} · ${alarms.length} alarm(s)${unacked ? `, ${unacked} new` : ''}`);
                    indicator.statusClass(MODE_CLASS[s.mode] || 's-status-off');
                    indicator.description(alarms.slice(0, 5).map(a => `${a.severity.toUpperCase()}: ${a.message}`).join('\n')
                        || 'No open alarms');
                    alarms.forEach(a => {
                        const before = seen[a.id];
                        if (!first && a.state === 'active' && (before === undefined || RANK[a.severity] > RANK[before])) {
                            notify(a.severity, `${a.severity.toUpperCase()}${a.unverified ? ' (UNVERIFIED)' : ''}: ${a.message}`);
                        }
                        seen[a.id] = a.severity;
                    });
                    (s.eva || []).forEach(c => {
                        if (!first && losSeen[c.crew_id] !== c.state && c.state !== 'NOMINAL') {
                            notify(c.state === 'CONTINGENCY' ? 'emergency' : c.state === 'LOS' ? 'warning' : 'caution',
                                   `EVA ${c.crew_id}: ${c.state.replace('_', ' ')}` +
                                   (c.search_radius_m ? `, search radius ${Math.round(c.search_radius_m)} m` : ''));
                        }
                        losSeen[c.crew_id] = c.state;
                    });
                    first = false;
                })
                .catch(() => {
                    indicator.text('HEALTH UNKNOWN');
                    indicator.statusClass('s-status-off');
                    indicator.description('Health monitor unreachable');
                });
        }

        let lastChecked = Math.floor(Date.now() / 1000) - 30;
        function pollAnomalies() {
            IMM_AUTH.fetch(`/api/alerts?since=${lastChecked}`)
                .then(r => r.json())
                .then(alerts => {
                    alerts.forEach(alert => openmct.notifications.info(
                        `Unusual value (statistical): ${alert.sensor} ${alert.metric} = ${parseFloat(alert.value).toFixed(2)}`));
                    lastChecked = Math.floor(Date.now() / 1000);
                })
                .catch(e => console.error('Anomaly poller failed: ', e));
        }

        pollHealth();
        setInterval(pollHealth, 3000);
        setInterval(pollAnomalies, 10000);
    };
}
