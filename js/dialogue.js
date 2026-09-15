// dialogue.js — チャット応答の簡易生成(テンプレート+性格ベース、外部通信なし)

import { DIALOGUE_TONE, RANDOM_MUSINGS } from './data.js';
import { dominantTrait } from './state.js';

function randomKnownConcept(state) {
  const learned = state.nodes.filter((n) => n.category !== 'core');
  if (learned.length === 0) return null;
  return learned[Math.floor(Math.random() * learned.length)].label;
}

const GREETING_RE = /(こんにちは|やあ|おはよう|こんばんは|hi|hello|よう)/i;
const THANKS_RE = /(ありがとう|thx|thanks|感謝)/i;

export function generateReply(state, userText) {
  const trait = dominantTrait(state);
  const tone = DIALOGUE_TONE[trait];
  const concept = randomKnownConcept(state);

  if (!userText || !userText.trim()) {
    return RANDOM_MUSINGS[Math.floor(Math.random() * RANDOM_MUSINGS.length)];
  }
  if (GREETING_RE.test(userText)) {
    return tone.greetings[Math.floor(Math.random() * tone.greetings.length)];
  }
  if (THANKS_RE.test(userText)) {
    return 'こちらこそ、話してくれてありがとう。少し絆が深まった気がする。';
  }
  if (userText.includes('?') || userText.includes('?')) {
    if (concept) return tone.question(concept);
    return 'まだ答えるための知識が足りない気がする。何か教えてくれる?';
  }
  if (concept) return tone.fallback(concept);
  return RANDOM_MUSINGS[Math.floor(Math.random() * RANDOM_MUSINGS.length)];
}
