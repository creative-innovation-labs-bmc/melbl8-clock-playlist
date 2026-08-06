'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../playlist-core.js');

const file = path.join(__dirname, '..', 'playlist.json');
const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const clean = Core.sanitiseConfig(raw, { defaultDuration: 60, transitionMs: 350, preloadSeconds: 4, clocks: [] });

assert.equal(raw.version, 1, 'playlist.json version must be 1');
assert.ok(Array.isArray(raw.clocks), 'playlist.json clocks must be an array');
assert.ok(clean.clocks.length > 0, 'playlist.json must contain at least one clock');
assert.ok(clean.clocks.some((clock) => clock.enabled), 'playlist.json must contain at least one enabled clock');
assert.equal(clean.clocks.length, raw.clocks.length, 'every clock entry must validate');
clean.clocks.forEach((clock) => assert.ok(clock.url.startsWith(Core.ALLOWED_BASE), `${clock.name} must use the approved base`));

console.log(`Published playlist validated: ${clean.clocks.length} clocks, ${clean.clocks.filter((clock) => clock.enabled).length} enabled.`);
