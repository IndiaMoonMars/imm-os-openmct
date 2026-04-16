function IMM_EclssMapPlugin() {
    return function install(openmct) {
        
        openmct.types.addType('imm.eclss.map', {
            name: 'Habitat ECLSS Map',
            description: 'Topological SVG Map evaluating spatial telemetry dynamics',
            cssClass: 'icon-object'
        });

        const MapViewProvider = {
            key: 'imm.eclss.view',
            name: 'ECLSS Topographic View',
            cssClass: 'icon-object',
            canView: function (domainObject) {
                return domainObject.type === 'imm.eclss.map';
            },
            view: function (domainObject, objectPath) {
                let socket;
                return {
                    show: function (container) {
                        const svgMap = `
                            <div style="background:#111; width:100%; height:100%; display:flex; justify-content:center; align-items:center;">
                                <svg width="600" height="400" viewBox="0 0 600 400" style="border: 2px solid #555;">
                                    <rect x="50" y="50" width="200" height="300" fill="#222" stroke="#fff" stroke-width="2"/>
                                    <text x="150" y="200" fill="#fff" text-anchor="middle" font-size="20">Zone 1 (Core)</text>
                                    <circle id="z1-temp-ind" cx="150" cy="230" r="15" fill="green" />
                                    
                                    <rect x="250" y="100" width="300" height="200" fill="#222" stroke="#fff" stroke-width="2"/>
                                    <text x="400" y="200" fill="#fff" text-anchor="middle" font-size="20">Zone 2 (Airlock)</text>
                                    <circle id="z2-temp-ind" cx="400" cy="230" r="15" fill="green" />

                                    <path d="M 250 150 L 250 250" stroke="orange" stroke-width="4" stroke-dasharray="5,5"/>
                                </svg>
                                <div style="position:absolute; top:20px; left:20px; color:#fff; font-family:sans-serif;">
                                    <h3>Thermal Distribution Map</h3>
                                </div>
                            </div>
                        `;
                        container.innerHTML = svgMap;

                        // Tie to realtime WebSocket manually to drive color shift 
                        let socketUrl = `ws://${window.location.host}/api/realtime`;
                        socket = new WebSocket(socketUrl);
                        socket.onmessage = function (event) {
                            let msg = JSON.parse(event.data);
                            let py_envelope = msg.data;
                            if(py_envelope.temp) {
                                // Temperature color bounds mapping logic
                                let t = py_envelope.temp;
                                let color = "green";
                                if(t > 30) color = "red";
                                else if (t < 15) color = "blue";
                                
                                // Assuming zone is provided, else fallback mapping
                                let targetCircle = "z1-temp-ind"; 
                                if(py_envelope.zone === "zone2") targetCircle = "z2-temp-ind";
                                
                                let el = document.getElementById(targetCircle);
                                if(el) el.setAttribute("fill", color);
                            }
                        };
                    },
                    destroy: function () {
                        if(socket) socket.close();
                    }
                };
            }
        };

        openmct.objectViews.addProvider(MapViewProvider);
        
        // Auto-add default map object root
        openmct.objects.addRoot({
            namespace: 'imm.taxonomy',
            key: 'imm.eclss'
        });
        
        openmct.objects.addProvider('imm.taxonomy', {
            get: function(identifier) {
                if (identifier.key === 'imm.eclss') {
                    return Promise.resolve({
                        identifier: identifier,
                        name: 'ECLSS Thermal Map',
                        type: 'imm.eclss.map',
                        location: 'ROOT'
                    });
                }
            }
        });
    };
}
