/**
 * 本のジャンル・タグの自動提案（ルールベース）。
 * 国立国会図書館の日本十進分類（NDC）・叢書名（〇〇新書など）・タイトルや内容紹介のキーワードから推定する。
 * AI が使える場合は、この結果を下書きとして AI がより適切なものを選び直す（src/server/ai/features.ts）。
 */

export const GENRES = [
  "小説",
  "エッセイ",
  "新書",
  "ビジネス書",
  "自己啓発",
  "人文・思想",
  "歴史",
  "社会・政治",
  "経済",
  "科学",
  "IT・テクノロジー",
  "実用・暮らし",
  "趣味・アート",
  "旅行",
  "語学・学習",
  "漫画",
  "絵本・児童書",
  "その他",
] as const;
export type Genre = (typeof GENRES)[number];

/** 小説向けのタグ候補 */
export const FICTION_TAGS = [
  "ミステリー",
  "サスペンス",
  "ホラー",
  "SF",
  "ファンタジー",
  "恋愛",
  "青春",
  "ヒューマンドラマ",
  "家族",
  "動物",
  "歴史・時代",
  "お仕事",
  "純文学",
  "海外文学",
  "短編集",
  "ユーモア",
] as const;

/** 小説以外（新書・ビジネス書など）向けのタグ候補 */
export const NONFICTION_TAGS = [
  "教養",
  "IT",
  "AI",
  "料理",
  "旅",
  "健康",
  "お金",
  "経済",
  "経営",
  "マーケティング",
  "仕事術",
  "キャリア",
  "コミュニケーション",
  "心理学",
  "哲学",
  "歴史",
  "科学",
  "政治",
  "社会",
  "教育",
  "子育て",
  "語学",
  "アート",
  "音楽",
  "スポーツ",
  "暮らし",
] as const;

export interface ClassifyInput {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  seriesTitle?: string | null;
  publisher?: string | null;
  ndc?: string | null;
  subjects?: string[] | null;
}

export interface Classification {
  genre: string | null;
  tags: string[];
  /** AI が判定したシリーズ（レーベルではない作品のシリーズ）と巻数 */
  seriesTitle?: string | null;
  seriesNumber?: number | null;
}

const FICTION_GENRES = new Set(["小説"]);

/** NDC（例 "913.6"）からジャンルを推定 */
export function genreFromNdc(ndc: string | null | undefined): Genre | null {
  const m = ndc?.trim().match(/^(\d{3})(?:\.(\d+))?/);
  if (!m) return null;
  const n = Number(m[1]);
  const code = `${m[1]}${m[2] ? "." + m[2] : ""}`;
  // 文学（9類）：9x3 が小説、9x4・9x5 が評論・エッセイ・日記紀行、9x1 が詩歌
  if (n >= 900) {
    const last = n % 10;
    if (last === 3) return "小説";
    if (last === 4 || last === 5 || last === 6) return "エッセイ";
    return "小説";
  }
  if (code.startsWith("726.1")) return "漫画";
  if (code.startsWith("726.5") || code.startsWith("726.6")) return "絵本・児童書";
  if (n === 7 || (n >= 547 && n <= 549)) return "IT・テクノロジー";
  if (n < 100) return "人文・思想";
  if (n === 159) return "自己啓発";
  if (n < 200) return "人文・思想";
  if (n >= 290 && n < 300) return code.includes(".09") || n === 290 ? "旅行" : "歴史";
  if (n < 300) return "歴史";
  if (n === 335 || n === 336) return "ビジネス書";
  if (n >= 330 && n < 340) return "経済";
  if (n < 400) return "社会・政治";
  if (n === 498) return "実用・暮らし";
  if (n < 500) return "科学";
  if (n >= 590 && n < 600) return "実用・暮らし";
  if (n < 600) return "科学";
  if (n >= 670 && n < 680) return "ビジネス書";
  if (n === 689) return "旅行";
  if (n < 700) return "ビジネス書";
  if (n < 800) return "趣味・アート";
  return "語学・学習";
}

