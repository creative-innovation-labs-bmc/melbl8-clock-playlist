(function () {
  'use strict';

  const Core = window.ClockPlaylistCore;
  const CONFIG_URL = 'playlist.json';
  const FALLBACKS = Object.freeze({ defaultDuration: 60, transitionMs: 350, preloadSeconds: 4, clocks: [] });
  const elements = {
    defaultDuration: document.getElementById('default-duration'),
    transitionMs: document.getElementById('transition-ms'),
    preloadSeconds: document.getElementById('preload-seconds'),
    list: document.getElementById('clock-list'),
    template: document.getElementById('clock-row-template'),
    addButton: document.getElementById('add-clock-button'),
    downloadButton: document.getElementById('download-button'),
    importInput: document.getElementById('import-input'),
    reloadButton: document.getElementById('reload-button'),
    message: document.getElementById('form-message')
  };

  let editConfig = null;

  bindEvents();
  loadPublished();

  function bindEvents() {
    elements.addButton.addEventListener('click', addClock);
    elements.downloadButton.addEventListener('click', downloadConfig);
    elements.importInput.addEventListener('change', importConfig);
    elements.reloadButton.addEventListener('click', loadPublished);
    elements.list.addEventListener('input', handleListInput);
    elements.list.addEventListener('click', handleListClick);
  }

  async function loadPublished() {
    setMessage('Loading the published playlist…');
    try {
      const response = await fetch(`${CONFIG_URL}?v=${Date.now()}`, { cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      editConfig = Core.sanitiseConfig(await response.json(), FALLBACKS);
      render();
      setMessage('Published playlist loaded. Changes remain local until you download the JSON.');
    } catch (error) {
      setMessage(`Could not load the published playlist: ${error.message}`, true);
    }
  }

  function render() {
    elements.defaultDuration.value = editConfig.defaultDuration;
    elements.transitionMs.value = editConfig.transitionMs;
    elements.preloadSeconds.value = editConfig.preloadSeconds;
    elements.list.replaceChildren();
    editConfig.clocks.forEach((clock, index) => elements.list.appendChild(makeRow(clock, index)));
  }

  function makeRow(clock, index) {
    const node = elements.template.content.firstElementChild.cloneNode(true);
    node.dataset.index = String(index);
    node.querySelector('[data-field="enabled"]').checked = clock.enabled;
    node.querySelector('[data-field="name"]').value = clock.name;
    node.querySelector('[data-field="url"]').value = clock.url;
    node.querySelector('[data-field="duration"]').value = clock.duration;
    return node;
  }

  function addClock() {
    if (!editConfig) return;
    const duration = Core.clampDuration(elements.defaultDuration.value, editConfig.defaultDuration);
    editConfig.clocks.push({
      id: `new-clock-${Date.now()}`,
      name: 'New clock',
      url: `${Core.ALLOWED_BASE}repository-name/`,
      duration,
      enabled: false
    });
    render();
    const rows = elements.list.querySelectorAll('.clock-row');
    const last = rows[rows.length - 1];
    last.scrollIntoView({ block: 'center' });
    last.querySelector('[data-field="name"]').select();
    setMessage('New disabled clock added. Enter its approved GitHub Pages URL.');
  }

  function handleListInput(event) {
    const field = event.target.dataset.field;
    if (!field || !editConfig) return;
    const row = event.target.closest('.clock-row');
    const index = Number(row.dataset.index);
    const clock = editConfig.clocks[index];
    if (!clock) return;
    clock[field] = field === 'enabled' ? event.target.checked : event.target.value;
    validateRow(row, clock);
  }

  function handleListClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || !editConfig) return;
    const row = button.closest('.clock-row');
    const index = Number(row.dataset.index);
    const action = button.dataset.action;

    if (action === 'delete') editConfig.clocks.splice(index, 1);
    if (action === 'up' && index > 0) [editConfig.clocks[index - 1], editConfig.clocks[index]] = [editConfig.clocks[index], editConfig.clocks[index - 1]];
    if (action === 'down' && index < editConfig.clocks.length - 1) [editConfig.clocks[index + 1], editConfig.clocks[index]] = [editConfig.clocks[index], editConfig.clocks[index + 1]];
    if (action === 'preview') {
      try {
        const candidate = Core.sanitiseClock(editConfig.clocks[index], editConfig.defaultDuration);
        window.open(candidate.url, '_blank', 'noopener,noreferrer');
      } catch (error) {
        validateRow(row, editConfig.clocks[index]);
      }
      return;
    }
    render();
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

  function collectConfig() {
    if (!editConfig) throw new Error('No playlist is loaded.');
    const candidate = {
      version: 1,
      defaultDuration: elements.defaultDuration.value,
      transitionMs: elements.transitionMs.value,
      preloadSeconds: elements.preloadSeconds.value,
      clocks: editConfig.clocks
    };
    const rows = [...elements.list.querySelectorAll('.clock-row')];
    let valid = true;
    rows.forEach((row, index) => { if (!validateRow(row, candidate.clocks[index])) valid = false; });
    if (!valid) throw new Error('Fix the highlighted clock links before exporting.');
    const clean = Core.sanitiseConfig(candidate, FALLBACKS);
    if (!clean.clocks.length) throw new Error('Add at least one clock before exporting.');
    if (!clean.clocks.some((clock) => clock.enabled)) throw new Error('Enable at least one clock before exporting.');
    return clean;
  }

  function downloadConfig() {
    try {
      const clean = collectConfig();
      const blob = new Blob([`${JSON.stringify(clean, null, 2)}\n`], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'playlist.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage('playlist.json downloaded. The live site has not been changed.');
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
        const clean = Core.sanitiseConfig(JSON.parse(String(reader.result)), FALLBACKS);
        if (!clean.clocks.length) throw new Error('The file contains no clock entries.');
        editConfig = clean;
        render();
        setMessage('JSON opened. Review it, then download a validated replacement.');
      } catch (error) {
        setMessage(`JSON rejected: ${error.message}`, true);
      }
    };
    reader.onerror = function () { setMessage('Could not read that file.', true); };
    reader.readAsText(file);
  }

  function setMessage(message, isError) {
    elements.message.textContent = message;
    elements.message.classList.toggle('is-error', Boolean(isError));
  }
})();
