function IMM_AlertsPlugin() {
    return function install(openmct) {
        console.log("IMM Alerts Plugin Initialized");
        
        let lastChecked = Math.floor(Date.now() / 1000) - 30; // Check last 30 seconds initially
        
        function pollAlerts() {
            fetch(`/api/alerts?since=${lastChecked}`)
                .then(r => r.json())
                .then(alerts => {
                    alerts.forEach(alert => {
                        openmct.notifications.error(`CRITICAL ALARM: ${alert.sensor} (${alert.metric}) threshold breached! Value: ${parseFloat(alert.value).toFixed(2)}, Z-Score: ${parseFloat(alert.zscore).toFixed(2)}`);
                    });
                    lastChecked = Math.floor(Date.now() / 1000); // Reset bound
                })
                .catch(e => console.error("Alert poller failed: ", e));
        }

        // Poll every 5 seconds for new InfluxDB habitat_alerts anomalies
        setInterval(pollAlerts, 5000);
    };
}
