/**
 * 開発・お試し用のサンプルデータ。
 * すべて isSample=true で作成し、設定画面の「サンプルデータを削除」で一括削除できる。
 * 作品はいずれも著作権の保護期間が満了した古典を中心にしている。
 */
import type { Db } from "@/lib/db";
import { cleanupOrphans, upsertAuthors, upsertTags } from "./books";

const DAY = 86400000;
const ago = (days: number, hour = 21) => {
  const d = new Date(Date.now() - days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};

interface SampleBook {
  key: string;
  title: string;
  authors: string[];
  publisher: string;
  publishedAt: string;
  pageCount: number;
  genre: string;
  tags: string[];
  status: "WANT_TO_READ" | "OWNED" | "READING" | "COMPLETED" | "PAUSED" | "DROPPED";
  series?: [string, number];
  acquiredDaysAgo?: number;
  /** [開始(日前), 読了(日前), 評価, 感想, 学んだこと] */
  record?: [number, number | null, number | null, string?, string?];
  currentPage?: number;
  description?: string;
}

const BOOKS: SampleBook[] = [
  {
    key: "kokoro", title: "こころ", authors: ["夏目 漱石"], publisher: "サンプル文庫", publishedAt: "1914", pageCount: 384, genre: "小説", tags: ["日本文学", "人間", "近代"], status: "COMPLETED",
    record: [70, 58, 5, "「先生」の遺書の重さに圧倒された。人を信じることの難しさと、自分自身を信じることの難しさが重なって見える。", "明治から大正への移り変わりの中で、個人がどう生きるかという問い。エゴイズムと罪の意識の関係。"],
    description: "「先生」と呼ぶ人物と出会った私。先生の過去に秘められた罪と孤独を描く。",
  },
  { key: "neko", title: "吾輩は猫である", authors: ["夏目 漱石"], publisher: "サンプル文庫", publishedAt: "1905", pageCount: 610, genre: "小説", tags: ["日本文学", "ユーモア"], status: "OWNED", acquiredDaysAgo: 200 },
  { key: "yume", title: "夢十夜", authors: ["夏目 漱石"], publisher: "サンプル文庫", publishedAt: "1908", pageCount: 120, genre: "小説", tags: ["日本文学", "短編"], status: "WANT_TO_READ" },
  {
    key: "botchan", title: "坊っちゃん", authors: ["夏目 漱石"], publisher: "サンプル文庫", publishedAt: "1906", pageCount: 220, genre: "小説", tags: ["日本文学", "ユーモア"], status: "COMPLETED",
    record: [420, 410, 4, "痛快。まっすぐすぎる主人公が気持ちいい。", "正直さは時に不器用だが、それ自体に価値がある。"],
  },
  {
    key: "rashomon", title: "羅生門・鼻", authors: ["芥川 龍之介"], publisher: "サンプル文庫", publishedAt: "1915", pageCount: 200, genre: "日本文学", tags: ["日本文学", "短編", "人間"], status: "COMPLETED",
    record: [130, 124, 4, "短いのに読後感が長く残る。", "極限状況での倫理の揺らぎ。"],
  },
  {
    key: "ginga", title: "銀河鉄道の夜", authors: ["宮沢 賢治"], publisher: "サンプル文庫", publishedAt: "1934", pageCount: 280, genre: "日本文学", tags: ["日本文学", "幻想", "人生"], status: "READING",
    record: [12, null, null], currentPage: 168, description: "ジョバンニとカムパネルラの銀河を巡る旅。",
  },
  {
    key: "tsumi1", title: "罪と罰（上）", authors: ["ドストエフスキー"], publisher: "サンプル書房", publishedAt: "1866", pageCount: 500, genre: "海外文学", tags: ["海外文学", "ロシア文学", "人間"], status: "PAUSED",
    series: ["罪と罰", 1], record: [95, null, null], currentPage: 212,
  },
  { key: "tsumi2", title: "罪と罰（下）", authors: ["ドストエフスキー"], publisher: "サンプル書房", publishedAt: "1866", pageCount: 520, genre: "海外文学", tags: ["海外文学", "ロシア文学"], status: "OWNED", series: ["罪と罰", 2], acquiredDaysAgo: 95 },
  {
    key: "bushido", title: "武士道", authors: ["新渡戸 稲造"], publisher: "サンプル書房", publishedAt: "1900", pageCount: 240, genre: "歴史", tags: ["歴史", "日本文化", "倫理"], status: "COMPLETED",
    record: [200, 185, 4, "日本人の倫理観を外に向けて説明しようとした試みとして面白い。", "義・勇・仁・礼・誠・名誉・忠義という徳目の整理。"],
  },
  {
    key: "gakumon", title: "学問のすゝめ", authors: ["福沢 諭吉"], publisher: "サンプル書房", publishedAt: "1872", pageCount: 260, genre: "社会", tags: ["政治", "教育", "近代"], status: "COMPLETED",
    record: [40, 30, 5, "150年前の本なのに、今読んでも刺さる。", "学ぶことが個人の独立、ひいては国の独立につながるという考え方。"],
  },
  { key: "kokufu", title: "国富論", authors: ["アダム・スミス"], publisher: "サンプル書房", publishedAt: "1776", pageCount: 720, genre: "経済", tags: ["経済", "古典"], status: "OWNED", acquiredDaysAgo: 400 },
  {
    key: "jiseiroku", title: "自省録", authors: ["マルクス・アウレリウス"], publisher: "サンプル書房", publishedAt: "180", pageCount: 320, genre: "哲学", tags: ["哲学", "ストア派", "人生"], status: "COMPLETED",
    record: [20, 6, 5, "皇帝が自分のために書いたメモ。だからこそ飾り気がなく、まっすぐ届く。", "自分でコントロールできるものとできないものを区別する。"],
  },
  { key: "houhou", title: "方法序説", authors: ["デカルト"], publisher: "サンプル書房", publishedAt: "1637", pageCount: 160, genre: "哲学", tags: ["哲学", "近代"], status: "WANT_TO_READ" },
  {
    key: "shu", title: "種の起源", authors: ["チャールズ・ダーウィン"], publisher: "サンプル書房", publishedAt: "1859", pageCount: 640, genre: "科学", tags: ["科学", "生物学", "古典"], status: "READING",
    record: [30, null, null], currentPage: 96,
  },
  {
    key: "kunshu", title: "君主論", authors: ["マキャヴェリ"], publisher: "サンプル書房", publishedAt: "1532", pageCount: 230, genre: "政治", tags: ["政治", "古典", "権力"], status: "COMPLETED",
    record: [300, 290, 3, "冷徹だが、現実を直視する姿勢は学ぶところがある。", "理想ではなく、実際に人がどう振る舞うかから政治を考える。"],
  },
  {
    key: "shakai", title: "社会契約論", authors: ["ルソー"], publisher: "サンプル書房", publishedAt: "1762", pageCount: 280, genre: "政治", tags: ["政治", "哲学", "古典"], status: "DROPPED",
    record: [160, null, 2],
  },
  {
    key: "cha", title: "茶の本", authors: ["岡倉 天心"], publisher: "サンプル書房", publishedAt: "1906", pageCount: 150, genre: "芸術", tags: ["日本文化", "芸術", "茶"], status: "COMPLETED",
    record: [100, 96, 4, "茶を通して東洋の美意識を語る。短いが密度が高い。", "不完全なものを慈しむ美意識。"],
  },
];

const QUOTES: { book: string; text: string; page?: string; note?: string; tags: string[]; fav?: boolean; daysAgo: number }[] = [
  { book: "kokoro", text: "精神的に向上心のないものは馬鹿だ。", page: "245", note: "Kの言葉が、そのまま先生に返ってくる構図が怖い。", tags: ["人間", "成長"], fav: true, daysAgo: 60 },
  { book: "gakumon", text: "天は人の上に人を造らず人の下に人を造らずと云えり。", page: "1", note: "有名な一文だが「と云えり」までが大事。続きで学問の差を説いている。", tags: ["平等", "教育"], daysAgo: 32 },
  { book: "ginga", text: "ほんとうのさいわいは一体何だろう。", page: "142", note: "今の自分にも当てはまる問い。", tags: ["人生", "幸福"], fav: true, daysAgo: 5 },
  { book: "botchan", text: "親譲りの無鉄砲で小供の時から損ばかりしている。", page: "1", tags: ["書き出し"], daysAgo: 415 },
  { book: "rashomon", text: "下人の行方は、誰も知らない。", page: "18", note: "結末の余白。読者に委ねる終わり方。", tags: ["書き出し", "人間"], daysAgo: 125 },
  { book: "jiseiroku", text: "自分の力の及ぶものと及ばないものを区別せよ。", page: "序章", note: "（サンプル用の要約的な表現）", tags: ["人生", "ストア派"], fav: true, daysAgo: 10 },
];

const KNOWLEDGE: { key: string; title: string; content: string; category: string; tags: string[]; books: string[]; quotes?: number[] }[] = [
  { key: "jiyu", title: "自由と平等の思想", content: "人は生まれながらに平等であり、その差は学びによって生まれるという考え方。近代の社会契約論とも通じる。", category: "政治", tags: ["政治", "近代"], books: ["gakumon", "shakai"], quotes: [1] },
  { key: "kenryoku", title: "権力と統治のリアリズム", content: "理想ではなく、人間が実際にどう振る舞うかを前提に統治を考える立場。", category: "政治", tags: ["政治", "権力"], books: ["kunshu"] },
  { key: "stoa", title: "ストア派の哲学", content: "コントロールできるもの（自分の判断・行動）とできないもの（他人・出来事）を区別し、前者に集中する。", category: "哲学", tags: ["哲学", "ストア派"], books: ["jiseiroku"], quotes: [5] },
  { key: "jiga", title: "近代的自我とエゴイズム", content: "個人の自由が広がると同時に、孤独や罪の意識も個人が背負うことになる。", category: "文学", tags: ["日本文学", "近代"], books: ["kokoro"], quotes: [0] },
  { key: "shizen", title: "自然選択", content: "環境に適した変異をもつ個体が生き残り、その性質が次の世代に受け継がれることで種が変化していく。", category: "科学", tags: ["科学", "生物学"], books: ["shu"] },
  { key: "bi", title: "不完全の美", content: "完成されたものより、余白や不完全さに想像の余地を見出す美意識。", category: "芸術", tags: ["日本文化", "芸術"], books: ["cha", "bushido"] },
];

export async function hasSampleData(db: Db) {
  return (await db.book.count({ where: { isSample: true } })) > 0;
}

export async function loadSampleData(db: Db) {
  if (await hasSampleData(db)) return { created: false };
  const ids: Record<string, string> = {};

  for (const b of BOOKS) {
    const authorIds = await upsertAuthors(db, b.authors);
    await db.author.updateMany({ where: { id: { in: authorIds }, books: { none: {} } }, data: { isSample: true } });
    const tagIds = await upsertTags(db, b.tags);
    let seriesId: string | null = null;
    if (b.series) {
      const s = await db.series.upsert({ where: { title: b.series[0] }, create: { title: b.series[0], isSample: true, totalVolumes: 2 }, update: {} });
      seriesId = s.id;
    }
    const rec = b.record;
    const finishedAt = rec && rec[1] != null ? ago(rec[1]) : null;
    const book = await db.book.create({
      data: {
        title: b.title,
        publisher: b.publisher,
        publishedAt: b.publishedAt,
        publishedYear: Number(b.publishedAt.slice(0, 4)) || null,
        pageCount: b.pageCount,
        genre: b.genre,
        status: b.status,
        description: b.description,
        isSample: true,
        seriesId,
        seriesNumber: b.series?.[1],
        acquiredAt: b.acquiredDaysAgo != null ? ago(b.acquiredDaysAgo) : rec ? ago(rec[0] + 5) : null,
        currentPage: b.status === "COMPLETED" ? b.pageCount : (b.currentPage ?? 0),
        rating: rec?.[2] ?? null,
        startedAt: rec ? ago(rec[0]) : null,
        finishedAt,
        createdAt: ago((rec?.[0] ?? b.acquiredDaysAgo ?? 3) + 6),
        authors: { create: authorIds.map((authorId, position) => ({ authorId, position })) },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
    ids[b.key] = book.id;

    if (rec) {
      const status = b.status === "COMPLETED" ? "COMPLETED" : b.status === "PAUSED" ? "PAUSED" : b.status === "DROPPED" ? "DROPPED" : "READING";
      const record = await db.readingRecord.create({
        data: { bookId: book.id, status, startedAt: ago(rec[0]), finishedAt, rating: rec[2], review: rec[3], learned: rec[4] },
      });
      // 読書セッション（読書カレンダー用）：開始日から終了日（または今日）まで数日おきに記録
      const endDay = rec[1] ?? 0;
      const totalPages = b.status === "COMPLETED" ? b.pageCount : (b.currentPage ?? Math.round(b.pageCount * 0.3));
      const days: number[] = [];
      for (let d = rec[0]; d >= endDay; d -= 1 + ((d * 7) % 3)) days.push(d);
      const per = Math.max(1, Math.floor(totalPages / Math.max(1, days.length)));
      let page = 0;
      for (const [i, d] of days.entries()) {
        const next = i === days.length - 1 ? totalPages : Math.min(totalPages, page + per);
        await db.readingSession.create({
          data: {
            bookId: book.id,
            recordId: record.id,
            date: ago(d, 20 + (d % 3)),
            startPage: page,
            endPage: next,
            pagesRead: next - page,
            minutes: 20 + ((d * 13) % 50),
            note: i === 1 && b.key === "ginga" ? "カムパネルラの沈黙が気になる。後半で回収されるのか。" : null,
          },
        });
        page = next;
      }
    }
  }

  const quoteIds: string[] = [];
  for (const q of QUOTES) {
    const tagIds = await upsertTags(db, q.tags);
    const quote = await db.quote.create({
      data: {
        text: q.text,
        bookId: ids[q.book],
        pageNumber: q.page,
        note: q.note,
        isFavorite: q.fav ?? false,
        isSample: true,
        createdAt: ago(q.daysAgo),
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
    quoteIds.push(quote.id);
  }

  const kIds: Record<string, string> = {};
  for (const k of KNOWLEDGE) {
    const tagIds = await upsertTags(db, k.tags);
    const note = await db.knowledgeNote.create({
      data: {
        title: k.title,
        content: k.content,
        category: k.category,
        isSample: true,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
        books: { create: k.books.map((key) => ({ bookId: ids[key] })) },
        quotes: { create: (k.quotes ?? []).map((i) => ({ quoteId: quoteIds[i] })) },
      },
    });
    kIds[k.key] = note.id;
  }
  const links: [string, string, string][] = [
    ["jiyu", "kenryoku", "統治のあり方"],
    ["stoa", "jiga", "自己との向き合い方"],
    ["jiga", "jiyu", "近代"],
    ["bi", "stoa", "簡素さ"],
  ];
  for (const [a, b, label] of links) {
    await db.knowledgeLink.create({ data: { fromId: kIds[a], toId: kIds[b], label } });
  }

  const best = await db.customShelf.upsert({ where: { name: "人生ベスト" }, create: { name: "人生ベスト", isSample: true, position: 1 }, update: {} });
  const reread = await db.customShelf.upsert({ where: { name: "再読したい" }, create: { name: "再読したい", isSample: true, position: 2 }, update: {} });
  for (const k of ["kokoro", "jiseiroku", "gakumon"]) await db.shelfBook.create({ data: { shelfId: best.id, bookId: ids[k] } });
  for (const k of ["kokoro", "bushido"]) await db.shelfBook.create({ data: { shelfId: reread.id, bookId: ids[k] } });

  await db.readingPath.create({
    data: {
      title: "近代思想入門",
      description: "近代の政治・経済・科学の考え方を古典でたどる",
      isSample: true,
      books: { create: ["houhou", "kunshu", "shakai", "kokufu", "shu"].map((k, i) => ({ bookId: ids[k], position: i })) },
    },
  });

  await db.bookRelation.create({ data: { fromId: ids.gakumon, toId: ids.shakai, note: "平等の思想" } });

  const year = new Date().getFullYear();
  const hasGoal = await db.readingGoal.findFirst({ where: { year, type: "YEARLY_BOOKS" } });
  if (!hasGoal) await db.readingGoal.create({ data: { type: "YEARLY_BOOKS", year, target: 24 } });

  return { created: true };
}

export async function deleteSampleData(db: Db) {
  await db.$transaction(async (tx) => {
    await tx.quote.deleteMany({ where: { isSample: true } });
    await tx.knowledgeNote.deleteMany({ where: { isSample: true } });
    await tx.readingPath.deleteMany({ where: { isSample: true } });
    await tx.creativeNote.deleteMany({ where: { isSample: true } });
    await tx.novelProject.deleteMany({ where: { isSample: true } });
    await tx.customShelf.deleteMany({ where: { isSample: true } });
    await tx.book.deleteMany({ where: { isSample: true } });
    await tx.author.deleteMany({ where: { isSample: true, books: { none: {} } } });
    await tx.series.deleteMany({ where: { isSample: true, books: { none: {} } } });
    await cleanupOrphans(tx);
  });
}
