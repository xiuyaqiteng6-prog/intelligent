// ui.js — DOM描画とユーザー操作のハンドリング

import { CATEGORY_LIST, CATEGORIES, PAT_LINES, PAT_COOLDOWN_LINES, REFLECT_INSIGHT_LINES, QUIZ_RIGHT_LINES, QUIZ_WRONG_LINES } from './data.js';
import {
  totalLearnedNodes, getStageInfo, focusCost, feedKnowledge,
  REFLECT_OPTIONS, startReflect, reflectRemainingMs, resolveReflect, tickReflectProgress,
  patCore, applyEffects, saveState, claimReflectSpark,
  deepenNode, deepenCost, MAX_MASTERY, MAX_NODE_DEGREE,
} from './state.js';
import { generateReply } from './dialogue.js';
import { resolveEvent } from './events.js';
import {
  DEFAULT_LLM_SETTINGS, loadLLMSettings, saveLLMSettings,
  generateLLMReply, testLLMConnection, describeError,
} from './llm.js';

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const STAT_META = [
  { key: 'logic', label: '論理', color: 'var(--c-logic)' },
  { key: 'creativity', label: '創造', color: 'var(--c-creativity)' },
  { key: 'empathy', label: '共感', color: 'var(--c-empathy)' },
  { key: 'curiosity', label: '好奇心', color: 'var(--c-curiosity)' },
  { key: 'discipline', label: '規律', color: 'var(--c-discipline)' },
  { key: 'bond', label: '絆', color: 'var(--c-bond)' },
];

