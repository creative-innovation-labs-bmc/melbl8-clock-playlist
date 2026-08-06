# Melbourne clock playlist

A read-only GitHub Pages player for rotating approved clock websites on Enplug and NVIDIA Shield.

## Live URLs

- Player: `https://creative-innovation-labs-bmc.github.io/melbl8-clock-playlist/`
- Export-only editor: `https://creative-innovation-labs-bmc.github.io/melbl8-clock-playlist/editor.html`

## Security model

The public player has no admin mode, no local playlist override and no publishing credentials. It reads `playlist.json` and validates every clock URL before navigation.

The editor is deliberately export-only. It can load, edit, validate and download a replacement `playlist.json`, but it cannot write to GitHub or change the live player.

Publishing requires authenticated write access to this repository. The exported JSON can be:

1. attached in ChatGPT for publication through the connected GitHub app, or
2. pasted into the existing `playlist.json` file while signed into GitHub with repository write access.

The JSON itself is public because the player must read it. Security comes from restricted repository write access, not secrecy of the configuration.

## Approved URLs

Only this base is accepted:

`https://creative-innovation-labs-bmc.github.io/`

Validation runs in three places:

1. the editor before export,
2. GitHub Actions before deployment,
3. the player immediately before loading each iframe.

## Updating the playlist

1. Open `editor.html`.
2. Add, remove, reorder or retime clocks.
3. Download `playlist.json`.
4. Upload the file in ChatGPT or replace the repository's existing `playlist.json` while signed into GitHub.
5. GitHub Actions validates the file and deploys only after all tests pass.
6. The player checks for a newly published configuration every five minutes and restarts only when the configuration changes.

## Tests

```bash
npm test
```
