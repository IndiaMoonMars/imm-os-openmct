function IMM_CustomAdapter() {
    return function install(openmct) {
        
        // One stream per sensor metric in the IMM telemetry schema
        // (imm-os-backend services/telemetry_schema.py). Sensor names can contain '_'
        // (ecg_ad8232), so each stream names its sensor and metric explicitly. A stream
        // with a zone only shows that zone's readings (e.g. the compute node's health).
        const SENSOR_STREAM_MAPPING = [
            { sensor: "bme280", metric: "temp", name: "BME280 Temperature", units: "°C" },
            { sensor: "bme280", metric: "hum", name: "BME280 Humidity", units: "%" },
            { sensor: "bme280", metric: "pres", name: "BME280 Pressure", units: "hPa" },
            { sensor: "scd40", metric: "co2_ppm", name: "SCD40 CO2", units: "ppm" },
            { sensor: "scd40", metric: "temp", name: "SCD40 Temperature", units: "°C" },
            { sensor: "scd40", metric: "hum", name: "SCD40 Humidity", units: "%" },
            { sensor: "o2", metric: "o2_pct", name: "Oxygen", units: "%" },
            { sensor: "mq7", metric: "co_ppm", name: "MQ7 CO", units: "ppm" },
            { sensor: "max30100", metric: "hr_bpm", name: "Heart Rate", units: "BPM" },
            { sensor: "max30100", metric: "spo2_pct", name: "SpO2", units: "%" },
            { sensor: "ecg_ad8232", metric: "voltage", name: "ECG Voltage", units: "V" },
            { sensor: "tsl2561", metric: "lux", name: "Illuminance", units: "lux" },
            { sensor: "ina219", metric: "voltage_v", name: "Power System Voltage", units: "V" },
            { sensor: "ina219", metric: "current_ma", name: "Power System Current", units: "mA" },
            { sensor: "ina219", metric: "power_mw", name: "Power Consumption", units: "mW" },
            { sensor: "sysmon", metric: "cpu_temp", zone: "compute", name: "Compute Node (Pi 5) SoC Temperature", units: "°C" },
            { sensor: "sysmon", metric: "power_w", zone: "compute", name: "Compute Node (Pi 5) Power", units: "W" },
            { sensor: "sysmon", metric: "supply_v", zone: "compute", name: "Compute Node (Pi 5) 5 V Supply", units: "V" },
            { sensor: "sysmon", metric: "cpu_load", zone: "compute", name: "Compute Node (Pi 5) CPU Load", units: "%" },
            { sensor: "sysmon", metric: "fan_rpm", zone: "compute", name: "Compute Node (Pi 5) Fan", units: "rpm" },
            { sensor: "sysmon", metric: "cpu_temp", zone: "zone_a", name: "Zone A Node SoC Temperature", units: "°C" },
            { sensor: "sysmon", metric: "cpu_temp", zone: "zone_b", name: "Zone B Node SoC Temperature", units: "°C" },
            { sensor: "bms", metric: "battery_pct", name: "Battery State of Charge", units: "%" },
            { sensor: "bms", metric: "solar_w", name: "Solar Input", units: "W" }
        ].map(s => Object.assign({ id: `${s.sensor}_${s.metric}` + (s.zone ? `_${s.zone}` : '') }, s));

        const streamFor = key => SENSOR_STREAM_MAPPING.find(s => s.id === key);

        var objectProvider = {
            get: function (identifier) {
                if (identifier.key === 'imm.telemetry') {
                    return Promise.resolve({
                        identifier: identifier,
                        name: 'Habitat Telemetry',
                        type: 'folder',
                        location: 'ROOT'
                    });
                } else {
                    let matching = SENSOR_STREAM_MAPPING.find(s => s.id === identifier.key);
                    if (matching) {
                        return Promise.resolve({
                            identifier: identifier,
                            name: matching.name,
                            type: 'imm-sensor.telemetry',
                            telemetry: {
                                values: [
                                    {
                                        key: 'value',
                                        name: 'Value',
                                        units: matching.units,
                                        format: 'float',
                                        min: 0,
                                        max: 10000,
                                        hints: {
                                            range: 1
                                        }
                                    },
                                    {
                                        key: 'utc',
                                        source: 'timestamp',
                                        name: 'Timestamp',
                                        format: 'utc',
                                        hints: {
                                            domain: 1
                                        }
                                    }
                                ]
                            },
                            location: 'imm.telemetry:imm.telemetry'
                        });
                    }
                }
                return Promise.resolve(undefined);  // unknown stream id
            }
        };

        var compositionProvider = {
            appliesTo: function (domainObject) {
                return domainObject.identifier.namespace === 'imm.telemetry' &&
                       domainObject.type === 'folder';
            },
            load: function (domainObject) {
                return Promise.resolve(SENSOR_STREAM_MAPPING.map(s => {
                    return {
                        namespace: 'imm.telemetry',
                        key: s.id
                    };
                }));
            }
        };

        // Telemetry Provider hooks WebSockets + REST History API
        var telemetryProvider = {
            supportsRequest: function (domainObject) {
                return domainObject.type === 'imm-sensor.telemetry';
            },
            supportsSubscribe: function (domainObject) {
                return domainObject.type === 'imm-sensor.telemetry';
            },
            request: function (domainObject, options) {
                var start = options.start;
                var end = options.end;
                
                const stream = streamFor(domainObject.identifier.key);
                if (!stream) return Promise.resolve([]);
                var url = `/api/history?start=${Math.floor(start / 1000)}&end=${Math.ceil(end / 1000)}` +
                    `&sensor=${encodeURIComponent(stream.sensor)}&metric=${encodeURIComponent(stream.metric)}` +
                    (stream.zone ? `&zone=${encodeURIComponent(stream.zone)}` : '');
                return IMM_AUTH.fetch(url).then(function (response) {
                    return response.json();
                });
            },
            subscribe: function (domainObject, callback) {
                const stream = streamFor(domainObject.identifier.key);
                // WebSockets bind directly to the backend
                let socketUrl = `ws://${window.location.host}/api/realtime`;
                // Nginx usually strips or maps WS correctly. For dev environment directly hit port 8000 via proxy logic in Nginx '/api/realtime'
                var socket = IMM_AUTH.authenticateSocket(new WebSocket(socketUrl));
                
                socket.onmessage = function (event) {
                    let msg = JSON.parse(event.data);
                    let py_envelope = msg.data;
                    
                    if (stream && py_envelope && py_envelope.sensor === stream.sensor &&
                        (!stream.zone || py_envelope.zone === stream.zone)) {
                        if (py_envelope[stream.metric] !== undefined) {
                            var point = {
                                timestamp: py_envelope.timestamp * 1000,
                                value: py_envelope[stream.metric],
                                id: domainObject.identifier.key
                            };
                            callback(point);
                        }
                    }
                };

                return function unsubscribe() {
                    socket.close();
                };
            }
        };

        openmct.objects.addRoot({
            namespace: 'imm.telemetry',
            key: 'imm.telemetry'
        });
        
        openmct.objects.addProvider('imm.telemetry', objectProvider);
        openmct.composition.addProvider(compositionProvider);
        
        openmct.types.addType('imm-sensor.telemetry', {
            name: 'Habitat Sensor',
            description: 'A single metric stream from the IMM edge sensors',
            cssClass: 'icon-telemetry'
        });

        openmct.telemetry.addProvider(telemetryProvider);
    };
}
