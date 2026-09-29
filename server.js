const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// Trust Nginx Proxy Headers
app.set('trust proxy', true);

// Login happens in the browser (keycloak-js, see plugins/imm_auth.js) and every
// data request carries the operator's token, which the IMM-OS APIs verify.
// This server only hands out static assets, so serve just what the page needs
// (not the whole app directory).
app.use('/openmct', express.static(path.join(__dirname, 'node_modules/openmct/dist')));
app.use('/keycloak', express.static(path.join(__dirname, 'node_modules/keycloak-js/dist')));
app.use('/plugins', express.static(path.join(__dirname, 'plugins')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`IMM-OS OpenMCT Server running on port ${port}`);
});
