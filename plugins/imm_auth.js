/*
 * IMM-OS OpenMCT login (Keycloak, IndiaMoonMars realm, public PKCE client
 * imm-frontend — the same client as the crew web app).
 *
 * All plugin traffic to IMM-OS APIs goes through this module:
 *   IMM_AUTH.fetch(url, init)          fetch() with a fresh Bearer token
 *   IMM_AUTH.authenticateSocket(ws)    sends {"type":"auth","token":...} as the
 *                                      first message; /api/realtime drops
 *                                      sockets that don't (close code 4401)
 *   IMM_AUTH.username()                logged-in operator (token preferred_username)
 */
const IMM_AUTH = (function () {
    const keycloak = new Keycloak({
        url: window.location.origin + '/auth',
        realm: 'IndiaMoonMars',
        clientId: 'imm-frontend'
    });

    async function freshToken() {
        try {
            await keycloak.updateToken(30);
        } catch (e) {
            keycloak.login();
            throw new Error('Session expired');
        }
        return keycloak.token;
    }

    return {
        init: function () {
            return keycloak.init({ onLoad: 'login-required', pkceMethod: 'S256', checkLoginIframe: false });
        },
        username: function () {
            return (keycloak.tokenParsed && keycloak.tokenParsed.preferred_username) || '';
        },
        logout: function () {
            keycloak.logout({ redirectUri: window.location.href });
        },
        fetch: async function (input, init) {
            init = init || {};
            const headers = new Headers(init.headers || {});
            headers.set('Authorization', 'Bearer ' + await freshToken());
            return fetch(input, Object.assign({}, init, { headers: headers }));
        },
        authenticateSocket: function (socket) {
            socket.addEventListener('open', function () {
                freshToken()
                    .then(function (token) { socket.send(JSON.stringify({ type: 'auth', token: token })); })
                    .catch(function (e) { console.error('IMM realtime auth failed', e); socket.close(); });
            });
            socket.addEventListener('close', function (event) {
                if (event.code === 4401) console.error('IMM realtime socket rejected: not authorised');
            });
            return socket;
        }
    };
})();
