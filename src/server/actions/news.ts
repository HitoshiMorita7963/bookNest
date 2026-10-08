"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toUserError, type ActionResult } from "@/lib/errors";
import * as news from "@/server/services/news";

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    return toUserError(e);
  }
}

export async function saveNewsAction(id: string, input: { knowledgeIds?: string[]; memo?: string }) {
  return run(() => news.saveNews(prisma, id, input));
}

export async function unsaveNewsAction(id: string) {
  return run(() => news.unsaveNews(prisma, id));
}

export async function unlinkNewsKnowledgeAction(newsId: string, knowledgeId: string) {
  return run(() => news.unlinkNewsKnowledge(prisma, newsId, knowledgeId));
}

export async function createKnowledgeFromNewsAction(id: string, input: { title: string; content?: string; category?: string | null }) {
  return run(async () => ({ id: (await news.createKnowledgeFromNews(prisma, id, input)).id }));
}

/** 更新ボタン：すぐに最新のニュースを集め直す（前回から5分以内なら何もしない） */
export async function refreshNewsAction() {
  return run(async (): Promise<news.RefreshResult> => {
    if (process.env.NEWS_DISABLED === "1") return { refreshed: false, reason: "failed" };
    return news.refreshNews(prisma, { force: true });
  });
}

/** 知識を「ニュースで追う」に入れる・外す */
export async function setNewsInterestAction(knowledgeId: string, on: boolean) {
  return run(() => news.setNewsInterest(prisma, knowledgeId, on));
}
