# Project brief

## Description

Secure master playlist controller for rotating Melbourne gallery clock websites on NVIDIA Shield and Enplug.

## Build brief

Purpose:
Create one production GitHub Pages URL that Enplug can load to rotate all approved clock sites.

Users:
Fooch and the Aurecon gallery display operators.

Main features:
- Full-screen clock player using iframes.
- Default duration of 60 seconds, with a separate duration per clock.
- Shuffle-bag playback so every enabled clock plays once before reshuffling.
- Prevent the last clock of one loop from immediately repeating as the first clock of the next loop.
- Simple built-in management GUI to add, edit, enable, disable, delete and reorder clock entries.
- Preview and next controls for testing.
- Display the current clock, remaining time and upcoming queue in admin mode only.
- Import and export the configuration as JSON.
- Store local GUI edits in browser localStorage so the Shield playlist remains stable without a backend.
- Include a clearly editable default configuration file in the repository for permanent updates.
- Reload each clock cleanly when it becomes active.
- Preload the next clock without leaving two animated clocks active longer than necessary.
- Skip failed clocks and fall back safely.
- Fixed production canvas support for 3840 x 804, with automatic viewport scaling for desktop and mobile testing.

Security constraints:
- Hard-code the only permitted URL origin and path prefix as https://creative-innovation-labs-bmc.github.io/.
- Reject all other schemes, origins, hosts, ports, credentials and URL forms.
- Do not allow javascript:, data:, blob:, file:, localhost, relative URLs, redirects supplied through the GUI, or encoded attempts to escape the approved base.
- Validate URLs both when editing and again immediately before iframe navigation.
- Use iframe sandbox and restrictive referrer policy while still allowing the clock pages to run their own scripts.
- Add a strict Content Security Policy limited to self and frames from https://creative-innovation-labs-bmc.github.io.
- No third-party libraries, frameworks, analytics, remote fonts or external APIs.
- Add noindex, nofollow, noarchive and robots.txt disallow rules.

Initial enabled production clocks:
- https://creative-innovation-labs-bmc.github.io/melbl8-clock01-shield-PT-Serif-Open-Sans/
- https://creative-innovation-labs-bmc.github.io/Melbl8-clock02-shield-PT-Serif-Open-Sans/
- https://creative-innovation-labs-bmc.github.io/Melbl8-Clock03-Split-flap-Open-Sans/
- https://creative-innovation-labs-bmc.github.io/Melbl8-Clock04-PT-Serif/
- https://creative-innovation-labs-bmc.github.io/Melbl8-Clock05-Counter-Field-PT-Serif/
- https://creative-innovation-labs-bmc.github.io/aurecon-split-flap-wall-open-sans/
- https://creative-innovation-labs-bmc.github.io/recall-bot-clock-shield/
- https://creative-innovation-labs-bmc.github.io/Melbl8-Clock05-Office-Triptych/

Initial disabled pending clock:
- https://creative-innovation-labs-bmc.github.io/Melbl8-Clock06-Office-Triptych-Weather/

Constraints:
- Optimised for NVIDIA Shield Chromium/WebView and Enplug.
- Lightweight vanilla HTML, CSS and JavaScript only.
- Production player should hide all controls unless admin mode is explicitly opened with ?admin=1.
- A normal load must start playback automatically.
- GUI changes must never permit a non-approved URL.
- Include README instructions for permanent repository updates versus temporary browser-only GUI changes.

Reference links:
- Approved base: https://creative-innovation-labs-bmc.github.io/
- Target display: 3840 x 804
