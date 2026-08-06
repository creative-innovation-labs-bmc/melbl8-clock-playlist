(function () {
  'use strict';

  const Core = window.ClockPlaylistCore;
  const defaults = Core.sanitiseConfig(window.CLOCK_PLAYLIST_DEFAULTS || {}, { defaultDuration: 60 });
  const STORAGE_KEY = 'melbl8-clock-playlist-config-v1';
  const isAdmin = new URLSearchParams(window.location.search).get('admin') === '1';

  const elements = {
    frames: [document.getElementById('frame-a'), document.getElementById('frame-b')],
    statusCard: document.getElementById('status-card'),
    statusTitle: document.getElementById('status-title'),
    statusDetail: document.getElementById('status-detail'),
    adminHud: document.getElementById('admin-hud'),
    hudName: document.getElementById('hud-name'),
    hudRemaining: document.getElementById('hud-remaining'),
    pauseButton: document.getElementById('pause-button'),
    nextButton: document.getElementById('next-button'),
    manageButton: document.getElementById('manage-button'),
    manager: document.getElementById('manager'),
    clockList: document.getElementById('clock-list'),
    rowTemplate: document.getElementById('clock-row-template'),
    addClockButton: document.getElementById('add-clock-button'),
    saveButton: document.getElementById('save-button'),
    resetButton: document.getElementById('reset-button'),
    exportButton: document.getElementById('export-button'),
    importInput: document.getElementById('import-input'),
    formMessage: document.getElementById('form-message'),
    defaultDuration: document.getElementById('default-duration'),
    transitionMs: document.getElementById('transition-ms'),
    preloadSeconds: document.getElementById('preload-seconds')
  };

  let config = loadConfig();
  let editConfig = clone(config);
  let queue = [];
  let currentClock = null;
  let lastPlayedId = null;
  let activeFrameIndex = 0;
  let preloaded = null;
  let deadline = 0;
  let remainingWhenPaused = 0;
  let paused = false;
  let tickTimer = 0;
  let transitionToken = 0;

  document.documentElement.style.setProperty('--transition-ms', `${config.transitionMs}ms`);
  if (isAdmin) elements.adminHud.hidden = false;

  bindEvents();
  startPlaylist();

  function loadConfig() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return clone(defaults);
      return Core.sanitiseConfig(JSON.parse(stored), defaults);
    } catch (error) {
      console.warn('Stored playlist was rejected.', error);
      return clone(defaults);
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function startPlaylist() {
    window.clearInterval(tickTimer);
    queue = [];
    currentClock = null;
    lastPlayedId = null;
    preloaded = null;
    paused = false;
    elements.pauseButton.textContent = 'Pause';
    elements.frames.forEach(clearFrame);
    const enabled = config.clocks.filter((clock) => clock.enabled);
    if (!enabled.length) {
      showStatus('No clocks enabled', isAdmin ? 'Open Manage to enable or add an approved clock.' : 'The playlist has no enabled clocks.');
      updateHud();
      return;
    }
    hideStatus();
    playNext();
    tickTimer = window.setInterval(tick, 250);
  }

  function playNext(forceId) {
    const candidates = config.clocks.filter((clock) => clock.enabled);
    if (!candidates.length) return startPlaylist();

    let next;
    if (forceId) next = candidates.find((clock) => clock.id === forceId);
    if (!next) {
      if (!queue.length) queue = Core.buildShuffleBag(candidates, lastPlayedId);
      const nextId = queue.shift();
      next = candidates.find((clock) => clock.id === nextId);
    }
    if (!next) return startPlaylist();

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
      remainingWhenPaused = clock.duration * 1000;
      paused = false;
      elements.pauseButton.textContent = 'Pause';
      updateHud();
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
      window.setTimeout(() => playNext(), 900);
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
        if (token !== transitionToken && !frame.classList.contains('is-loading')) return reject(new Error('Superseded.'));
        if (ok) resolve(); else reject(new Error('Load timeout or frame error.'));
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
    frame.src = 'about:blank';
  }

  function tick() {
    if (!currentClock || paused) return updateHud();
    const remaining = Math.max(0, deadline - Date.now());
    remainingWhenPaused = remaining;
    updateHud();

    if (!preloaded && queue.length && remaining <= config.preloadSeconds * 1000 && config.preloadSeconds > 0) {
      preloadNext();
    }
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

  function togglePause() {
    if (!currentClock) return;
    paused = !paused;
    if (paused) {
      remainingWhenPaused = Math.max(0, deadline - Date.now());
      elements.pauseButton.textContent = 'Resume';
    } else {
      deadline = Date.now() + remainingWhenPaused;
      elements.pauseButton.textContent = 'Pause';
    }
    updateHud();
  }

  function updateHud() {
    elements.hudName.textContent = currentClock ? currentClock.name : 'Not playing';
    const remaining = currentClock ? (paused ? remainingWhenPaused : Math.max(0, deadline - Date.now())) : 0;
    elements.hudRemaining.textContent = String(Math.ceil(remaining / 1000));
  }

  function showStatus(title, detail) {
    elements.statusTitle.textContent = title;
    elements.statusDetail.textContent = detail;
    elements.statusCard.hidden = false;
  }

  function hideStatus() {
    elements.statusCard.hidden = true;
  }

  function bindEvents() {
    elements.pauseButton.addEventListener('click', togglePause);
    elements.nextButton.addEventListener('click', () => playNext());
    elements.manageButton.addEventListener('click', openManager);
    elements.addClockButton.addEventListener('click', addClock);
    elements.saveButton.addEventListener('click', saveFromManager);
    elements.resetButton.addEventListener('click', resetDefaults);
    elements.exportButton.addEventListener('click', exportConfig);
    elements.importInput.addEventListener('change', importConfig);
    elements.clockList.addEventListener('click', handleListClick);
    elements.clockList.addEventListener('input', handleListInput);
    elements.manager.addEventListener('close', () => { editConfig = clone(config); });
    window.addEventListener('keydown', (event) => {
      if (isAdmin && event.key.toLowerCase() === 'm' && !elements.manager.open) openManager();
    });
  }

  function openManager() {
    editConfig = clone(config);
    renderManager();
    elements.manager.showModal();
  }

  function renderManager() {
    elements.defaultDuration.value = editConfig.defaultDuration;
    elements.transitionMs.value = editConfig.transitionMs;
    elements.preloadSeconds.value = editConfig.preloadSeconds;
    elements.clockList.replaceChildren();
    editConfig.clocks.forEach((clock, index) => elements.clockList.appendChild(makeRow(clock, index)));
    setMessage('');
  }

  function makeRow(clock, index) {
    const node = elements.rowTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.index = String(index);
    node.querySelector('[data-field="enabled"]').checked = clock.enabled;
    node.querySelector('[data-field="name"]').value = clock.name;
    node.querySelector('[data-field="url"]').value = clock.url;
    node.querySelector('[data-field="duration"]').value = clock.duration;
    return node;
  }

  function addClock() {
    const duration = Core.clampDuration(elements.defaultDuration.value, editConfig.defaultDuration);
    editConfig.clocks.push({
      id: `new-clock-${Date.now()}`,
      name: 'New clock',
      url: `${Core.ALLOWED_BASE}repository-name/`,
      duration,
      enabled: false
    });
    renderManager();
    const rows = elements.clockList.querySelectorAll('.clock-row');
    const last = rows[rows.length - 1];
    last.scrollIntoView({ block: 'center' });
    last.querySelector('[data-field="name"]').select();
  }

  function handleListInput(event) {
    const field = event.target.dataset.field;
    if (!field) return;
    const row = event.target.closest('.clock-row');
    const index = Number(row.dataset.index);
    const clock = editConfig.clocks[index];
    if (!clock) return;
    clock[field] = field === 'enabled' ? event.target.checked : event.target.value;
    validateRow(row, clock);
  }

  function handleListClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const row = button.closest('.clock-row');
    const index = Number(row.dataset.index);
    const action = button.dataset.action;
    if (action === 'delete') editConfig.clocks.splice(index, 1);
    if (action === 'up' && index > 0) [editConfig.clocks[index - 1], editConfig.clocks[index]] = [editConfig.clocks[index], editConfig.clocks[index - 1]];
    if (action === 'down' && index < editConfig.clocks.length - 1) [editConfig.clocks[index + 1], editConfig.clocks[index]] = [editConfig.clocks[index], editConfig.clocks[index + 1]];
    if (action === 'preview') {
      try {
        const candidate = Core.sanitiseClock(editConfig.clocks[index], editConfig.defaultDuration);
        candidate.enabled = true;
        elements.manager.close();
        transitionTo(candidate);
        return;
      } catch (error) {
        validateRow(row, editConfig.clocks[index]);
        return;
      }
    }
    renderManager();
  }

  function validateRow(row, clock) {
    const errorNode = row.querySelector('[data-role="error"]');
    const urlInput = row.querySelector('[data-field="url"]');
    try {
      Core.sanitiseClock(clock, editConfig.defaultDuration);
      errorNode.textContent = '';
      urlInput.removeAttribute('aria-invalid');
      return true;
    } catch (error) {
      errorNode.textContent = error.message;
      urlInput.setAttribute('aria-invalid', 'true');
      return false;
    }
  }

  function collectManagerConfig() {
    const candidate = {
      version: 1,
      defaultDuration: elements.defaultDuration.value,
      transitionMs: elements.transitionMs.value,
      preloadSeconds: elements.preloadSeconds.value,
      clocks: editConfig.clocks
    };
    const rows = [...elements.clockList.querySelectorAll('.clock-row')];
    let valid = true;
    rows.forEach((row, index) => { if (!validateRow(row, candidate.clocks[index])) valid = false; });
    if (!valid) throw new Error('Fix the highlighted clock links before saving.');
    return Core.sanitiseConfig(candidate, defaults);
  }

  function saveFromManager() {
    try {
      const clean = collectManagerConfig();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      config = clean;
      editConfig = clone(clean);
      document.documentElement.style.setProperty('--transition-ms', `${config.transitionMs}ms`);
      startPlaylist();
      renderManager();
      setMessage('Saved on this device. Playlist restarted.');
    } catch (error) {
      setMessage(error.message, true);
    }
  }

  function resetDefaults() {
    window.localStorage.removeItem(STORAGE_KEY);
    config = clone(defaults);
    editConfig = clone(defaults);
    document.documentElement.style.setProperty('--transition-ms', `${config.transitionMs}ms`);
    renderManager();
    setMessage('Repository defaults restored.');
    startPlaylist();
  }

  function exportConfig() {
    try {
      const clean = collectManagerConfig();
      const blob = new Blob([`${JSON.stringify(clean, null, 2)}\n`], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'melbl8-clock-playlist.json';
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Configuration exported.');
    } catch (error) {
      setMessage(error.message, true);
    }
  }

  function importConfig(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        editConfig = Core.sanitiseConfig(JSON.parse(String(reader.result)), defaults);
        renderManager();
        setMessage('Configuration imported. Review it, then save.');
      } catch (error) {
        setMessage(`Import rejected: ${error.message}`, true);
      }
    };
    reader.onerror = function () { setMessage('Could not read that file.', true); };
    reader.readAsText(file);
  }

  function setMessage(message, isError) {
    elements.formMessage.textContent = message;
    elements.formMessage.classList.toggle('is-error', Boolean(isError));
  }
})();
