function IMM_EvaTrackPlugin() {
    return function install(openmct) {

        openmct.types.addType('imm.eva.map', {
            name: 'EVA Position Tracker',
            description: 'Real-time crew position on habitat/terrain map (UWB indoor + GPS outdoor)',
            cssClass: 'icon-object'
        });

        const EvaTrackViewProvider = {
            key: 'imm.eva.track.view',
            name: 'EVA Track',
            cssClass: 'icon-object',
            canView: function (domainObject) {
                return domainObject.type === 'imm.eva.map';
            },
            view: function (domainObject) {
                let socket = null;
                return {
                    show: function (container) {
                        container.innerHTML = `
                        <div id="eva-map-wrap" style="background:#0a0e1a;width:100%;height:100%;position:relative;overflow:hidden;font-family:monospace;">
                            <svg id="eva-svg" width="100%" height="100%" viewBox="0 0 800 600" style="display:block;">
                                <!-- Habitat outline -->
                                <rect x="50"  y="50"  width="300" height="500" fill="#161d2e" stroke="#2a7fff" stroke-width="2"/>
                                <text x="200" y="30" fill="#2a7fff" text-anchor="middle" font-size="14">HABITAT (INDOOR)</text>
                                <!-- Airlock -->
                                <rect x="350" y="220" width="60"  height="160" fill="#1a2340" stroke="#ffaa00" stroke-width="1.5" stroke-dasharray="6,3"/>
                                <text x="380" y="305" fill="#ffaa00" text-anchor="middle" font-size="11" transform="rotate(-90,380,305)">AIRLOCK</text>
                                <!-- Outdoor terrain -->
                                <rect x="410" y="50"  width="380" height="500" fill="#0e1a0a" stroke="#3d7a1e" stroke-width="2"/>
                                <text x="600" y="30" fill="#3d7a1e" text-anchor="middle" font-size="14">TERRAIN (GPS)</text>
                                <!-- Zone labels -->
                                <text x="200" y="100" fill="#aaa" text-anchor="middle" font-size="12">Core Module</text>
                                <text x="200" y="400" fill="#aaa" text-anchor="middle" font-size="12">Lab Module</text>
                                <!-- Crew marker — starts at centre -->
                                <circle id="crew-EV1" cx="200" cy="300" r="10" fill="#ff3c3c"/>
                                <text id="crew-EV1-label" x="216" y="305" fill="#ff3c3c" font-size="11">EV1</text>
                                <!-- Mode badge -->
                                <rect id="mode-badge-bg" x="10" y="560" width="120" height="28" rx="4" fill="#222"/>
                                <text id="mode-badge" x="70" y="579" fill="#0f0" text-anchor="middle" font-size="12">MODE: --</text>
                            </svg>
                            <!-- Vitals HUD -->
                            <div id="eva-vitals" style="position:absolute;top:12px;right:16px;background:rgba(0,0,0,.75);border:1px solid #2a7fff;padding:12px 18px;border-radius:8px;color:#fff;font-size:13px;min-width:180px;">
                                <div style="color:#2a7fff;font-weight:bold;margin-bottom:6px;">CREW EV1 VITALS</div>
                                <div>HR: <span id="hud-hr" style="color:#ff5c5c;">--</span> BPM</div>
                                <div>SpO₂: <span id="hud-spo2" style="color:#5cbcff;">--</span> %</div>
                                <div>Skin Temp: <span id="hud-temp" style="color:#ffaa00;">--</span> °C</div>
                            </div>
                        </div>`;

                        // ── WebSocket binding ──────────────────────────────
                        const wsUrl = `ws://${window.location.host}/api/realtime`;
                        socket = new WebSocket(wsUrl);

                        // Coordinate transform: UWB 10×10m grid → SVG 300×500px habitat rect
                        function uwbToSVG(x, y) {
                            const svgX = 50 + (x / 10) * 300;
                            const svgY = 50 + (y / 10) * 500;
                            return { svgX: Math.round(svgX), svgY: Math.round(svgY) };
                        }
                        // GPS outdoor → SVG terrain rect (approximate bounding box)
                        const GPS_LAT0 = 12.9716, GPS_LON0 = 77.5946;
                        const GPS_SCALE = 50000; // px per degree
                        function gpsToSVG(lat, lon) {
                            const svgX = 410 + (lon - GPS_LON0) * GPS_SCALE;
                            const svgY = 300 - (lat - GPS_LAT0) * GPS_SCALE;
                            return {
                                svgX: Math.min(790, Math.max(410, Math.round(svgX))),
                                svgY: Math.min(549, Math.max(51,  Math.round(svgY)))
                            };
                        }

                        socket.onmessage = function (event) {
                            try {
                                const msg = JSON.parse(event.data);
                                const d = msg.data || msg;

                                // ── Position frame ─────────────────────────
                                if (d.sensor === undefined && d.crew_id) {
                                    const badge = document.getElementById('mode-badge');
                                    const circle = document.getElementById(`crew-${d.crew_id}`);
                                    const label  = document.getElementById(`crew-${d.crew_id}-label`);
                                    if (!circle) return;

                                    let pos;
                                    if (d.mode === 'uwb') {
                                        pos = uwbToSVG(d.x_m, d.y_m);
                                        if (badge) { badge.textContent = 'MODE: UWB'; badge.style.fill = '#2a7fff'; }
                                    } else if (d.mode === 'gps') {
                                        pos = gpsToSVG(d.lat, d.lon);
                                        if (badge) { badge.textContent = 'MODE: GPS'; badge.style.fill = '#3d7a1e'; }
                                    }
                                    if (pos) {
                                        circle.setAttribute('cx', pos.svgX);
                                        circle.setAttribute('cy', pos.svgY);
                                        if (label) { label.setAttribute('x', pos.svgX + 16); label.setAttribute('y', pos.svgY + 5); }
                                    }
                                }
                                // ── Biosensor frame ────────────────────────
                                if (d.hr_bpm !== undefined) {
                                    const el = document.getElementById('hud-hr');
                                    if (el) {
                                        el.textContent = d.hr_bpm.toFixed(0);
                                        el.style.color = d.hr_bpm > 160 ? '#ff0000' : '#ff5c5c';
                                    }
                                }
                                if (d.spo2_pct !== undefined) {
                                    const el = document.getElementById('hud-spo2');
                                    if (el) {
                                        el.textContent = d.spo2_pct.toFixed(1);
                                        el.style.color = d.spo2_pct < 94 ? '#ff0000' : '#5cbcff';
                                    }
                                }
                                if (d.skin_temp_c !== undefined) {
                                    const el = document.getElementById('hud-temp');
                                    if (el) {
                                        el.textContent = d.skin_temp_c.toFixed(1);
                                        el.style.color = d.skin_temp_c > 38.5 ? '#ff0000' : '#ffaa00';
                                    }
                                }
                            } catch (e) { /* non-EVA frame */ }
                        };
                    },
                    destroy: function () {
                        if (socket) socket.close();
                    }
                };
            }
        };

        openmct.objectViews.addProvider(EvaTrackViewProvider);

        // Auto-add root object
        openmct.objects.addRoot({ namespace: 'imm.taxonomy', key: 'imm.eva' });
        openmct.objects.addProvider('imm.taxonomy', {
            get: function (identifier) {
                if (identifier.key === 'imm.eva') {
                    return Promise.resolve({
                        identifier,
                        name: 'EVA Position Tracker',
                        type: 'imm.eva.map',
                        location: 'ROOT'
                    });
                }
            }
        });
    };
}