/** NDC から付けるタグ（小説以外） */
function tagsFromNdc(ndc: string | null | undefined): string[] {
  const m = ndc?.trim().match(/^(\d{3})/);
  if (!m) return [];
  const n = Number(m[1]);
  if (n === 7 || n === 547 || n === 548) return ["IT"];
  if (n >= 100 && n < 140) return ["哲学"];
  if (n >= 140 && n < 150) return ["心理学"];
  if (n >= 200 && n < 290) return ["歴史"];
  if (n >= 290 && n < 300) return ["旅"];
  if (n >= 310 && n < 320) return ["政治"];
  if (n >= 330 && n < 335) return ["経済"];
  if (n === 335 || n === 336) return ["経営"];
  if (n >= 360 && n < 370) return ["社会"];
  if (n >= 370 && n < 380) return ["教育"];
  if (n >= 400 && n < 490) return ["科学"];
  if (n >= 490 && n < 500) return ["健康"];
  if (n === 596) return ["料理"];
  if (n === 599) return ["子育て"];
  if (n >= 590 && n < 600) return ["暮らし"];
  if (n === 675 || n === 674) return ["マーケティング"];
  if (n >= 700 && n < 760) return ["アート"];
  if (n >= 760 && n < 770) return ["音楽"];
  if (n >= 780 && n < 790) return ["スポーツ"];
  if (n >= 800 && n < 900) return ["語学"];
  if (n >= 923 && n < 1000 && n % 10 === 3) return ["海外文学"];
  return [];
}

const FICTION_RULES: [string, RegExp][] = [
  ["ミステリー", /ミステリ|推理|探偵|殺人|密室|事件|犯人|トリック|名探偵/],
  ["サスペンス", /サスペンス|誘拐|復讐|逃亡|陰謀|スリル/],
  ["ホラー", /ホラー|怪談|怪異|幽霊|呪い|呪われ|恐怖|怨霊|祟り|ゾンビ/],
  ["SF", /\bSF\b|ＳＦ|宇宙|ロボット|タイムマシン|タイムトラベル|近未来|人工知能|アンドロイド|異星/],
  ["ファンタジー", /ファンタジー|魔法|魔女|異世界|ドラゴン|竜|王国|魔王|精霊|妖精/],
  ["恋愛", /恋愛|恋人|初恋|片思い|恋を|恋に|ラブストーリー|結婚/],
  ["青春", /青春|高校生|中学生|部活|同級生|夏休み|卒業|甲子園/],
  ["家族", /家族|母親|父親|母と|父と|娘|息子|兄弟|姉妹|祖母|祖父|親子/],
  ["動物", /猫|ネコ|犬|イヌ|動物|鳥|馬|うさぎ|クマ|熊/],
  ["歴史・時代", /時代小説|歴史小説|江戸|戦国|幕末|武士|侍|将軍|大名|藩/],
  ["お仕事", /お仕事|職場|会社員|新入社員|仕事に|書店員|図書館員|医師|看護師/],
  ["短編集", /短編集|短篇集|連作短編/],
  ["ユーモア", /ユーモア|爆笑|コメディ|抱腹絶倒|痛快/],
];

