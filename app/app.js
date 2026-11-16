/*
 * SmartThings TV dashboard - written in plain ES5 for Tizen 3.0 (Chromium ~47).
 * No arrow functions, no let/const, no fetch, no async/await, no template strings.
 */
(function () {
  'use strict';

  var API = 'https://api.smartthings.com/v1';
  var TOKEN_KEY = 'st_token';
  var REFRESH_MS = 30000;

  var DEMO = false;
  var token = '';
  var tiles = [];          // focusable dashboard tiles: {el, type, id, data}
  var focusIndex = 0;
  var screen = 'setup';    // 'setup' | 'dashboard'
  var refreshTimer = null;

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function show(id, on) { $(id).className = $(id).className.replace(/\bhidden\b/g, '').replace(/\s+$/, '') + (on ? '' : ' hidden'); }
  function setStatus(msg) { $('status').textContent = msg || ''; }
  function clear(el) { while (el.firstChild) { el.removeChild(el.firstChild); } }

  function div(cls, text) {
    var d = document.createElement('div');
    if (cls) { d.className = cls; }
    if (text !== undefined) { d.textContent = text; }
    return d;
  }

  function storeGet(k) { try { return window.localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function storeSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function storeDel(k) { try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  // ---------- tiny XHR wrapper ----------
  function request(method, path, body, cb) {
    if (DEMO) { return mockRequest(method, path, body, cb); }
    var xhr = new XMLHttpRequest();
    xhr.open(method, API + path, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.setRequestHeader('Accept', 'application/json');
    if (body) { xhr.setRequestHeader('Content-Type', 'application/json'); }
    xhr.timeout = 15000;
    xhr.onload = function () {
      var data = null;
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch (e) { /* not json */ }
      if (xhr.status >= 200 && xhr.status < 300) { cb(null, data); }
      else { cb({ status: xhr.status, data: data }); }
    };
    xhr.onerror = function () { cb({ status: 0, message: 'Network error' }); };
    xhr.ontimeout = function () { cb({ status: 0, message: 'Timed out' }); };
    xhr.send(body ? JSON.stringify(body) : null);
  }

  // ---------- demo data (works offline, used for testing) ----------
  var demoState = {
    a1: { sw: 'on', level: 60 }, a2: { sw: 'off' }, a3: { sw: 'on' }
  };
  var demoDevices = [
    { deviceId: 'a1', label: 'Living Room Lamp', components: [{ capabilities: [{ id: 'switch' }, { id: 'switchLevel' }] }] },
    { deviceId: 'a2', label: 'Desk Plug', components: [{ capabilities: [{ id: 'switch' }] }] },
    { deviceId: 'a3', label: 'Hallway Light', components: [{ capabilities: [{ id: 'switch' }] }] },
    { deviceId: 'b1', label: 'Front Door', components: [{ capabilities: [{ id: 'contactSensor' }] }] },
    { deviceId: 'b2', label: 'Bedroom Temp', components: [{ capabilities: [{ id: 'temperatureMeasurement' }] }] },
    { deviceId: 'b3', label: 'Garage Door', components: [{ capabilities: [{ id: 'doorControl' }] }] }
  ];
  var demoScenes = [{ sceneId: 's1', sceneName: 'Good Night' }, { sceneId: 's2', sceneName: 'Movie Time' }];

  function mockRequest(method, path, body, cb) {
    setTimeout(function () {
      var m;
      if (path === '/devices') { return cb(null, { items: demoDevices }); }
      if (path === '/scenes') { return cb(null, { items: demoScenes }); }
      if ((m = /^\/devices\/(\w+)\/status$/.exec(path))) {
        var id = m[1], st = demoState[id], main = {};
        if (st) { main['switch'] = { 'switch': { value: st.sw } }; if (st.level !== undefined) { main.switchLevel = { level: { value: st.level } }; } }
        if (id === 'b1') { main.contactSensor = { contact: { value: 'closed' } }; }
        if (id === 'b2') { main.temperatureMeasurement = { temperature: { value: 21.5, unit: 'C' } }; }
        if (id === 'b3') { main.doorControl = { door: { value: 'closed' } }; }
        return cb(null, { components: { main: main } });
      }
      if ((m = /^\/devices\/(\w+)\/commands$/.exec(path))) {
        if (demoState[m[1]]) { demoState[m[1]].sw = body.commands[0].command; }
        return cb(null, { results: [{ status: 'ACCEPTED' }] });
      }
      if (/^\/scenes\/\w+\/execute$/.test(path)) { return cb(null, { status: 'success' }); }
      cb({ status: 404 });
    }, 150);
  }

  // ---------- device helpers ----------
  function hasCap(device, capId) {
    var comps = device.components || [];
    for (var i = 0; i < comps.length; i++) {
      var caps = comps[i].capabilities || [];
      for (var j = 0; j < caps.length; j++) { if (caps[j].id === capId) { return true; } }
    }
    return false;
  }

  function mainStatus(status) {
    return (status && status.components && status.components.main) || {};
  }

  function describe(device, status) {
    var main = mainStatus(status);
    var parts = [];
    if (main.switchLevel && main.switchLevel.level) { parts.push(main.switchLevel.level.value + '%'); }
    if (main.temperatureMeasurement && main.temperatureMeasurement.temperature) {
      var t = main.temperatureMeasurement.temperature;
      parts.push(t.value + '°' + (t.unit || ''));
    }
    if (main.contactSensor && main.contactSensor.contact) { parts.push(main.contactSensor.contact.value); }
    if (main.motionSensor && main.motionSensor.motion) { parts.push('motion ' + main.motionSensor.motion.value); }
    if (main.lock && main.lock.lock) { parts.push(main.lock.lock.value); }
    if (main.doorControl && main.doorControl.door) { parts.push(main.doorControl.door.value); }
    if (main.battery && main.battery.battery) { parts.push('battery ' + main.battery.battery.value + '%'); }
    return parts.join(' · ');
  }

  function switchValue(status) {
    var main = mainStatus(status);
    return main['switch'] && main['switch']['switch'] ? main['switch']['switch'].value : null;
  }

  function paintTile(tile) {
    var d = tile.data, el = tile.el;
    var base = 'tile' + (tile.type === 'scene' ? ' scene' : '');
    if (tile.type === 'device') {
      var sw = tile.canToggle ? switchValue(tile.status) : null;
      var cls = base;
      if (sw === 'on') { cls += ' on'; } else if (sw === 'off') { cls += ' off'; } else { cls += ' readonly'; }
      if (tile.busy) { cls += ' busy'; }
      el.className = cls + (tile.focused ? ' focus' : '');
      var stateEl = el.querySelector('.state'), infoEl = el.querySelector('.info');
      stateEl.textContent = sw ? sw.toUpperCase() : (tile.status ? '' : '...');
      infoEl.textContent = tile.status ? describe(d, tile.status) : 'loading';
    } else {
      el.className = base + (tile.focused ? ' focus' : '');
    }
  }

  // ---------- focus handling ----------
  function setFocus(i) {
    if (!tiles.length) { return; }
    if (i < 0) { i = 0; }
    if (i > tiles.length - 1) { i = tiles.length - 1; }
    if (tiles[focusIndex]) { tiles[focusIndex].focused = false; paintTile(tiles[focusIndex]); }
    focusIndex = i;
    tiles[i].focused = true;
    paintTile(tiles[i]);
    scrollIntoViewIfNeeded(tiles[i].el);
  }

  function scrollIntoViewIfNeeded(el) {
    var dash = $('dashboard');
    var top = el.offsetTop, bottom = top + el.offsetHeight;
    if (top < dash.scrollTop) { dash.scrollTop = Math.max(0, top - 80); }
    else if (bottom > dash.scrollTop + dash.clientHeight) { dash.scrollTop = bottom - dash.clientHeight + 20; }
  }

  // Move focus up/down by finding the nearest tile in that direction.
  function moveFocus(dir) {
    var cur = tiles[focusIndex];
    if (!cur) { return; }
    var cx = cur.el.offsetLeft, cy = cur.el.offsetTop;
    var best = -1, bestScore = 1e9;
    for (var i = 0; i < tiles.length; i++) {
      if (i === focusIndex) { continue; }
      var x = tiles[i].el.offsetLeft, y = tiles[i].el.offsetTop;
      var dx = x - cx, dy = y - cy, ok = false, score;
      if (dir === 'left') { ok = (dy === 0 && dx < 0); score = -dx; }
      else if (dir === 'right') { ok = (dy === 0 && dx > 0); score = dx; }
      else if (dir === 'up') { ok = dy < 0; score = (-dy) * 10 + Math.abs(dx); }
      else { ok = dy > 0; score = dy * 10 + Math.abs(dx); }
      if (ok && score < bestScore) { bestScore = score; best = i; }
    }
    if (best >= 0) { setFocus(best); }
  }

  // ---------- dashboard ----------
  function buildTile(type, data) {
    var el = div('tile');
    var name = type === 'scene' ? data.sceneName : (data.label || data.name || data.deviceId);
    el.appendChild(div('name', name));
    if (type === 'device') { el.appendChild(div('info', 'loading')); el.appendChild(div('state', '...')); }
    return el;
  }

  function loadDashboard() {
    setStatus('Loading...');
    request('GET', '/devices', null, function (err, devData) {
      if (err) { return handleError(err); }
      request('GET', '/scenes', null, function (err2, scData) {
        // scenes are optional: a token without scene permission still gets devices
        var scenes = (!err2 && scData && scData.items) ? scData.items : [];
        renderDashboard((devData && devData.items) || [], scenes);
      });
    });
  }

  function renderDashboard(devices, scenes) {
    var prevId = tiles[focusIndex] ? tiles[focusIndex].id : null;
    clear($('scenes')); clear($('devices'));
    tiles = [];
    var i, tile;

    show('scenesHeading', scenes.length > 0);
    for (i = 0; i < scenes.length; i++) {
      tile = { type: 'scene', id: scenes[i].sceneId, data: scenes[i], el: buildTile('scene', scenes[i]) };
      $('scenes').appendChild(tile.el); tiles.push(tile); paintTile(tile);
    }
    for (i = 0; i < devices.length; i++) {
      tile = { type: 'device', id: devices[i].deviceId, data: devices[i], el: buildTile('device', devices[i]), status: null,
        canToggle: hasCap(devices[i], 'switch') };
      $('devices').appendChild(tile.el); tiles.push(tile); paintTile(tile);
    }
    show('empty', devices.length === 0 && scenes.length === 0);

    var restore = 0;
    for (i = 0; i < tiles.length; i++) { if (tiles[i].id === prevId) { restore = i; } }
    focusIndex = 0;
    setFocus(restore);
    setStatus(devices.length + ' devices');

    for (i = 0; i < tiles.length; i++) { if (tiles[i].type === 'device') { fetchStatus(tiles[i]); } }
  }

  function fetchStatus(tile) {
    request('GET', '/devices/' + tile.id + '/status', null, function (err, st) {
      if (err) { tile.status = { components: { main: {} } }; }
      else { tile.status = st; }
      paintTile(tile);
    });
  }

  function activate() {
    var tile = tiles[focusIndex];
    if (!tile || tile.busy) { return; }
    if (tile.type === 'scene') {
      setStatus('Running ' + tile.data.sceneName + '...');
      request('POST', '/scenes/' + tile.id + '/execute', null, function (err) {
        setStatus(err ? 'Scene failed' : 'Ran ' + tile.data.sceneName);
      });
      return;
    }
    if (!tile.canToggle) { return; }
    var cmd = switchValue(tile.status) === 'on' ? 'off' : 'on';
    tile.busy = true; paintTile(tile);
    request('POST', '/devices/' + tile.id + '/commands',
      { commands: [{ component: 'main', capability: 'switch', command: cmd }] },
      function (err) {
        if (err) { tile.busy = false; paintTile(tile); setStatus('Command failed'); return; }
        // devices take a moment to report; re-read after a short delay
        setTimeout(function () { tile.busy = false; fetchStatus(tile); }, 700);
      });
  }

  function handleError(err) {
    if (err.status === 401 || err.status === 403) {
      storeDel(TOKEN_KEY);
      showSetup('That token was rejected or has expired. Enter a new one.');
    } else {
      setStatus(err.message || ('Error ' + err.status));
    }
  }

  function startDashboard() {
    screen = 'dashboard';
    show('setup', false); show('dashboard', true);
    loadDashboard();
    if (refreshTimer) { clearInterval(refreshTimer); }
    refreshTimer = setInterval(function () {
      if (screen !== 'dashboard') { return; }
      for (var i = 0; i < tiles.length; i++) { if (tiles[i].type === 'device' && !tiles[i].busy) { fetchStatus(tiles[i]); } }
    }, REFRESH_MS);
  }

  // ---------- setup screen ----------
  var setupButtons = [];
  var setupIndex = -1; // -1 = input field

  function showSetup(message) {
    screen = 'setup';
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    show('dashboard', false); show('setup', true);
    $('setupError').textContent = message || '';
    setStatus('');
    setupButtons = [$('btnSave'), $('btnDemo')];
    setSetupFocus(-1);
  }

  function setSetupFocus(i) {
    setupIndex = i;
    for (var k = 0; k < setupButtons.length; k++) { setupButtons[k].className = 'btn' + (k === i ? ' focus' : ''); }
    if (i === -1) { $('tokenInput').focus(); } else { $('tokenInput').blur(); }
  }

  function saveToken() {
    var v = $('tokenInput').value.replace(/^\s+|\s+$/g, '');
    if (v.length < 20) { $('setupError').textContent = 'That looks too short to be a token.'; return; }
    token = v; DEMO = false; storeSet(TOKEN_KEY, v); startDashboard();
  }

  function startDemo() { DEMO = true; token = 'demo'; startDashboard(); }

  // ---------- keys ----------
  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, RED: 403, YELLOW: 405, ESC: 27 };

  function exitApp() {
    try { window.tizen.application.getCurrentApplication().exit(); } catch (e) { try { window.close(); } catch (e2) { /* ignore */ } }
  }

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (k === KEY.BACK || k === KEY.ESC) {
      if (screen === 'setup' && storeGet(TOKEN_KEY)) { token = storeGet(TOKEN_KEY); startDashboard(); } else { exitApp(); }
      e.preventDefault(); return;
    }
    if (screen === 'setup') {
      if (setupIndex === -1) {
        if (k === KEY.DOWN) { setSetupFocus(0); e.preventDefault(); }
        else if (k === KEY.ENTER) { saveToken(); e.preventDefault(); }
        return; // let the input handle everything else (typing, left/right)
      }
      if (k === KEY.UP) { setSetupFocus(-1); }
      else if (k === KEY.LEFT && setupIndex > 0) { setSetupFocus(setupIndex - 1); }
      else if (k === KEY.RIGHT && setupIndex < setupButtons.length - 1) { setSetupFocus(setupIndex + 1); }
      else if (k === KEY.ENTER) { if (setupIndex === 0) { saveToken(); } else { startDemo(); } }
      e.preventDefault(); return;
    }
    // dashboard
    if (k === KEY.LEFT) { moveFocus('left'); }
    else if (k === KEY.RIGHT) { moveFocus('right'); }
    else if (k === KEY.UP) { moveFocus('up'); }
    else if (k === KEY.DOWN) { moveFocus('down'); }
    else if (k === KEY.ENTER) { activate(); }
    else if (k === KEY.RED) { loadDashboard(); }
    else if (k === KEY.YELLOW) { showSetup(''); }
    else { return; }
    e.preventDefault();
  }, false);

  // ---------- init ----------
  function registerKeys() {
    try {
      var keys = ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue'];
      for (var i = 0; i < keys.length; i++) { window.tizen.tvinputdevice.registerKey(keys[i]); }
    } catch (e) { /* not on a Tizen TV (e.g. testing in a desktop browser) */ }
  }

  function init() {
    registerKeys();
    $('btnSave').addEventListener('click', saveToken, false);
    $('btnDemo').addEventListener('click', startDemo, false);
    if (/[?&]demo=1/.test(window.location.search)) { return startDemo(); }
    token = storeGet(TOKEN_KEY);
    if (token) { startDashboard(); } else { showSetup(''); }
  }

  init();
})();
