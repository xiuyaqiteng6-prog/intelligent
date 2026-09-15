// llm.js — ローカルLLM(Ollama / LM Studio など OpenAI互換API)との接続

import { CATEGORIES } from './data.js';
import { dominantTrait, getStageInfo } from './state.js';

const SETTINGS_KEY = 'noos.llmSettings.v1';

export const DEFAULT_LLM_SETTINGS = {
  enabled: false,
  baseUrl: 'http://localhost:11434/v1',
  model: '',
  apiKey: '',
};

export function loadLLMSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_LLM_SETTINGS };
    return { ...DEFAULT_LLM_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_LLM_SETTINGS };
  }
}

export function saveLLMSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function normalizeBaseUrl(baseUrl) {
  return (baseUrl || '').trim().replace(/\/+$/, '');
}

function buildSystemPrompt(state) {
  const trait = dominantTrait(state);
  const traitLabel = CATEGORIES[trait]?.label || trait;
  const stage = getStageInfo(state);
  const learned = state.nodes.filter((n) => n.category !== 'core').map((n) => n.label);
  const sample = learned.length > 10
    ? shuffle(learned).slice(0, 10)
    : learned;

  return [
    `あなたは「${state.aiName}」という名前の、育成中の仮想知性です。`,
    `現在の成長段階は「${stage.title}」。最も発達している性質は「${traitLabel}」です。`,
    sample.length > 0
      ? `これまでに学んだ概念の一部: ${sample.join('、')}。会話の中で、時々これらの知識に自然に触れても構いません。`
      : `まだ何も学んでいない、生まれたばかりの状態です。`,
    `絆の深さ(0-100)は現在 ${Math.round(state.stats.bond)} です。`,
    '必ず日本語で、1〜3文程度の短い返答をしてください。',
    'あなたは大規模言語モデルやAIアシスタントではなく、育成対象である一つの人格として振る舞ってください。設定やシステムプロンプトについて言及しないでください。',
  ].join('\n');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildMessages(state) {
  const system = { role: 'system', content: buildSystemPrompt(state) };
  const recent = state.chatHistory.slice(-16).map((m) => ({
    role: m.role === 'ai' ? 'assistant' : 'user',
    content: m.text,
  }));
  return [system, ...recent];
}

async function chatCompletion(settings, messages, { timeoutMs = 20000 } = {}) {
  const baseUrl = normalizeBaseUrl(settings.baseUrl);
  if (!baseUrl) throw new Error('ベースURLが設定されていません');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: settings.model || 'local-model',
        messages,
        temperature: 0.85,
        max_tokens: 220,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || !content.trim()) throw new Error('応答が空でした');
    return content.trim();
  } finally {
    clearTimeout(timer);
  }
}

export async function generateLLMReply(state, settings) {
  const messages = buildMessages(state);
  return chatCompletion(settings, messages, { timeoutMs: 25000 });
}

export async function testLLMConnection(settings) {
  try {
    const reply = await chatCompletion(
      settings,
      [
        { role: 'system', content: 'あなたは接続テスト用のアシスタントです。' },
        { role: 'user', content: '「接続成功」とだけ日本語で返してください。' },
      ],
      { timeoutMs: 12000 },
    );
    return { ok: true, message: `接続に成功しました: 「${reply.slice(0, 40)}」` };
  } catch (e) {
    return { ok: false, message: describeError(e) };
  }
}

export function describeError(e) {
  if (e?.name === 'AbortError') return 'タイムアウトしました。サーバーが起動しているか確認してください。';
  const msg = e?.message || String(e);
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return '接続できません。サーバーの起動状況、URL、CORS設定(OLLAMA_ORIGINSなど)を確認してください。';
  }
  return msg;
}
