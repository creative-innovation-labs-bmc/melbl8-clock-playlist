(function () {
  'use strict';

  const Core = window.ClockPlaylistCore;
  const CONFIG_URL = 'playlist.json';
  const CONFIG_REFRESH_MS = 5 * 60 * 1000;
  const FALLBACKS = Object.freeze({ defaultDuration: 60, transitionMs: 350, preloadSeconds: 4, clocks: [] });

  const elements = {
    frames: [document.getElementById('frame-a'), document.getElementById('frame-b')],
    statusCard: document.getElementById('status-card'),
    statusTitle: document.getElementById('status-title'),
    statusDetail: document.getElementById('status-detail')
  };

  let config = null;
  let configSignature = '';
  let queue = [];
  let currentClock = null;
  let lastPlayedId = null;
  let activeFrameIndex = 0;
  let preloaded = null;
  let deadline = 0;
  let tickTimer = 0;
  let refreshTimer = 0;
  let transitionToken = 0;

  initialise();

  async function initialise() {
    try {
      await refreshPublishedConfig(true);
      refreshTimer = window.setInterval(() => refreshPublishedConfig(false), CONFIG_REFRESH_MS);
    } catch (error) {
      showStatus('Playlist unavailable', error.message);
      console.error(error);
    }
  }

  async function refreshPublishedConfig(initialLoad) {
    try {
      const response = await fetch(`${CONFIG_URL}?v=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer'
      });
      if (!response.ok) throw new Error(`Published playlist returned HTTP ${response.status}.`);
      const raw = await response.json();
      const clean = Core.sanitiseConfig(raw, FALLBACKS);
      if (!clean.clocks.length) throw new Error('Published playlist contains no clock entries.');
      if (!clean.clocks.some((clock) => clock.enabled)) throw new Error('Published playlist has no enabled clocks.');

      const nextSignature = JSON.stringify(clean);
      if (nextSignature === configSignature) return;

      config = clean;
      configSignature = nextSignature;
      document.documentElement.style.setProperty('--transition-ms', `${config.transitionMs}ms`);
      startPlaylist();
    } catch (error) {
      if (initialLoad || !config) throw error;
      console.warn('Playlist refresh rejected. Continuing with the last valid published configuration.', error);
    }
  }

  function startPlaylist() {
    window.clearInterval(tickTimer);
    queue = [];
    currentClock = null;
    lastPlayedId = null;
    preloaded = null;
    deadline = 0;
    transitionToken += 1;
    elements.frames.forEach(clearFrame);
    hideStatus();
    playNext();
    tickTimer = window.setInterval(tick, 250);
  }

  function playNext() {
    const candidates = config.clocks.filter((clock) => clock.enabled);
    if (!candidates.length) {
      showStatus('No clocks enabled', 'The published playlist contains no enabled clocks.');
      return;
    }
    if (!queue.length) queue = Core.buildShuffleBag(candidates, lastPlayedId);
    const nextId = queue.shift();
    const next = candidates.find((clock) => clock.id === nextId);
    if (!next) {
      queue = [];
      window.setTimeout(playNext, 250);
      return;
    }
    transitionTo(next);
  }

  function transitionTo(clock) {
    const token = ++transitionToken;
    const targetIndex = preloaded && preloaded.clock.id === clock.id ? preloaded.frameIndex : 1 - activeFrameIndex;
    const frame = elements.frames[targetIndex];
    const usePreloaded = Boolean(preloaded && preloaded.clock.id === clock.id && preloaded.ready);
    preloaded = null;

    const activate = function () {
      if (token !== transitionToken) return;
      const oldIndex = activeFrameIndex;
      activeFrameIndex = targetIndex;
      elements.frames[activeFrameIndex].classList.add('is-active');
      elements.frames[activeFrameIndex].classList.remove('is-loading');
      elements.frames[oldIndex].classList.remove('is-active', 'is-loading');
      window.setTimeout(() => {
        if (oldIndex !== activeFrameIndex) clearFrame(elements.frames[oldIndex]);
      }, config.transitionMs + 80);

      currentClock = clock;
      lastPlayedId = clock.id;
      deadline = Date.now() + clock.duration * 1000;
      hideStatus();
    };

    if (usePreloaded) {
      activate();
      return;
    }

    showStatus('Loading clock', clock.name);
    loadFrame(frame, clock, token).then(activate).catch((error) => {
      console.warn('Clock failed to load.', clock.url, error);
      if (token !== transitionToken) return;
      showStatus('Skipping unavailable clock', clock.name);
      window.setTimeout(playNext, 900);
    });
  }

  function loadFrame(frame, clock, token) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => finish(false), 15000);

      function finish(ok) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        frame.removeEventListener('load', onLoad);
        frame.removeEventListener('error', onError);
        if (token !== transitionToken && !frame.classList.contains('is-loading')) {
          reject(new Error('Superseded.'));
          return;
        }
        if (ok) resolve();
        else reject(new Error('Load timeout or frame error.'));
      }
      function onLoad() { finish(true); }
      function onError() { finish(false); }

      frame.addEventListener('load', onLoad, { once: true });
      frame.addEventListener('error', onError, { once: true });
      frame.classList.add('is-loading');
      try {
        frame.src = Core.normaliseUrl(clock.url);
      } catch (error) {
        finish(false);
      }
    });
  }

  function clearFrame(frame) {
    frame.classList.remove('is-active', 'is-loading');
    frame.removeAttribute('src');
  }

  function tick() {
    if (!currentClock) return;
    const remaining = Math.max(0, deadline - Date.now());
    if (!preloaded && queue.length && remaining <= config.preloadSeconds * 1000 && config.preloadSeconds > 0) preloadNext();
    if (remaining <= 0) playNext();
  }

  function preloadNext() {
    const nextId = queue[0];
    const clock = config.clocks.find((item) => item.enabled && item.id === nextId);
    if (!clock) return;
    const frameIndex = 1 - activeFrameIndex;
    const frame = elements.frames[frameIndex];
    const token = transitionToken;
    preloaded = { clock, frameIndex, ready: false };
    loadFrame(frame, clock, token).then(() => {
      if (preloaded && preloaded.clock.id === clock.id) preloaded.ready = true;
    }).catch(() => {
      if (preloaded && preloaded.clock.id === clock.id) preloaded = null;
    });
  }

  function showStatus(title, detail) {
    elements.statusTitle.textContent = title;
    elements.statusDetail.textContent = detail;
    elements.statusCard.hidden = false;
  }

  function hideStatus() {
    elements.statusCard.hidden = true;
  }
})();
