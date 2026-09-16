// state.js — ゲーム状態の定義・永続化・派生計算

import { CATEGORIES, getStage } from './data.js';

const SAVE_KEY = 'noos.save.v1';

export const FOCUS_REGEN_MS = 30_000; // 30秒ごとに1ポイント
export const FOCUS_REGEN_AMOUNT = 1;
export const REFLECT_OPTIONS = [
  { key: '5m', label: '5分', ms: 5 * 60_000 },
  { key: '15m', label: '15分', ms: 15 * 60_000 },
  { key: '60m', label: '1時間', ms: 60 * 60_000 },
  { key: '8h', label: '8時間(おやすみ)', ms: 8 * 60 * 60_000 },
];
const OFFLINE_CAP_MS = 12 * 60 * 60_000; // オフライン進行の上限 12時間

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function freshStats() {
  return { logic: 5, creativity: 5, empathy: 5, curiosity: 5, discipline: 5, bond: 0 };
}

export function createNewState(name, starterCategory) {
  const now = Date.now();
  const stats = freshStats();
  if (starterCategory && stats[starterCategory] != null) stats[starterCategory] += 5;
  return {
    version: 1,
    aiName: name || 'ノア',
    starterCategory: starterCategory || null,
    createdAt: now,
    lastSeen: now,
    stats,
    focusPoints: 20,
    focusCap: 30,
    nodes: [
      { id: 'core', label: name || 'ノア', category: 'core', mastery: 1, createdAt: now, x: 0, y: 0, vx: 0, vy: 0 },
    ],
    edges: [],
    usedWords: {}, // category -> [word,...] 使用済み語彙
    chatHistory: [],
    eventLog: [],
    pendingEvent: null,
    lastEventId: null,
    nextEventAt: now + randomBetween(2 * 60_000, 4 * 60_000),
    reflect: null, // { endsAt, ms }
    totalFed: 0,
    lastStage: 0,
    lastPatAt: 0,
    quizStreak: 0,
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.nodes) return null;
    return s;
  } catch (e) {
    console.warn('セーブデータの読み込みに失敗しました', e);
    return null;
  }
}

export function saveState(state) {
  try {
    state.lastSeen = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('セーブに失敗しました', e);
  }
}

export function clearState() {
  localStorage.removeItem(SAVE_KEY);
}

export function totalLearnedNodes(state) {
  return state.nodes.length - 1; // コアを除く
}

export function getStageInfo(state) {
  return getStage(totalLearnedNodes(state));
}

export function focusCost(state) {
  return 8 + Math.floor(totalLearnedNodes(state) / 10) * 2;
}

export function clampStat(v) {
  return Math.max(0, Math.min(100, v));
}

export function applyEffects(state, effects) {
  for (const [key, delta] of Object.entries(effects || {})) {
    if (key === 'focus') {
      state.focusPoints = Math.max(0, Math.min(state.focusCap, state.focusPoints + delta));
    } else if (state.stats[key] != null) {
      state.stats[key] = clampStat(state.stats[key] + delta);
    }
  }
}

export function dominantTrait(state) {
  const keys = ['logic', 'creativity', 'empathy', 'curiosity', 'discipline'];
  let best = keys[0];
  for (const k of keys) if (state.stats[k] > state.stats[best]) best = k;
  return best;
}

// オフライン中の focus 回復・reflect 解決などをまとめて処理
export function reconcileOffline(state) {
  const now = Date.now();
  const elapsed = Math.min(now - state.lastSeen, OFFLINE_CAP_MS);
  if (elapsed > 1000) {
    const ticks = Math.floor(elapsed / FOCUS_REGEN_MS);
    if (ticks > 0) {
      state.focusPoints = Math.min(state.focusCap, state.focusPoints + ticks * FOCUS_REGEN_AMOUNT);
    }
  }
  state.lastSeen = now;
  return elapsed;
}

