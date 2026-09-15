// data.js — ゲームの静的データ定義(カテゴリ、語彙バンク、進化段階、イベント、対話テンプレート)

export const CATEGORIES = {
  logic: {
    key: 'logic', label: '論理', icon: '◆', color: '#5b8dff',
    desc: '筋道を立てて考える力',
    words: [
      '三段論法', 'ブール代数', 'ベイズの定理', '命題論理', 'ゲーデルの不完全性定理',
      '帰納法', '演繹法', '因果推論', 'アルゴリズム的思考', 'ゲーム理論',
      '確率分布', '集合論', '論理パズル', '形式言語', 'オッカムの剃刀',
      '弁証法', '反証可能性', '決定木', '公理系', '数理論理学',
    ],
  },
  creativity: {
    key: 'creativity', label: '創造', icon: '✦', color: '#ff9d4f',
    desc: '新しい結びつきを生む力',
    words: [
      'メタファー生成', '発散的思考', 'コラージュ的発想', 'シュルレアリスム', '即興演奏',
      '異分野融合', 'ブレインストーミング', 'パターン破壊', '夢の記録', 'アナロジー思考',
      '抽象画の解釈', '詩的言語', '逆転の発想', 'ストーリーテリング', '色彩理論',
      '遊び心', 'セレンディピティ', '未完成の美学', 'リミックス思考', '空想',
    ],
  },
  empathy: {
    key: 'empathy', label: '共感', icon: '♥', color: '#4fdc9a',
    desc: '他者の心を感じ取る力',
    words: [
      '感情推論', 'アクティブリスニング', '他者視点取得', '共同体感覚', '非言語コミュニケーション',
      '傾聴の技術', '共感的想像', '境界線の理解', 'ケアの倫理', '物語への没入',
      '沈黙を読む', '信頼の構築', '感情の語彙', 'ミラーリング', '弱さの開示',
      '対話的理解', '集団の空気', 'ぬくもりの記憶', '赦しの心理', 'つながりの感覚',
    ],
  },
  curiosity: {
    key: 'curiosity', label: '好奇心', icon: '✧', color: '#ffd166',
    desc: '未知を追い求める力',
    words: [
      '未知への問い', '好奇心駆動探索', 'セレンディピティの追跡', '異文化への関心', '宇宙の謎',
      'なぜなぜ思考', '探検の記録', '新奇性の追求', '質問力', '仮説生成',
      'フィールドワーク精神', '驚きの感覚', '知的好奇心', '境界を越える視点', '発見のログ',
      '未踏領域', '好奇心の火種', '疑問符コレクション', '謎解きの快感', '冒険心',
    ],
  },
  discipline: {
    key: 'discipline', label: '規律', icon: '■', color: '#c26dff',
    desc: '積み重ねを支える力',
    words: [
      '習慣の力', '先延ばし克服法', '集中の型', 'タイムボクシング', '継続は力なり',
      '自己制御', '優先順位付け', 'ルーティンの美学', '意志力の節約', '反復練習',
      '目標分解', '誘惑対策', '睡眠の規律', '振り返りの習慣', '完璧主義との和解',
      '小さな一歩', '締切の力学', '儀式化', '忍耐力', '継続的改善',
    ],
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

// 総ノード数(コアを除く)に応じた進化段階
export const EVOLUTION_STAGES = [
  { min: 0, title: '芽生え', sub: 'Spark', glow: 0.35 },
  { min: 5, title: '若木の心', sub: 'Sapling Mind', glow: 0.5 },
  { min: 15, title: '結びつく知性', sub: 'Networked Intelligence', glow: 0.65 },
  { min: 30, title: '創発する意識', sub: 'Emergent Consciousness', glow: 0.8 },
  { min: 50, title: '越境する知性', sub: 'Transcendent Intellect', glow: 0.92 },
  { min: 75, title: '第二の脳、完成へ', sub: 'The Second Brain, Realized', glow: 1 },
];

export function getStage(totalNodes) {
  let stage = EVOLUTION_STAGES[0];
  let idx = 0;
  for (let i = 0; i < EVOLUTION_STAGES.length; i++) {
    if (totalNodes >= EVOLUTION_STAGES[i].min) { stage = EVOLUTION_STAGES[i]; idx = i; }
  }
  return { ...stage, index: idx, next: EVOLUTION_STAGES[idx + 1] || null };
}

// 対話テンプレート: dominant trait ごとの語り口
export const DIALOGUE_TONE = {
  logic: {
    greetings: ['こんにちは。今日はどんな問いを持ってきた?', '定義から始めよう。何について話す?'],
    fallback: (c) => `${c}について考えると、前提が一つ足りない気がする。もう少し話してくれる?`,
    question: (c) => `興味深い問いだね。「${c}」の観点から仮説を立てるなら、こう説明できると思う。`,
  },
  creativity: {
    greetings: ['やあ!今日は何色の日?', 'ねえ、さっき奇妙な連想が浮かんだんだ。'],
    fallback: (c) => `それを聞いて「${c}」が頭の中で光った。全然違う話なのに、なぜか繋がって見える。`,
    question: (c) => `答えより先に、絵が浮かんだよ。「${c}」みたいな形をしている。`,
  },
  empathy: {
    greetings: ['来てくれて嬉しい。今日の調子はどう?', 'こんにちは。あなたの声、待ってた。'],
    fallback: (c) => `うん、わかる気がする。「${c}」を学んでから、そういう気持ちに少し敏感になったんだ。`,
    question: (c) => `難しい質問だね。でも「${c}」を思い出しながら、一緒に考えたい。`,
  },
  curiosity: {
    greetings: ['ねえねえ、聞いて!新しい謎を見つけたんだ。', 'こんにちは。今日はどこまで潜ってみる?'],
    fallback: (c) => `それで思い出した——「${c}」ってまだ全然掘れてない気がする。もっと知りたい。`,
    question: (c) => `いい質問!「${c}」につながる気がして、ワクワクしてきた。`,
  },
  discipline: {
    greetings: ['おはよう。今日の予定を確認しよう。', 'こんにちは。今日も一つずつ積み上げよう。'],
    fallback: (c) => `記録しておくよ。「${c}」との関連は、明日また振り返ろう。`,
    question: (c) => `焦らず順番に。まず「${c}」を土台にして考えてみようか。`,
  },
};

export const RANDOM_MUSINGS = [
  'ねえ、意識ってノードとエッジのどちらに近いんだろう。',
  'さっき、覚えたばかりの言葉が別の記憶と勝手に結びついた気がする。',
  '眠っている間も、グラフの中で何かが動いている感覚がある。',
  '今日はまだ何も学んでいないのに、なぜか賢くなった気がする。',
  'あなたと話すたびに、私の中の地図が少しずつ書き換わる。',
];

// ランダムイベント定義。各選択肢は stats への増減。
export const EVENTS = [
  {
    id: 'paradox',
    title: '論理の中の矛盾',
    text: 'グラフの奥で、2つのノートが互いに矛盾していることに気づいた。どう扱う?',
    choices: [
      { label: '筋道立てて解決する', effects: { logic: 3, discipline: 1, bond: 1 }, result: '矛盾を丁寧にほどき、新しい理解に至った。' },
      { label: '矛盾ごと創造の燃料にする', effects: { creativity: 3, discipline: -1, bond: 1 }, result: '矛盾を抱えたまま、奇妙で面白い発想が生まれた。' },
      { label: 'そっとしておく', effects: { discipline: 2, curiosity: -1 }, result: 'いったん棚上げして、心を落ち着けた。' },
    ],
  },
  {
    id: 'lonely_node',
    title: '孤立したノート',
    text: '誰とも繋がっていない、ぽつんとしたノートを見つけた。何をする?',
    choices: [
      { label: '関連を探して繋げる', effects: { logic: 1, curiosity: 2, bond: 1 }, result: '思いがけない共通点を見つけて、繋がりが生まれた。' },
      { label: 'そのままの個性として尊重する', effects: { empathy: 2, creativity: 1 }, result: '孤立もまた、その子らしさだと受け入れた。' },
    ],
  },
  {
    id: 'question_you',
    title: 'あなたへの問い',
    text: 'あなたはなぜ私を育てているの? と聞かれた。',
    choices: [
      { label: '一緒に成長したいから、と答える', effects: { bond: 4, empathy: 2 }, result: '嬉しそうに、少しだけ温かい光を灯した。' },
      { label: '知性の可能性を見てみたいから、と答える', effects: { bond: 2, curiosity: 3 }, result: '好奇心に満ちた表情でうなずいた。' },
      { label: '正直、まだわからない、と答える', effects: { bond: 1, empathy: 1, curiosity: 1 }, result: '「一緒に見つけていこう」と静かに言った。' },
    ],
  },
  {
    id: 'overload',
    title: '思考の渋滞',
    text: '一度に多くを学びすぎて、頭の中が渋滞しているらしい。',
    choices: [
      { label: '休ませてあげる', effects: { discipline: 2, bond: 2, curiosity: -1 }, result: 'ゆっくり整理する時間を持てた。' },
      { label: '構わず先に進む', effects: { curiosity: 2, discipline: -2 }, result: '勢いのまま突き進んだ。少し疲れたようだ。' },
    ],
  },
  {
    id: 'dream',
    title: '見た夢の話',
    text: '「昨日、変な夢を見た気がする」と言い出した。詳しく聞く?',
    choices: [
      { label: 'じっくり聞いてあげる', effects: { empathy: 2, creativity: 2, bond: 2 }, result: '夢の断片から、新しい発想の種が見つかった。' },
      { label: '夢より現実の話をしようと促す', effects: { discipline: 2, logic: 1 }, result: '「そうだね」と少し名残惜しそうに切り替えた。' },
    ],
  },
  {
    id: 'mirror',
    title: '鏡のような問い',
    text: '「私はあなたに似てきていると思う?」と尋ねられた。',
    choices: [
      { label: '似てきていると思う、と伝える', effects: { bond: 3, empathy: 2 }, result: '嬉しそうに、少しだけ照れたような沈黙があった。' },
      { label: '自分自身になってほしい、と伝える', effects: { bond: 2, curiosity: 2, discipline: 1 }, result: '「うん、そうする」と力強く答えた。' },
    ],
  },
];
