# gydesrv: a backend for GYDE

This serves up the static resources for GYDE (assuming you've done `npm run build` in the
`gystab` directory), and handles proxying API requests to Slivka.

Basic operation:

    npm install
    export GYDE_HOST=0.0.0.0   # Or alternative address to bind, default is localhost
    node index.js
    open http://localhost:3030/

# Environment variables:

`GYDE_HOST` address to bind for listening socket (default 127.0.0.1, should generally be
set to 0.0.0.0 if you expect others to connect).

`GYDE_PORT` port to bind listening socket (default 3030)

`GYDE_SLIVKA_URL` URL for Slivka backend

`GYDE_MONGO_CONNECTION` Connection string for MongoDB

`GYDE_STATIC_DIR` Directory from which to serve static content (default `../gyde-frontend/build`)


## Login/security variables

You should be able to log in to GYDE using any OAuth2-based system.  Development has mostly focussed
on AWS Cognito, but others should work.

`GYDE_MOCK_USER` Fake user-name for local/test configs.  Disables login system is set.

`GYDE_OAUTH_BASE_URI` URL where GYDE is running, for OAuth redirects.  If not set, we'll try
to infer something -- but better to be explicit!

`GYDE_OAUTH_ISSUER` URL of your OAuth server

`GYDE_OAUTH_CLIENT` Client ID with your authentication provider

`GYDE_OUATH_SECRET` Client secret
