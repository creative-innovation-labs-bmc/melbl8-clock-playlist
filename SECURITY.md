# Security notes

This project intentionally has no backend, authentication, analytics, third-party JavaScript or remote assets.

The URL allow-list is enforced in `playlist-core.js` and the browser Content Security Policy in `index.html`. Do not widen either rule without reviewing the iframe threat model. In particular, do not add `allow-same-origin` to the clock iframe sandbox while the player and clock pages share the same GitHub Pages origin.
