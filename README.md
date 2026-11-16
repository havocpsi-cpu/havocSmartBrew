# SmartThings for TizenBrew

A small SmartThings dashboard for older Samsung TVs (written for Tizen 3.0, e.g. UN58MU6100).
It is a TizenBrew **application module**: a plain web page, not installed on the TV itself.

## What it does
- Lists your SmartThings **scenes** (OK runs one) and **devices**.
- Switches, plugs and lights toggle with OK. Sensors, locks, doors and temperature show their state.
- Refreshes device state every 30 seconds. Red = refresh now, Yellow = change token, Back = exit.
- Demo mode (`?demo=1` or the "Try demo mode" button) works with fake devices and no account.

## Get a token (you do this, not Claude)
1. Sign in at https://account.smartthings.com/tokens
2. Create a Personal Access Token with: Devices (list, see, control) and Scenes (list, see, execute).
3. **Never publish the token.** It is typed on the TV and stored only in that app's local storage.

> SmartThings personal tokens may expire after a short time (about a day, per recent policy; not
> verified here). When one expires the app returns to the token screen. For a permanent setup the
> app would need an OAuth flow, which is a later step.

## Test in a desktop browser
Serve the `app/` folder with any static server and open `index.html?demo=1`.

## Install on the TV
TizenBrew installs application modules from npm or from GitHub (`user/repo`). So the module
has to be published first, which is a decision for you:
1. Push this folder to a GitHub repo (or publish to npm).
2. On the TV, open TizenBrew, then Module Manager, then Install from GitHub, and enter `user/repo`.
3. Launch "SmartThings" from TizenBrew and enter your token.

## Compatibility notes
- Plain ES5 only, because Tizen 3.0 ships an old Chromium. No CSS grid or CSS variables.
- The SmartThings API allows browser calls (CORS `*`), so no proxy is needed.
- Not yet tested on the actual TV.

## Credits and acknowledgements
- **[TizenBrew](https://github.com/reisxd/TizenBrew)** by reisxd and contributors: the module system this
  app runs inside. This project only follows TizenBrew's documented
  [application module format](https://github.com/reisxd/TizenBrew/blob/main/docs/MODULES.md); no TizenBrew code is copied.
- **[TizenBrewInstaller](https://github.com/reisxd/TizenBrewInstaller)** by reisxd: used to get TizenBrew onto the TV.
- **[TizenTube](https://github.com/reisxd/TizenTube)** by reisxd and
  **[jellyfin-tizen](https://github.com/GlenLowland/jellyfin-tizen-npm-publish)**: example modules that show how
  site-mod and application modules are structured.
- **SmartThings** and its public REST API belong to Samsung / SmartThings. This app uses that API with your own
  token; it is not made or endorsed by Samsung.
- **Tizen** is an operating system from Samsung and the Linux Foundation, and the TV runs Samsung's Tizen platform.
- Code written with the help of Claude (Anthropic) and published by havocpsi-cpu.

All product names are trademarks of their owners. This is an unofficial, independent project.