function $(id) { return document.getElementById(id); }

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}時間${String(m).padStart(2, '0')}分`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const MASTERY_NOTES = [
  '',
  '',
  'まだ触れたばかりの、浅い理解。',
  '何度も立ち返り、少しずつ輪郭がはっきりしてきた。',
  'すっかり馴染んで、他の記憶とも深く結びついている。',
  'この意識の核と言ってもいいほど、深く根を張った概念。',
];

function describeNode(node) {
  if (node.category === 'core') {
    return `これはこの意識の核——すべてのノートはここから伸びていく。まだ名前と可能性しか持たない、始まりの一点。`;
  }
  const cat = CATEGORIES[node.category];
  const mastery = node.mastery || 1;
  const extra = MASTERY_NOTES[mastery] ? ` ${MASTERY_NOTES[mastery]}` : '';
  return `「${node.label}」という概念を学んだ。${cat.desc}の一部として、他の記憶と少しずつ結びついている。${extra}`;
}

// オンボーディング画面のバインド(ゲーム開始前、UIインスタンス生成前に呼び出す)
export function bindOnboarding(onStart) {
  const grid = $('starter-grid');
  grid.innerHTML = '';
  let selected = null;
  for (const cat of CATEGORY_LIST) {
    const card = document.createElement('div');
    card.className = 'starter-card';
    card.innerHTML = `<span style="color:${cat.color}">${cat.icon}</span><span>${cat.label}</span>`;
    card.addEventListener('click', () => {
      selected = cat.key;
      grid.querySelectorAll('.starter-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      checkReady();
    });
    grid.appendChild(card);
  }
  const nameInput = $('name-input');
  const startBtn = $('btn-start');
  const checkReady = () => {
    startBtn.disabled = !(nameInput.value.trim().length > 0 && selected);
  };
  nameInput.addEventListener('input', checkReady);
  startBtn.addEventListener('click', () => {
    if (startBtn.disabled) return;
    onStart(nameInput.value.trim(), selected);
  });
}

export class UI {
  constructor(state, graph, callbacks) {
    this.state = state;
    this.graph = graph;
    this.cb = callbacks || {}; // { onChange, onEvolve }
    this.activePanel = 'note';
    this.mobileView = 'graph';
    this.selectedNodeId = 'core';

    this.graph.onSelect = (id) => {
      this.selectedNodeId = id;
      this.activePanel = 'note';
      this.setMobileView('note');
      this.renderRightPanels();
      this.updateActionActiveState();
    };
    this.graph.onCoreClick = () => this.handlePatCore();

    this.llmSettings = loadLLMSettings();
    this.quizPending = null;

    this._bindStatic();
    this._bindSettings();
  }

  // ---------------- コアをなでる ----------------
  handlePatCore() {
    const core = this.state.nodes[0];
    this.graph.spawnSparkles(core.x, core.y);
    const res = patCore(this.state);
    if (res.ok) {
      this.showFloatingMessage(pick(PAT_LINES));
      this.renderTopbar();
      this.markChanged();
    } else {
      this.showFloatingMessage(pick(PAT_COOLDOWN_LINES), { muted: true });
    }
  }

  // グラフ上に浮かぶ短いメッセージを表示する(なでる反応・内省の気づきなど共通)
  showFloatingMessage(text, opts = {}) {
    const wrap = document.getElementById('graph-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'floating-msg' + (opts.muted ? ' muted' : '');
    el.textContent = text;
    wrap.appendChild(el);
    window.setTimeout(() => el.classList.add('fade-out'), 1800);
    window.setTimeout(() => el.remove(), 2400);
  }

  markChanged() {
    if (this.cb.onChange) this.cb.onChange();
  }

  // ---------------- 初期バインド ----------------
  _bindStatic() {
    document.querySelectorAll('.action-item').forEach((el) => {
      el.addEventListener('click', () => {
        this.activePanel = el.dataset.panel;
        this.renderRightPanels();
        this.updateActionActiveState();
        if (window.matchMedia('(max-width: 860px)').matches) {
          this.setMobileView(this.activePanel);
        }
      });
    });

    document.querySelectorAll('.tab-btn').forEach((el) => {
      el.addEventListener('click', () => {
        const tab = el.dataset.tab;
        this.setMobileView(tab);
        if (tab !== 'graph') {
          this.activePanel = tab === 'note' ? 'note' : tab;
          this.renderRightPanels();
          this.updateActionActiveState();
        }
      });
    });

    $('chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleChatSubmit();
    });

    $('btn-quiz').addEventListener('click', () => this.startQuiz());
  }

  // ---------------- 知識クイズ ----------------
  startQuiz() {
    if (this.quizPending) return;
    const learned = this.state.nodes.filter((n) => n.category !== 'core');
    if (learned.length === 0) {
      this.pushAIReply('まだ何も学んでいないから、クイズはもう少し待ってね。');
      return;
    }
    const node = pick(learned);
    const correctKey = node.category;
    const otherKeys = shuffle(CATEGORY_LIST.map((c) => c.key).filter((k) => k !== correctKey)).slice(0, 3);
    const choiceKeys = shuffle([correctKey, ...otherKeys]);

    this.quizPending = { node, correctKey };
    this.state.chatHistory.push({ role: 'ai', text: `🧠 クイズ: 「${node.label}」は、どの力に関係していると思う?`, at: Date.now() });
    this.renderChatLog();
    this._renderQuizChoices(choiceKeys);
    $('btn-quiz').disabled = true;
    this.markChanged();
  }

  _renderQuizChoices(choiceKeys) {
    const log = $('chat-log');
    const wrap = document.createElement('div');
    wrap.id = 'quiz-choices';
    wrap.className = 'quiz-choices';
    for (const key of choiceKeys) {
      const cat = CATEGORIES[key];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-choice-btn';
      btn.style.setProperty('--cat-color', cat.color);
      btn.innerHTML = `${cat.icon} ${cat.label}`;
      btn.addEventListener('click', () => this._answerQuiz(key));
      wrap.appendChild(btn);
    }
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  _answerQuiz(chosenKey) {
    if (!this.quizPending) return;
    const { node, correctKey } = this.quizPending;
    this.quizPending = null;
    const wrap = document.getElementById('quiz-choices');
    if (wrap) wrap.remove();

    const chosenCat = CATEGORIES[chosenKey];
    this.state.chatHistory.push({ role: 'user', text: `「${chosenCat.label}」だと思う`, at: Date.now() });

    const correct = chosenKey === correctKey;
    const line = pick(correct ? QUIZ_RIGHT_LINES : QUIZ_WRONG_LINES);
    const note = correct ? '' : `(正解は「${CATEGORIES[correctKey].label}」だったよ)`;
    this.pushAIReply(note ? `${line} ${note}` : line);

    applyEffects(this.state, correct ? { [correctKey]: 3, bond: 2 } : { bond: 1 });
    this.state.quizStreak = correct ? (this.state.quizStreak || 0) + 1 : 0;

    $('btn-quiz').disabled = false;
    this.renderTopbar();
    this.markChanged();
  }

  async handleChatSubmit() {
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    this.state.chatHistory.push({ role: 'user', text, at: Date.now() });
    this.state.stats.bond = Math.min(100, this.state.stats.bond + 1);
    this.renderChatLog();
    this.markChanged();

    if (this.llmSettings.enabled) {
      this.showThinking(true);
      try {
        const reply = await generateLLMReply(this.state, this.llmSettings);
        this.pushAIReply(reply);
        this.setLLMStatus('on');
      } catch (err) {
        const fallback = generateReply(this.state, text);
        this.pushAIReply(fallback);
        this.setLLMStatus('error', describeError(err));
      } finally {
        this.showThinking(false);
      }
    } else {
      window.setTimeout(() => {
        const reply = generateReply(this.state, text);
        this.pushAIReply(reply);
      }, 420 + Math.random() * 380);
    }
  }

  pushAIReply(text) {
    this.state.chatHistory.push({ role: 'ai', text, at: Date.now() });
    this.state.chatHistory = this.state.chatHistory.slice(-60);
    this.renderChatLog();
    this.renderTopbar();
    this.markChanged();
  }

  showThinking(on) {
    const log = $('chat-log');
    let bubble = document.getElementById('chat-thinking-bubble');
    if (on) {
      if (!bubble) {
        bubble = document.createElement('div');
        bubble.id = 'chat-thinking-bubble';
        bubble.className = 'chat-msg from-ai thinking';
        bubble.textContent = '考えている…';
        log.appendChild(bubble);
      }
      log.scrollTop = log.scrollHeight;
    } else if (bubble) {
      bubble.remove();
    }
  }

  // ---------------- ローカルLLM設定 ----------------
  _bindSettings() {
    const openModal = () => {
      $('llm-enabled').checked = this.llmSettings.enabled;
      $('llm-baseurl').value = this.llmSettings.baseUrl;
      $('llm-model').value = this.llmSettings.model;
      $('llm-apikey').value = this.llmSettings.apiKey;
      $('llm-test-result').textContent = '';
      $('llm-test-result').className = 'llm-test-result';
      $('settings-modal').hidden = false;
    };
    $('btn-menu').addEventListener('click', openModal);
    $('llm-status').addEventListener('click', openModal);

    const persist = () => {
      this.llmSettings = {
        enabled: $('llm-enabled').checked,
        baseUrl: $('llm-baseurl').value.trim() || DEFAULT_LLM_SETTINGS.baseUrl,
        model: $('llm-model').value.trim(),
        apiKey: $('llm-apikey').value.trim(),
      };
      saveLLMSettings(this.llmSettings);
      this.setLLMStatus(this.llmSettings.enabled ? 'on' : 'off');
    };

    $('btn-settings-close').addEventListener('click', () => {
      persist();
      $('settings-modal').hidden = true;
    });

    $('btn-llm-test').addEventListener('click', async () => {
      const testSettings = {
        baseUrl: $('llm-baseurl').value.trim(),
        model: $('llm-model').value.trim(),
        apiKey: $('llm-apikey').value.trim(),
      };
      const resultEl = $('llm-test-result');
      resultEl.textContent = '接続テスト中…(モデル初回読み込み時は1分近くかかることがあります)';
      resultEl.className = 'llm-test-result';
      const res = await testLLMConnection(testSettings);
      resultEl.textContent = res.message;
      resultEl.className = 'llm-test-result ' + (res.ok ? 'ok' : 'fail');
    });

    this.setLLMStatus(this.llmSettings.enabled ? 'on' : 'off');
  }

  setLLMStatus(kind) {
    const badge = $('llm-status');
    if (!badge) return;
    badge.classList.remove('on', 'error');
    if (kind === 'on') { badge.classList.add('on'); badge.textContent = '🟢 ローカルLLM接続中'; }
    else if (kind === 'error') { badge.classList.add('error'); badge.textContent = '🔴 接続失敗(テンプレートで応答)'; }
    else { badge.textContent = '⚪ テンプレート応答'; }
  }

  setMobileView(view) {
    this.mobileView = view;
    $('layout').dataset.mobileView = view;
    document.querySelectorAll('.tab-btn').forEach((el) => {
      el.classList.toggle('active', el.dataset.tab === view);
    });
  }

  updateActionActiveState() {
    document.querySelectorAll('.action-item').forEach((el) => {
      el.classList.toggle('active-item', el.dataset.panel === this.activePanel);
    });
  }

  hideOnboarding() { $('onboarding-modal').hidden = true; $('onboarding-modal').style.display = 'none'; }

  // ---------------- 全体描画 ----------------
  renderAll() {
    this.renderTopbar();
    this.renderCategoryLists();
    this.renderRightPanels();
    this.updateActionActiveState();
  }

  renderTopbar() {
    const s = this.state;
    $('ai-name').textContent = s.aiName;
    const stage = getStageInfo(s);
    $('ai-stage').textContent = `${stage.title} · ${stage.sub}`;

    const bar = $('stat-bars');
    bar.innerHTML = '';
    for (const meta of STAT_META) {
      const val = Math.round(s.stats[meta.key]);
      const chip = document.createElement('div');
      chip.className = 'stat-chip';
      chip.innerHTML = `
        <span class="dot" style="background:${meta.color}"></span>
        <span>${meta.label}</span>
        <span class="stat-track"><span class="stat-fill" style="width:${val}%;background:${meta.color}"></span></span>
      `;
      bar.appendChild(chip);
    }

    $('focus-display').textContent = `◆ ${Math.floor(s.focusPoints)}/${s.focusCap}`;

    const days = Math.floor((Date.now() - s.createdAt) / 86_400_000);
    $('age-display').textContent = days <= 0 ? '出会って今日でまだ1日目' : `出会って${days}日目`;
    $('node-count-display').textContent = `${totalLearnedNodes(s)} 個のノートを記憶`;
  }

  renderCategoryLists() {
    const s = this.state;
    const list = $('category-list');
    const bar = $('category-filter-bar');
    list.innerHTML = '';
    bar.innerHTML = '';

    const makeAllChip = () => {
      const li = document.createElement('li');
      li.className = this.graph.filterCategory === null ? 'active' : '';
      li.innerHTML = `<span class="cat-dot" style="background:#888"></span><span>すべて</span>`;
      li.addEventListener('click', () => this.setFilter(null));
      list.appendChild(li);

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (this.graph.filterCategory === null ? ' active' : '');
      chip.textContent = 'すべて';
      chip.addEventListener('click', () => this.setFilter(null));
      bar.appendChild(chip);
    };
    makeAllChip();

    for (const cat of CATEGORY_LIST) {
      const count = s.nodes.filter((n) => n.category === cat.key).length;
      const li = document.createElement('li');
      li.className = this.graph.filterCategory === cat.key ? 'active' : '';
      li.innerHTML = `<span class="cat-dot" style="background:${cat.color}"></span><span>${cat.label}</span><span class="cat-count">${count}</span>`;
      li.addEventListener('click', () => this.setFilter(cat.key));
      list.appendChild(li);

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.style.color = this.graph.filterCategory === cat.key ? cat.color : '';
      chip.className = 'chip' + (this.graph.filterCategory === cat.key ? ' active' : '');
      chip.textContent = `${cat.icon} ${cat.label}`;
      chip.addEventListener('click', () => this.setFilter(cat.key));
      bar.appendChild(chip);
    }
  }

  setFilter(key) {
    this.graph.filterCategory = key;
    this.renderCategoryLists();
  }

  renderRightPanels() {
    for (const name of ['note', 'feed', 'chat', 'log']) {
      $(`panel-${name}`).hidden = name !== this.activePanel;
    }
    if (this.activePanel === 'note') this.renderNotePanel();
    if (this.activePanel === 'feed') { this.renderFeedPanel(); this.renderReflectPanel(); }
    if (this.activePanel === 'chat') this.renderChatLog();
    if (this.activePanel === 'log') this.renderLogPanel();
  }

  renderNotePanel() {
    const s = this.state;
    const node = s.nodes.find((n) => n.id === this.selectedNodeId) || s.nodes[0];
    const panel = $('panel-note');
    const cat = node.category === 'core' ? null : CATEGORIES[node.category];
    const connections = s.edges
      .filter((e) => e.a === node.id || e.b === node.id)
      .map((e) => (e.a === node.id ? e.b : e.a))
      .map((id) => s.nodes.find((n) => n.id === id))
      .filter(Boolean);
    const mastery = node.mastery || 1;

    let deepenHtml = '';
    if (node.category !== 'core') {
      const dots = Array.from({ length: MAX_MASTERY }, (_, i) => (i < mastery ? '●' : '○')).join('');
      const maxed = mastery >= MAX_MASTERY;
      const cost = deepenCost(node);
      const canAfford = s.focusPoints >= cost;
      deepenHtml = `
        <div class="mastery-row">
          <span class="mastery-dots" style="color:${cat.color}">${dots}</span>
          <span class="mastery-label">習熟度 ${mastery}/${MAX_MASTERY}</span>
        </div>
        <button id="btn-deepen" type="button" class="btn-secondary deepen-btn" ${maxed || !canAfford ? 'disabled' : ''}>
          ${maxed ? 'これ以上は深まらない' : `深める(◆ ${cost})`}
        </button>
      `;
    }

    panel.innerHTML = `
      <div class="note-category">${node.category === 'core' ? 'コア意識' : cat.label}</div>
      <h2><span class="note-badge" style="background:${cat ? cat.color : 'var(--accent)'}"></span>${node.label}</h2>
      <div class="note-desc">${describeNode(node)}</div>
      <div class="note-meta">習得日: ${new Date(node.createdAt).toLocaleDateString('ja-JP')} ・ つながり: ${connections.length}${node.category !== 'core' ? `/${MAX_NODE_DEGREE}` : ''}</div>
      ${deepenHtml}
      <ul class="conn-list"></ul>
    `;
    const connList = panel.querySelector('.conn-list');
    for (const c of connections) {
      const li = document.createElement('li');
      li.textContent = `→ ${c.label}`;
      li.addEventListener('click', () => {
        this.selectedNodeId = c.id;
        this.graph.selectedId = c.id;
        this.graph.focusOn(c.id);
        this.renderNotePanel();
      });
      connList.appendChild(li);
    }

    const deepenBtn = document.getElementById('btn-deepen');
    if (deepenBtn) {
      deepenBtn.addEventListener('click', () => {
        const res = deepenNode(s, node.id);
        if (res.ok) {
          this.graph.spawnSparkles(node.x, node.y, 10);
          this.showFloatingMessage(`「${node.label}」の理解が深まった`);
          this.renderNotePanel();
          this.renderTopbar();
          this.markChanged();
        }
      });
    }
  }

  renderFeedPanel() {
    const s = this.state;
    const grid = $('feed-grid');
    grid.innerHTML = '';
    const cost = focusCost(s);
    for (const cat of CATEGORY_LIST) {
      const used = (s.usedWords[cat.key] || []).length;
      const total = cat.words.length;
      const exhausted = used >= total;
      const affordable = s.focusPoints >= cost;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'feed-card' + (!affordable || exhausted ? ' disabled' : '');
      card.innerHTML = `
        <span class="dot" style="background:${cat.color}"></span>
        <span class="info">
          <span class="name">${cat.icon} ${cat.label}</span>
          <span class="stat">${cat.desc} ・ 現在値 ${Math.round(s.stats[cat.key])} ・ ${used}/${total}</span>
        </span>
        <span class="cost">${exhausted ? '習得済み' : `◆ ${cost}`}</span>
      `;
      card.addEventListener('click', () => {
        if (exhausted || !affordable) return;
        const res = feedKnowledge(s, cat.key);
        if (res.ok) {
          this.selectedNodeId = res.node.id;
          this.graph.selectedId = res.node.id;
          this.renderTopbar();
          this.renderCategoryLists();
          this.renderFeedPanel();
          this.markChanged();
        }
      });
      grid.appendChild(card);
    }
  }

  renderReflectPanel() {
    const s = this.state;
    const optionsWrap = $('reflect-options');
    const activeWrap = $('reflect-active');
    if (s.reflect) {
      optionsWrap.hidden = true;
      activeWrap.hidden = false;
      this._updateReflectCountdown();
    } else {
      optionsWrap.hidden = false;
      activeWrap.hidden = true;
      optionsWrap.innerHTML = '';
      for (const opt of REFLECT_OPTIONS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'reflect-btn';
        btn.textContent = `${opt.label} 内省させる`;
        btn.addEventListener('click', () => {
          startReflect(s, opt.ms);
          this.renderReflectPanel();
          this.renderReflectBanner();
          this.markChanged();
        });
        optionsWrap.appendChild(btn);
      }
    }
  }

  _updateReflectCountdown() {
    const s = this.state;
    if (!s.reflect) return;
    const remaining = reflectRemainingMs(s);
    const total = s.reflect.ms;
    const pct = Math.min(100, ((total - remaining) / total) * 100);
    const remainEl = $('reflect-remaining');
    const fillEl = $('reflect-progress');
    const sparksEl = $('reflect-sparks');
    if (remainEl) remainEl.textContent = formatDuration(remaining);
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (sparksEl) sparksEl.textContent = String(s.reflect.sparksClaimed || 0);
  }

  renderReflectBanner() {
    const s = this.state;
    const banner = $('reflect-banner');
    if (s.reflect) {
      banner.hidden = false;
      $('reflect-banner-text').textContent = `内省中 · 光る粒をタップ · 残り ${formatDuration(reflectRemainingMs(s))}`;
    } else {
      banner.hidden = true;
    }
  }

  // 内省中、画面に浮かぶクリック可能な「気づきの粒」を出す(内省ミニゲーム)
  spawnReflectSpark() {
    const wrap = document.getElementById('graph-wrap');
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const marginX = 50, marginTop = 90, marginBottom = 60;
    const w = Math.max(1, rect.width - marginX * 2);
    const h = Math.max(1, rect.height - marginTop - marginBottom);
    const x = marginX + Math.random() * w;
    const y = marginTop + Math.random() * h;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'insight-spark';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.title = '気づきの粒 — タップして捕まえよう';
    let claimed = false;
    const lifeTimer = window.setTimeout(() => el.remove(), 3200);
    el.addEventListener('click', () => {
      if (claimed) return;
      claimed = true;
      window.clearTimeout(lifeTimer);
      el.classList.add('claimed');
      window.setTimeout(() => el.remove(), 260);

      const reward = claimReflectSpark(this.state);
      if (reward) {
        const msg = reward.pair
          ? `気づきをキャッチ!「${reward.pair.aLabel}」と「${reward.pair.bLabel}」が繋がった`
          : '気づきをキャッチ!集中力が回復した。';
        this.showFloatingMessage(msg);
        if (this.activePanel === 'feed') this._updateReflectCountdown();
        this.renderTopbar();
        this.markChanged();
      }
    });
    wrap.appendChild(el);
  }

  // reflect完了チェック(main.jsのループから毎秒呼ばれる)
  tickReflect() {
    const s = this.state;
    if (!s.reflect) return;
    this.renderReflectBanner();
    if (this.activePanel === 'feed') this._updateReflectCountdown();

    const insight = tickReflectProgress(s);
    if (insight) {
      this.showFloatingMessage(`「${insight.aLabel}」と「${insight.bLabel}」${pick(REFLECT_INSIGHT_LINES)}`);
      this.markChanged();
    }

    if (reflectRemainingMs(s) <= 0) {
      const summary = resolveReflect(s);
      document.querySelectorAll('.insight-spark').forEach((el) => el.remove());
      this.renderReflectBanner();
      this.renderTopbar();
      if (this.activePanel === 'feed') this.renderReflectPanel();
      this.markChanged();
      return summary;
    }
    return null;
  }

  renderChatLog() {
    const log = $('chat-log');
    log.innerHTML = '';
    for (const m of this.state.chatHistory) {
      const div = document.createElement('div');
      div.className = 'chat-msg ' + (m.role === 'ai' ? 'from-ai' : 'from-user');
      div.textContent = m.text;
      log.appendChild(div);
    }
    log.scrollTop = log.scrollHeight;
  }

  renderLogPanel() {
    this.renderCollectionSummary();
    const list = $('event-log-list');
    list.innerHTML = '';
    if (this.state.eventLog.length === 0) {
      list.innerHTML = '<li class="log-result">まだ何も記録されていない。育成を進めると、ここに出来事が記録されていくよ。</li>';
      return;
    }
    for (const entry of this.state.eventLog) {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="log-title">${entry.title}</div>
        <div class="log-choice">選択: ${entry.choiceLabel}</div>
        <div class="log-result">${entry.result}</div>
        <div class="log-time">${new Date(entry.at).toLocaleString('ja-JP')}</div>
      `;
      list.appendChild(li);
    }
  }

  renderCollectionSummary() {
    const wrap = $('collection-summary');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (const cat of CATEGORY_LIST) {
      const used = (this.state.usedWords[cat.key] || []).length;
      const total = cat.words.length;
      const pct = Math.round((used / total) * 100);
      const row = document.createElement('div');
      row.className = 'collection-row';
      row.innerHTML = `
        <div class="collection-label">
          <span style="color:${cat.color}">${cat.icon} ${cat.label}</span>
          <span class="collection-count">${used} / ${total}</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${cat.color}"></div></div>
      `;
      wrap.appendChild(row);
    }
  }

  // ---------------- イベントモーダル ----------------
  showEventModal() {
    const s = this.state;
    const event = s.pendingEvent;
    if (!event) return;
    const modal = $('event-modal');
    $('event-title').textContent = event.title;
    $('event-text').textContent = event.text;
    const choicesWrap = $('event-choices');
    choicesWrap.innerHTML = '';
    event.choices.forEach((choice, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'event-choice-btn';
      btn.textContent = choice.label;
      btn.addEventListener('click', () => {
        const resolved = resolveEvent(s, idx);
        $('event-text').textContent = resolved.result;
        choicesWrap.innerHTML = '';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-primary';
        closeBtn.textContent = '閉じる';
        closeBtn.addEventListener('click', () => {
          modal.hidden = true;
          this.renderAll();
          this.markChanged();
        });
        choicesWrap.appendChild(closeBtn);
        this.renderTopbar();
      });
      choicesWrap.appendChild(btn);
    });
    modal.hidden = false;
  }

  showEvolveModal(stage) {
    $('evolve-title').textContent = stage.title;
    $('evolve-sub').textContent = `${stage.sub} — 新しい段階へ進化した。`;
    const modal = $('evolve-modal');
    modal.hidden = false;
    $('btn-evolve-close').onclick = () => { modal.hidden = true; };
  }
}
