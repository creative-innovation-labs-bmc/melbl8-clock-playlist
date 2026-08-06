(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClockPlaylistCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ALLOWED_ORIGIN = 'https://creative-innovation-labs-bmc.github.io';
  const ALLOWED_BASE = `${ALLOWED_ORIGIN}/`;
  const MIN_DURATION = 10;
  const MAX_DURATION = 3600;

  function normaliseUrl(input) {
    if (typeof input !== 'string') throw new Error('URL must be text.');
    const raw = input.trim();
    if (!raw) throw new Error('URL is required.');
    if (raw.length > 500) throw new Error('URL is too long.');

    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error('Enter a complete HTTPS URL.');
    }

    if (parsed.protocol !== 'https:') throw new Error('Only HTTPS URLs are allowed.');
    if (parsed.origin !== ALLOWED_ORIGIN) throw new Error(`Only ${ALLOWED_BASE} links are allowed.`);
    if (parsed.username || parsed.password || parsed.port) throw new Error('Credentials and custom ports are not allowed.');
    if (!parsed.pathname.startsWith('/') || parsed.pathname.startsWith('//')) throw new Error('Invalid GitHub Pages path.');

    const decodedPath = safelyDecode(parsed.pathname);
    if (/\\|\u0000|[\u0000-\u001F\u007F]/.test(decodedPath)) throw new Error('Invalid characters in URL path.');
    if (decodedPath === '/' || decodedPath.split('/').filter(Boolean).length < 1) throw new Error('A repository path is required.');

    parsed.hash = '';
    return parsed.href;
  }

  function safelyDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      throw new Error('URL contains invalid encoding.');
    }
  }

  function clampDuration(value, fallback) {
    const fallbackValue = Number.isFinite(Number(fallback)) ? Number(fallback) : 60;
    const number = Number(value);
    if (!Number.isFinite(number)) return Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(fallbackValue)));
    return Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(number)));
  }

  function makeId(seed) {
    const base = String(seed || 'clock').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'clock';
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${base}-${suffix}`;
  }

  function sanitiseClock(clock, fallbackDuration) {
    if (!clock || typeof clock !== 'object') throw new Error('Clock entry is invalid.');
    const name = String(clock.name || '').trim().slice(0, 100);
    if (!name) throw new Error('Clock name is required.');
    return {
      id: String(clock.id || makeId(name)).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || makeId(name),
      name,
      url: normaliseUrl(clock.url),
      duration: clampDuration(clock.duration, fallbackDuration),
      enabled: clock.enabled !== false
    };
  }

  function sanitiseConfig(input, fallbackConfig) {
    const fallback = fallbackConfig && typeof fallbackConfig === 'object' ? fallbackConfig : {};
    const defaultDuration = clampDuration(input && input.defaultDuration, fallback.defaultDuration || 60);
    const source = input && Array.isArray(input.clocks) ? input.clocks : [];
    const clocks = [];
    const used = new Set();

    source.forEach((clock) => {
      const clean = sanitiseClock(clock, defaultDuration);
      let id = clean.id;
      while (used.has(id)) id = makeId(clean.name);
      used.add(id);
      clocks.push({ ...clean, id });
    });

    return {
      version: 1,
      defaultDuration,
      transitionMs: boundedNumber(input && input.transitionMs, fallback.transitionMs, 350, 0, 2000),
      preloadSeconds: boundedNumber(input && input.preloadSeconds, fallback.preloadSeconds, 4, 0, 15),
      clocks
    };
  }

  function boundedNumber(value, fallbackValue, defaultValue, minimum, maximum) {
    const candidates = [value, fallbackValue, defaultValue];
    let number = defaultValue;
    for (const candidate of candidates) {
      if (candidate !== '' && candidate !== null && candidate !== undefined && Number.isFinite(Number(candidate))) {
        number = Number(candidate);
        break;
      }
    }
    return Math.min(maximum, Math.max(minimum, Math.round(number)));
  }

  function shuffle(values, randomFn) {
    const random = typeof randomFn === 'function' ? randomFn : Math.random;
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function buildShuffleBag(clocks, lastId, randomFn) {
    const enabledIds = clocks.filter((clock) => clock.enabled).map((clock) => clock.id);
    if (enabledIds.length < 2) return enabledIds;
    let bag = shuffle(enabledIds, randomFn);
    if (bag[0] === lastId) {
      const swapIndex = bag.findIndex((id) => id !== lastId);
      if (swapIndex > 0) [bag[0], bag[swapIndex]] = [bag[swapIndex], bag[0]];
    }
    return bag;
  }

  return {
    ALLOWED_BASE,
    ALLOWED_ORIGIN,
    MIN_DURATION,
    MAX_DURATION,
    normaliseUrl,
    clampDuration,
    sanitiseClock,
    sanitiseConfig,
    shuffle,
    buildShuffleBag
  };
});