const NONFICTION_RULES: [string, RegExp][] = [
  ["AI", /\bAI\b|ＡＩ|人工知能|生成AI|ChatGPT|機械学習|ディープラーニング/i],
  ["IT", /プログラミング|エンジニア|ソフトウェア|IT|ＩＴ|DX|データ分析|Python|JavaScript|Web|ネットワーク|クラウド/],
  ["料理", /料理|レシピ|ごはん|おかず|弁当|献立|食卓|スイーツ|パン作り/],
  ["旅", /旅|紀行|観光|ガイドブック|散歩|街歩き/],
  ["健康", /健康|ダイエット|睡眠|運動|食事法|病気|医療|メンタル/],
  ["お金", /お金|投資|資産|節約|貯金|家計|株|NISA|年金|副業/],
  ["経済", /経済|景気|インフレ|金融|市場/],
  ["経営", /経営|マネジメント|起業|リーダーシップ|ビジネスモデル/],
  ["マーケティング", /マーケティング|ブランド|広告|販売|集客|営業/],
  ["仕事術", /仕事術|時間術|習慣|効率|生産性|段取り|仕事が|仕事の/],
  ["キャリア", /キャリア|転職|就職|働き方/],
  ["コミュニケーション", /コミュニケーション|会話|伝え方|話し方|人間関係|聞く力/],
  ["心理学", /心理|アドラー|メンタル|感情/],
  ["哲学", /哲学|思想|倫理|存在/],
  ["歴史", /歴史|日本史|世界史|戦争|古代|中世|近代/],
  ["科学", /科学|物理|化学|生物|宇宙|数学|進化|脳/],
  ["政治", /政治|選挙|国会|民主主義|外交|安全保障/],
  ["社会", /社会|格差|人口|少子化|ジェンダー|貧困|労働/],
  ["教育", /教育|学校|先生|学び/],
  ["子育て", /子育て|育児|子ども|赤ちゃん|親子/],
  ["語学", /英語|英会話|中国語|韓国語|語学|TOEIC|英単語/],
  ["アート", /アート|美術|絵画|デザイン|写真|建築/],
  ["音楽", /音楽|ピアノ|ギター|楽譜|ジャズ|クラシック/],
  ["スポーツ", /スポーツ|野球|サッカー|ランニング|筋トレ|ゴルフ/],
  ["暮らし", /暮らし|片づけ|収納|掃除|インテリア|家事|ミニマリスト/],
];

const SHINSHO = /新書/;
const NOT_SHINSHO = /ノベルス|ノベルズ/;

/** タイトル・内容紹介・NDC・叢書名からジャンルとタグ（最大4つ）を推定する */
export function classifyByRules(input: ClassifyInput): Classification {
  const text = [input.title, input.subtitle, input.description, ...(input.subjects ?? [])].filter(Boolean).join("\n");
  const label = [input.seriesTitle, input.publisher].filter(Boolean).join(" ");

  let genre: string | null = genreFromNdc(input.ndc);
  if (!genre) {
    if (/(長編|長篇|短編|短篇)?小説|ミステリ|文庫書き下ろし|物語/.test(text) || /ノベルス|ノベルズ/.test(label)) genre = "小説";
    else if (/エッセイ|随筆|日記/.test(text)) genre = "エッセイ";
    else if (/ビジネス|仕事術|経営|マーケティング|営業|リーダー/.test(text)) genre = "ビジネス書";
    else if (/プログラミング|エンジニア|ソフトウェア|\bAI\b|人工知能|データ/.test(text)) genre = "IT・テクノロジー";
    else if (/レシピ|料理/.test(text)) genre = "実用・暮らし";
    else if (/自己啓発|成功|習慣|幸せになる|人生を変える/.test(text)) genre = "自己啓発";
  }
  // 新書レーベル（ノベルスを除く）の小説以外は「新書」にまとめる
  if (SHINSHO.test(label) && !NOT_SHINSHO.test(label) && genre !== "小説") genre = "新書";

  const isFiction = genre !== null && FICTION_GENRES.has(genre);
  const tags: string[] = [];
  const add = (t: string) => {
    if (!tags.includes(t) && tags.length < 4) tags.push(t);
  };
  if (isFiction) {
    for (const [tag, re] of FICTION_RULES) if (re.test(text)) add(tag);
    for (const t of tagsFromNdc(input.ndc)) add(t);
    // 手がかりが少ない小説は「ヒューマンドラマ」とする
    if (!tags.some((t) => t !== "海外文学" && t !== "短編集")) add("ヒューマンドラマ");
  } else {
    for (const t of tagsFromNdc(input.ndc)) add(t);
    for (const [tag, re] of NONFICTION_RULES) if (re.test(text)) add(tag);
    if (genre === "新書" || genre === "人文・思想" || genre === "歴史" || genre === "科学") add("教養");
  }
  return { genre, tags };
}

export function isFictionGenre(genre: string | null | undefined) {
  return !!genre && FICTION_GENRES.has(genre);
}

/** 文章に出てくる話題（教養・ビジネス系のキーワードから。知識のカテゴリ提案に使う） */
export function topicsFromText(text: string): string[] {
  return NONFICTION_RULES.filter(([, re]) => re.test(text)).map(([tag]) => tag);
}
