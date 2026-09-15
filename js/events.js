// events.js — ランダムイベントの発火タイミング管理

import { EVENTS } from './data.js';
import { applyEffects } from './state.js';

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// アクティブなプレイ時間中に呼び出す。条件が揃えば pendingEvent をセットして true を返す。
export function maybeTriggerEvent(state) {
  if (state.pendingEvent || state.reflect) return false;
  if (Date.now() < state.nextEventAt) return false;

  let pool = EVENTS;
  if (state.lastEventId && EVENTS.length > 1) {
    pool = EVENTS.filter((e) => e.id !== state.lastEventId);
  }
  const event = pool[Math.floor(Math.random() * pool.length)];
  state.pendingEvent = event;
  state.lastEventId = event.id;
  return true;
}

export function scheduleNextEvent(state) {
  state.nextEventAt = Date.now() + randomBetween(3 * 60_000, 6 * 60_000);
}

export function resolveEvent(state, choiceIndex) {
  const event = state.pendingEvent;
  if (!event) return null;
  const choice = event.choices[choiceIndex];
  if (!choice) return null;
  applyEffects(state, choice.effects);
  state.eventLog.unshift({
    title: event.title, choiceLabel: choice.label, result: choice.result, at: Date.now(),
  });
  state.eventLog = state.eventLog.slice(0, 50);
  state.pendingEvent = null;
  scheduleNextEvent(state);
  return choice;
}
