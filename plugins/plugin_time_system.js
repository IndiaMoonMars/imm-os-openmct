function IMM_TimeSystemPlugin() {
    return function install(openmct) {
        // Implement an OpenMCT Global Indicator for the Header Toolbar
        const timeIndicator = document.createElement('div');
        timeIndicator.className = 'c-indicator icon-clock';
        timeIndicator.style.display = 'flex';
        timeIndicator.style.alignItems = 'center';
        timeIndicator.style.gap = '8px';
        timeIndicator.style.padding = '0 10px';
        timeIndicator.style.fontWeight = 'bold';
        timeIndicator.style.fontSize = '1.1em';
        
        const textSpan = document.createElement('span');
        timeIndicator.appendChild(textSpan);
        
        let missionDayStr = "Mission Day 1";
        
        function updateTime() {
            // Fetch IST Time and Mission Day sequentially
            fetch('/time/api/v1/time/now')
                .then(r => r.json())
                .then(timeRes => {
                    const istString = String(timeRes.ist).split('+')[0]; // Strip tz suffix
                    // Roughly calculating Mission Day same as the backend telemetry_processor does
                    const epochSec = timeRes.unix_ts;
                    const missionDay = Math.max(1, Math.floor((epochSec - 1710000000) / 86400));
                    missionDayStr = `Mission Day ${missionDay}`;
                    
                    fetch('/time/api/v1/time/delay')
                        .then(r => r.json())
                        .then(delayRes => {
                            let modeText = "No Comm Delay";
                            if (delayRes.mode === 'mars') modeText = `Comm Delay: ~8 min (Mars)`;
                            if (delayRes.mode === 'moon') modeText = `Comm Delay: 1.28s (Moon)`;
                            if (delayRes.mode === 'custom') modeText = `Comm Delay: ${delayRes.value}s`;
                            
                            textSpan.innerHTML = `<span style="color:#00ff00;">${istString} IST</span> | <span style="color:#00ccff;">${missionDayStr}</span> | <span style="color:#ffcc00;">${modeText}</span>`;
                        });
                })
                .catch(e => console.error("Time Indicator Sync Error:", e));
        }

        // Install Indicator
        openmct.indicators.add({
            element: timeIndicator
        });

        // Trigger loop every second
        setInterval(updateTime, 1000);
        updateTime();
    };
}
