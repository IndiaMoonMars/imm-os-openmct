function IMM_CustomAdapter() {
    return function install(openmct) {
        
        const SENSOR_STREAM_MAPPING = [
            { id: "bme280_temp", name: "BME280 Temperature", units: "°C" },
            { id: "bme280_hum", name: "BME280 Humidity", units: "%" },
            { id: "bme280_pres", name: "BME280 Pressure", units: "hPa" },
            { id: "scd40_co2_ppm", name: "SCD40 CO2", units: "ppm" },
            { id: "scd40_temp", name: "SCD40 Temperature", units: "°C" },
            { id: "scd40_hum", name: "SCD40 Humidity", units: "%" },
            { id: "mq7_co_ppm", name: "MQ7 CO", units: "ppm" },
            { id: "max30100_hr_bpm", name: "Heart Rate", units: "BPM" },
            { id: "max30100_spo2_pct", name: "SpO2", units: "%" },
            { id: "ecg_ad8232_voltage", name: "ECG Voltage", units: "V" },
            { id: "tsl2561_lux", name: "Illuminance", units: "lux" },
            { id: "ina219_voltage_v", name: "Power System Voltage", units: "V" },
            { id: "ina219_current_ma", name: "Power System Current", units: "mA" },
            { id: "ina219_power_mw", name: "Power Consumption", units: "mW" }
        ];

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
                            location: 'imm.taxonomy:imm.telemetry'
                        });
                    }
                }
            }
        };

        var compositionProvider = {
            appliesTo: function (domainObject) {
                return domainObject.identifier.namespace === 'imm.taxonomy' &&
                       domainObject.type === 'folder';
            },
            load: function (domainObject) {
                return Promise.resolve(SENSOR_STREAM_MAPPING.map(s => {
                    return {
                        namespace: 'imm.taxonomy',
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
                
                // Parse key
                let parts = domainObject.identifier.key.split('_');
                let sensor = parts[0];
                let metric = parts.slice(1).join('_');

                var url = `/api/history?start=${start}&end=${end}&sensor=${sensor}&metric=${metric}`;
                return fetch(url).then(function (response) {
                    return response.json();
                });
            },
            subscribe: function (domainObject, callback) {
                let parts = domainObject.identifier.key.split('_');
                let sensorFilter = parts[0];
                // WebSockets bind directly to the backend
                let socketUrl = `ws://${window.location.host}/api/realtime`;
                // Nginx usually strips or maps WS correctly. For dev environment directly hit port 8000 via proxy logic in Nginx '/api/realtime'
                var socket = new WebSocket(socketUrl);
                
                socket.onmessage = function (event) {
                    let msg = JSON.parse(event.data);
                    let py_envelope = msg.data;
                    
                    if (py_envelope && py_envelope.sensor === sensorFilter) {
                        // Check if the specific metric passed is in the payload
                        let metricFilter = parts.slice(1).join('_');
                        if (py_envelope[metricFilter] !== undefined) {
                            var point = {
                                timestamp: py_envelope.timestamp * 1000,
                                value: py_envelope[metricFilter],
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
            namespace: 'imm.taxonomy',
            key: 'imm.telemetry'
        });
        
        openmct.objects.addProvider('imm.taxonomy', objectProvider);
        openmct.composition.addProvider(compositionProvider);
        
        openmct.types.addType('imm-sensor.telemetry', {
            name: 'Habitat Sensor',
            description: 'A single metric stream from the IMM edge sensors',
            cssClass: 'icon-telemetry'
        });

        openmct.telemetry.addProvider(telemetryProvider);
    };
}
