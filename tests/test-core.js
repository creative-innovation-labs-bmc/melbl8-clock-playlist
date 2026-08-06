'use strict';
const assert = require('node:assert/strict');
const Core = require('../playlist-core.js');

const approved = 'https://creative-innovation-labs-bmc.github.io/Melbl8-Clock04-PT-Serif/';
assert.equal(Core.normaliseUrl(approved), approved);
assert.equal(Core.normaliseUrl(`${approved}#test`), approved);

const rejected = [
  'http://creative-innovation-labs-bmc.github.io/test/',
  'https://evil.example/test/',
  'javascript:alert(1)',
  'data:text/html,hello',
  '/relative/path',
  'https://creative-innovation-labs-bmc.github.io.evil.example/test/',
  'https://user@creative-innovation-labs-bmc.github.io/test/',
  'https://creative-innovation-labs-bmc.github.io:444/test/',
  'https://creative-innovation-labs-bmc.github.io/'
];
rejected.forEach((url) => assert.throws(() => Core.normaliseUrl(url), url));

assert.equal(Core.clampDuration(2, 60), 10);
assert.equal(Core.clampDuration(9999, 60), 3600);
assert.equal(Core.clampDuration('75', 60), 75);

const clocks = [
  { id: 'a', name: 'A', url: `${Core.ALLOWED_BASE}a/`, duration: 60, enabled: true },
  { id: 'b', name: 'B', url: `${Core.ALLOWED_BASE}b/`, duration: 60, enabled: true },
  { id: 'c', name: 'C', url: `${Core.ALLOWED_BASE}c/`, duration: 60, enabled: false }
];
const bag = Core.buildShuffleBag(clocks, 'a', () => 0.99);
assert.deepEqual(new Set(bag), new Set(['a', 'b']));
assert.notEqual(bag[0], 'a');
assert.equal(bag.length, 2);

const clean = Core.sanitiseConfig({ defaultDuration: 60, clocks }, { defaultDuration: 60 });
assert.equal(clean.clocks.length, 3);
assert.equal(clean.defaultDuration, 60);
console.log('Core playlist tests passed.');
