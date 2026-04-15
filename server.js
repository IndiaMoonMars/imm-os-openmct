const express = require('express');
const path = require('path');
const openmctDir = path.dirname(require.resolve('openmct'));

const app = express();
const PORT = process.env.PORT || 8080;

// Serve the OpenMCT framework
app.use('/openmct', express.static(openmctDir));

// Serve our custom plugins and assets
app.use('/plugins', express.static(path.join(__dirname, 'plugins')));

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`IMM-OS OpenMCT server running on port ${PORT}`);
});
