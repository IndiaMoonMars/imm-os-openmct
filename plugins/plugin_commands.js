function IMM_CommandsPlugin() {
    return function install(openmct) {
        
        openmct.types.addType('imm.command.interface', {
            name: 'Command Uplink',
            description: 'Send manual commands to the Habitat network',
            cssClass: 'icon-terminal'
        });
        
        const CommandViewProvider = {
            key: 'imm.command.view',
            name: 'Command Terminal',
            cssClass: 'icon-terminal',
            canView: function (domainObject) {
                return domainObject.type === 'imm.command.interface';
            },
            view: function (domainObject, objectPath) {
                let component;
                return {
                    show: function (container) {
                        const template = `
                            <div style="padding: 20px; color: #fff; background: #222; height: 100%; border-radius: 5px;">
                                <h2>MCC Command Uplink</h2>
                                <p>Transmit override instructions directly to IMM nodes via Postgres Relay.</p>
                                <hr style="border-color: #444; margin-bottom: 20px;">
                                
                                <div style="margin-bottom: 15px;">
                                    <label>Operator (logged in):</label><br>
                                    <input type="text" id="cmd-operator" readonly value="" style="width: 100%; padding: 8px; margin-top: 5px; background: #111; color: #0f0; border: 1px solid #555;">
                                </div>
                                <div style="margin-bottom: 15px;">
                                    <label>Command Payload:</label><br>
                                    <textarea id="cmd-payload" rows="4" style="width: 100%; padding: 8px; margin-top: 5px; background: #111; color: #0f0; border: 1px solid #555;"></textarea>
                                </div>
                                <button id="cmd-send" style="padding: 10px 20px; background: #0078D7; color: white; border: none; cursor: pointer; font-weight: bold;">TRANSMIT</button>
                                <div id="cmd-status" style="margin-top: 15px; font-weight: bold; color: orange;"></div>
                            </div>
                        `;
                        container.innerHTML = template;
                        document.getElementById('cmd-operator').value = IMM_AUTH.username();
                        
                        document.getElementById('cmd-send').addEventListener('click', () => {
                            const payload = document.getElementById('cmd-payload').value;
                            const statusEl = document.getElementById('cmd-status');
                            
                            statusEl.innerText = "Transmitting to deep space...";
                            
                            IMM_AUTH.fetch('/api/commands', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                // operator is taken from the token server-side
                                body: JSON.stringify({ command_text: payload })
                            }).then(res => {
                                if (res.ok) {
                                    statusEl.innerText = "✓ Command ingested successfully into PG Log.";
                                    statusEl.style.color = "lime";
                                    document.getElementById('cmd-payload').value = '';
                                } else {
                                    statusEl.innerText = "✗ Transmission failed.";
                                    statusEl.style.color = "red";
                                }
                            }).catch(err => {
                                statusEl.innerText = "✗ Network Drop.";
                                statusEl.style.color = "red";
                            });
                        });
                    },
                    destroy: function () {
                        // cleanup
                    }
                };
            }
        };

        openmct.objectViews.addProvider(CommandViewProvider);
        
        // Auto-add default object
        openmct.objects.addRoot({
            namespace: 'imm.taxonomy',
            key: 'imm.uplink'
        });
        
        openmct.objects.addProvider('imm.taxonomy', {
            get: function(identifier) {
                if (identifier.key === 'imm.uplink') {
                    return Promise.resolve({
                        identifier: identifier,
                        name: 'Uplink Terminal',
                        type: 'imm.command.interface',
                        location: 'ROOT'
                    });
                }
            }
        });
    };
}
