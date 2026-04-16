const express = require('express');
const { auth, requiresAuth } = require('express-openid-connect');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// Keycloak Auth config
const config = {
  authRequired: true,
  auth0Logout: true,
  secret: process.env.OIDC_SECRET || 'a-long-random-secret-string-for-imm-os-secure-session',
  baseURL: process.env.BASE_URL || 'http://localhost/openmct',
  clientID: 'openmct-client',
  issuerBaseURL: 'http://keycloak:8080/realms/IndiaMoonMars'
};

// Trust Nginx Proxy Headers
app.set('trust proxy', true);

// Skip Auth locally if disabled (useful for dev if keycloak isn't populated yet)
if (process.env.SKIP_AUTH !== 'true') {
  app.use(auth(config));
  app.use(requiresAuth());
}

// Serve OpenMCT dist
app.use('/openmct', express.static(path.join(__dirname, 'node_modules/openmct/dist')));
// Serve local project files (index.html, plugins directory)
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`IMM-OS OpenMCT Server running on port ${port}`);
});
