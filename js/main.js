// main.js — 起動処理・ゲームループ・状態の橋渡し

import { GraphView } from './graph.js';
import { UI, bindOnboarding } from './ui.js';
import {
  createNewState, loadState, saveState, reconcileOffline, getStageInfo,
} from './state.js';
import { maybeTriggerEvent } from './events.js';

let state = null;
let graph = null;
let ui = null;
let lastSaveAt = 0;

function saveThrottled(force) {
  const now = Date.now();
  if (force || now - lastSaveAt > 800) {
    saveState(state);
    lastSaveAt = now;
  }
}

function checkEvolution() {
  const info = getStageInfo(state);
  if (info.index > (state.lastStage || 0)) {
    state.lastStage = info.index;
    ui.showEvolveModal(info);
  }
}

function onChange() {
  checkEvolution();
  saveThrottled(false);
}

function initGame(freshState) {
  state = freshState;
  reconcileOffline(state);

  const canvas = document.getElementById('graph-canvas');
  graph = new GraphView(canvas, state);
  ui = new UI(state, graph, { onChange });
  ui.hideOnboarding();
  ui.renderAll();
  ui.renderReflectBanner();

  checkEvolution();
  saveThrottled(true);
  startLoops();
}

function startLoops() {
  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    graph.step(dt * 60); // ステップ関数は「60fps相当のdt」を前提に調整済み
    graph.draw(t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  setInterval(() => {
    if (!state) return;
    reconcileOffline(state);
    ui.renderTopbar();
    if (ui.activePanel === 'feed') ui.renderFeedPanel();

    const resolved = ui.tickReflect();
    if (resolved) checkEvolution();

    if (maybeTriggerEvent(state)) ui.showEventModal();

    saveThrottled(false);
  }, 1000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveThrottled(true);
    else { reconcileOffline(state); ui.renderAll(); ui.renderReflectBanner(); }
  });
  window.addEventListener('pagehide', () => saveThrottled(true));
  window.addEventListener('beforeunload', () => saveThrottled(true));
}

function boot() {
  const saved = loadState();
  if (saved) {
    initGame(saved);
    return;
  }
  const ob = document.getElementById('onboarding-modal');
  ob.hidden = false;
  bindOnboarding((name, starter) => {
    const fresh = createNewState(name, starter);
    initGame(fresh);
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

boot();
