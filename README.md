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
