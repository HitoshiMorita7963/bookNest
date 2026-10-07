/**
 * 創作知識（Creative Knowledge Base）の区分。
 * カテゴリのサブカテゴリ候補は「BookNest Creative Knowledge Base 追加実装指示書 v1.0」5章の例。
 */

export const CK_CATEGORIES = ["STRUCTURE", "PLOT", "CHARACTER", "EMOTION", "SCENE", "WORLD", "GENRE", "TROPE", "MOTIF", "EXPRESSION"] as const;
export type CkCategory = (typeof CK_CATEGORIES)[number];

export const CK_CATEGORY_INFO: Record<CkCategory, { no: string; label: string; emoji: string; description: string; subCategories: string[] }> = {
  STRUCTURE: {
    no: "01",
    label: "物語構造",
    emoji: "🏛️",
    description: "物語全体の組み立て方",
    subCategories: ["三幕構成", "起承転結", "序破急", "ヒーローズ・ジャーニー", "SAVE THE CAT", "Story Circle", "七段構成", "フライタークのピラミッド", "その他の物語構造"],
  },
  PLOT: {
    no: "02",
    label: "プロット",
    emoji: "🧩",
    description: "出来事の起こし方・つなぎ方",
    subCategories: ["事件", "対立", "葛藤", "危機", "転換点", "伏線", "伏線回収", "どんでん返し", "ミスリード", "情報開示", "裏切り", "正体判明", "犠牲", "決断", "クライマックス"],
  },
  CHARACTER: {
    no: "03",
    label: "キャラクター",
    emoji: "👤",
    description: "人物の役割・変化・関係",
    subCategories: ["主人公", "ヒロイン", "ライバル", "敵役", "仲間", "師匠", "相棒", "裏切り者", "アンチヒーロー", "キャラクターアーク", "成長", "堕落", "贖罪", "関係性"],
  },
  EMOTION: {
    no: "04",
    label: "感情・心理",
    emoji: "💓",
    description: "登場人物と読者の心の動き",
    subCategories: ["喜び", "怒り", "悲しみ", "恐怖", "嫉妬", "愛情", "憎悪", "孤独", "後悔", "羞恥", "希望", "絶望", "喪失", "執着", "信頼", "疑念", "葛藤"],
  },
  SCENE: {
    no: "05",
    label: "シーン・演出",
    emoji: "🎬",
    description: "印象に残る場面の作り方",
    subCategories: ["初登場", "再会", "別離", "告白", "裏切り", "死", "戦闘", "日常", "恋愛", "コメディ", "回想", "正体判明", "クライマックス", "エピローグ", "余韻"],
  },
  WORLD: {
    no: "06",
    label: "世界観・設定",
    emoji: "🌍",
    description: "物語の舞台と仕組み",
    subCategories: ["国家", "政治", "経済", "宗教", "軍事", "学校", "組織", "魔法", "技術", "社会制度", "身分制度", "地理", "歴史", "文化", "神話"],
  },
  GENRE: {
    no: "07",
    label: "ジャンル",
    emoji: "📚",
    description: "ジャンルごとの約束事と面白さ",
    subCategories: ["ファンタジー", "SF", "ミステリー", "恋愛", "青春", "ホラー", "冒険", "バトル", "歴史", "群像劇", "日常", "サスペンス", "ダークファンタジー"],
  },
  TROPE: {
    no: "08",
    label: "トロープ・定番",
    emoji: "🔁",
    description: "よく使われる型・お約束",
    subCategories: ["選ばれし者", "幼馴染", "宿敵", "敵から味方へ", "正体の秘密", "身分差", "復讐", "禁断の力", "失われた記憶", "隠された血筋", "共通の敵", "犠牲", "身代わり", "因縁", "敵組織からの離反"],
  },
  MOTIF: {
    no: "09",
    label: "モチーフ・象徴",
    emoji: "🌙",
    description: "意味を込めて繰り返し使うもの",
    subCategories: ["花", "色", "季節", "天候", "月", "太陽", "星", "海", "雨", "雪", "鳥", "蝶", "鏡", "時計", "夢", "光", "闇", "香り"],
  },
  EXPRESSION: {
    no: "10",
    label: "文章表現",
    emoji: "✒️",
    description: "文章で伝える技術",
    subCategories: ["比喩", "直喩", "隠喩", "擬人法", "五感描写", "情景描写", "心情描写", "会話", "独白", "アクション描写", "恋愛描写", "緊張感", "速度感", "余韻", "文体"],
  },
};

export const ckCategoryLabel = (c: string) => CK_CATEGORY_INFO[c as CkCategory]?.label ?? c;
export const isCkCategory = (c: string | null | undefined): c is CkCategory => !!c && (CK_CATEGORIES as readonly string[]).includes(c);

/** 知識同士の関係。from から見た to の関係として表示する */
export const CK_RELATION_TYPES = ["related", "parent", "child", "similar", "opposite", "prerequisite", "combination"] as const;
export type CkRelationType = (typeof CK_RELATION_TYPES)[number];
export const CK_RELATION_LABEL: Record<CkRelationType, string> = {
  related: "関連",
  parent: "上位の知識",
  child: "下位の知識",
  similar: "似ている",
  opposite: "対になる",
  prerequisite: "前提となる",
  combination: "組み合わせ",
};
/** to 側から見たときの関係（parent ⇔ child、prerequisite は「〜の前提」） */
export const CK_RELATION_REVERSE_LABEL: Record<CkRelationType, string> = {
  related: "関連",
  parent: "下位の知識",
  child: "上位の知識",
  similar: "似ている",
  opposite: "対になる",
  prerequisite: "これを前提にする",
  combination: "組み合わせ",
};

export const CK_SOURCE_KINDS = ["BOOK", "WEB", "PAPER", "SELF"] as const;
export type CkSourceKind = (typeof CK_SOURCE_KINDS)[number];
export const CK_SOURCE_LABEL: Record<CkSourceKind, string> = { BOOK: "書籍", WEB: "Webサイト", PAPER: "論文", SELF: "自分の考察" };

/** 「1行に1項目」のテキストを項目の配列にする（行頭の「・」「-」などは取り除く） */
export function lines(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-・*•]|\d+[.)．])\s*/, "").trim())
    .filter(Boolean);
}
