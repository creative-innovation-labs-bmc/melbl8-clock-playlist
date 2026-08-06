# Melbourne Clock Playlist

A lightweight GitHub Pages controller for rotating approved gallery clock websites in Enplug on an NVIDIA Shield.

## Production URLs

- Player: `https://creative-innovation-labs-bmc.github.io/melbl8-clock-playlist/`
- Admin and testing GUI: `https://creative-innovation-labs-bmc.github.io/melbl8-clock-playlist/?admin=1`

The normal player URL has no visible controls. Admin mode adds pause, next and management controls.

## Playback behaviour

- Each enabled clock plays once per shuffled loop.
- The list reshuffles only after every enabled clock has played.
- The last clock in one loop cannot immediately repeat at the start of the next loop.
- Default duration is 60 seconds, with a separate duration per clock.
- The next clock preloads shortly before the change.
- Each clock is reloaded when it becomes active so its opening animation restarts cleanly.

## Security boundary

The controller accepts and loads only URLs whose exact origin is:

`https://creative-innovation-labs-bmc.github.io/`

Validation occurs when configurations are imported or saved and again immediately before an iframe is navigated. The page also has a restrictive Content Security Policy, and each clock runs in a sandboxed iframe with scripts allowed but same-origin access withheld.

External hosts, HTTP, custom ports, credentials, relative URLs, `javascript:`, `data:`, `blob:` and other schemes are rejected. Redirects to other hosts are blocked by the parent page's frame policy.

## Updating the playlist

### Temporary change on one device

1. Open the admin URL.
2. Select **Manage**.
3. Add, edit, reorder, enable or disable clocks.
4. Select **Save on this device**.

These changes are stored in that browser's `localStorage`. They affect only that browser or Shield and survive normal reloads.

### Permanent repository default

Edit `config.js`, or ask ChatGPT to add or update a clock in this repository. Permanent defaults apply to devices that have not saved a local override. In admin mode, **Reset to repository defaults** clears the local override.

## Import and export

Admin mode can export the current configuration as JSON and import it later. Imported links still pass the same hard-coded origin validation.

## QC

Run:

```bash
npm test
```

The tests cover URL allow-listing, malicious URL rejection, duration limits and shuffled-loop behaviour.