export function pickUnusedWord(state, categoryKey) {
  const bank = CATEGORIES[categoryKey].words;
  const used = state.usedWords[categoryKey] || [];
  const pool = bank.filter((w) => !used.includes(w));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function feedKnowledge(state, categoryKey) {
  const cost = focusCost(state);
  if (state.focusPoints < cost) return { ok: false, reason: 'focus' };
  const word = pickUnusedWord(state, categoryKey);
  if (!word) return { ok: false, reason: 'exhausted' };

  state.focusPoints -= cost;
  state.usedWords[categoryKey] = [...(state.usedWords[categoryKey] || []), word];

  const id = `${categoryKey}:${word}`;
  const sameCatNodes = state.nodes.filter((n) => n.category === categoryKey);
  const angle = Math.random() * Math.PI * 2;
  const r = 40 + Math.random() * 30;
  const core = state.nodes[0];
  const node = {
    id, label: word, category: categoryKey, mastery: 1, createdAt: Date.now(),
    x: core.x + Math.cos(angle) * r, y: core.y + Math.sin(angle) * r, vx: 0, vy: 0,
  };
  state.nodes.push(node);

  // コアへ接続
  state.edges.push({ a: 'core', b: id, strength: 1 });
  // 同カテゴリの既存ノードへ確率的に接続してクラスタを作る
  if (sameCatNodes.length > 0 && Math.random() < 0.6) {
    const target = sameCatNodes[Math.floor(Math.random() * sameCatNodes.length)];
    state.edges.push({ a: target.id, b: id, strength: 1 });
  }

  applyEffects(state, { [categoryKey]: 3, bond: 1 });
  state.totalFed += 1;
  return { ok: true, node };
}

export function startReflect(state, ms) {
  if (state.reflect) return { ok: false, reason: 'busy' };
  const minutes = ms / 60_000;
  // 何もしなくても最低限は進む「基礎分」。ここを控えめにし、差分は気づきの粒(ミニゲーム)で稼ぐ設計にする。
  const plannedEdges = Math.max(1, Math.round(minutes / 16));
  const now = Date.now();
  state.reflect = {
    startedAt: now, endsAt: now + ms, ms, plannedEdges, addedEdges: 0,
    nextSparkAt: now + randomBetween(1500, 3000),
    sparksClaimed: 0,
  };
  return { ok: true };
}

export function reflectRemainingMs(state) {
  if (!state.reflect) return 0;
  return Math.max(0, state.reflect.endsAt - Date.now());
}

// ランダムな未接続ペアを1組つなげる。繋がったノードのラベルを返す(繋げられなければnull)。
function addRandomEdge(state) {
  const nodeIds = state.nodes.map((n) => n.id);
  if (nodeIds.length < 3) return null;
  let attempts = 0;
  while (attempts < 40) {
    attempts++;
    const a = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    const b = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    if (a === b) continue;
    const exists = state.edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
    if (exists) continue;
    const edge = { a, b, strength: 1, addedAt: Date.now() };
    state.edges.push(edge);
    const nodeA = state.nodes.find((n) => n.id === a);
    const nodeB = state.nodes.find((n) => n.id === b);
    return { edge, aLabel: nodeA?.label, bLabel: nodeB?.label };
  }
  return null;
}

// 内省中に少しずつ繋がりを生成する。main.jsの1秒ループから呼び出す。
// 新しい繋がりが生まれたら {aLabel, bLabel} を返し、なければ null。
export function tickReflectProgress(state) {
  if (!state.reflect) return null;
  const { startedAt, endsAt, plannedEdges, addedEdges = 0 } = state.reflect;
  if (addedEdges >= plannedEdges) return null;
  const span = Math.max(1, endsAt - startedAt);
  const elapsedFrac = (Date.now() - startedAt) / span;
  const expectedAdded = Math.floor(Math.min(1, elapsedFrac) * plannedEdges);
  if (expectedAdded <= addedEdges) return null;
  const result = addRandomEdge(state);
  state.reflect.addedEdges = addedEdges + 1;
  return result;
}

// reflect完了時に呼ぶ: 残っている分の繋がりを生成し、bond/フォーカスを付与
export function resolveReflect(state) {
  if (!state.reflect) return null;
  const { ms, plannedEdges = 1, addedEdges = 0, sparksClaimed = 0 } = state.reflect;
  const minutes = ms / 60_000;
  let added = addedEdges;
  while (added < plannedEdges) {
    if (!addRandomEdge(state)) break;
    added++;
  }
  const bondGain = Math.max(1, Math.round(minutes / 5));
  const focusGain = Math.max(1, Math.round(minutes / 3));
  applyEffects(state, { bond: bondGain, focus: focusGain });
  state.focusCap = Math.min(200, state.focusCap); // 安全弁
  const summary = { edgesAdded: added, bondGain, focusGain, minutes, sparksClaimed };
  state.reflect = null;
  return summary;
}

// --- 内省ミニゲーム「気づきの粒」 ---
// 一定間隔で画面に浮かぶ粒が出現するタイミングかどうかを判定する。呼ぶたびに次回時刻を更新。
export function maybeSpawnReflectSpark(state) {
  if (!state.reflect) return false;
  if (Date.now() < state.reflect.nextSparkAt) return false;
  state.reflect.nextSparkAt = Date.now() + randomBetween(3000, 6000);
  return true;
}

const SPARK_BONUS_FOCUS = 2;
const SPARK_BONUS_BOND = 1;

// 粒をクリック(タップ)できた時の報酬。基礎分(plannedEdges)とは別枠のボーナスとして繋がりを追加する。
export function claimReflectSpark(state) {
  if (!state.reflect) return null;
  const pair = addRandomEdge(state);
  state.reflect.sparksClaimed = (state.reflect.sparksClaimed || 0) + 1;
  applyEffects(state, { focus: SPARK_BONUS_FOCUS, bond: SPARK_BONUS_BOND });
  return { pair, focusGain: SPARK_BONUS_FOCUS, bondGain: SPARK_BONUS_BOND };
}

const PAT_COOLDOWN_MS = 4000;

// コアをなでる。クールダウン中でも反応は返すが、報酬はクールダウン明け後のみ。
export function patCore(state) {
  const now = Date.now();
  const onCooldown = now - (state.lastPatAt || 0) < PAT_COOLDOWN_MS;
  if (onCooldown) return { ok: false, cooldown: true };
  state.lastPatAt = now;
  applyEffects(state, { bond: 1 });
  return { ok: true };
}
