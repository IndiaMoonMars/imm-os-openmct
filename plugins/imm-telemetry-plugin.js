function IMMTelemetryPlugin() {
    return function install(openmct) {
        console.log("IMM Telemetry Plugin loaded.");
        
        // Define a domain object type for our sensors
        openmct.types.addType('imm.sensor', {
            name: 'IMM Sensor',
            description: 'A telemetry point from India Moon Mars OS',
            cssClass: 'icon-telemetry'
        });

        // Object provider: returns the telemetry dictionary objects
        openmct.objects.addRoot({
            namespace: 'imm.taxonomy',
            key: 'spacecraft'
        });

        openmct.objects.addProvider('imm.taxonomy', {
            get: function (identifier) {
                if (identifier.key === 'spacecraft') {
                    return Promise.resolve({
                        identifier: identifier,
                        name: 'Habitat & Compute Nodes',
                        type: 'folder',
                        location: 'ROOT'
                    });
                }
                return Promise.resolve(null);
            }
        });

        // Telemetry provider (STUB - phase 0)
        openmct.telemetry.addProvider({
            supportsRequest: function (domainObject) {
                return domainObject.type === 'imm.sensor';
            },
            request: function (domainObject, options) {
                // Call /api/telemetry/{node_id}/history in real implementation
                return Promise.resolve([]);
            },
            supportsSubscribe: function (domainObject) {
                return domainObject.type === 'imm.sensor';
            },
            subscribe: function (domainObject, callback) {
                // Connect to websocket or poll /api/telemetry/latest
                const interval = setInterval(() => {
                    // Poll stub
                }, 5000);
                return function unsubscribe() {
                    clearInterval(interval);
                };
            }
        });
    };
}
