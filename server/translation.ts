import { eq } from "drizzle-orm";
import { chatMessages, type ChatMessage } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";

/**
 * Real-time message translation (Tier-2 roadmap #6).
 *
 * Staff write in English; families read in their preferred language — and
 * vice-versa. Translations are produced lazily on first read and cached in
 * chat_messages.translations so each message is translated at most once per
 * language. Failures degrade gracefully to the original text.
 */

export const SUPPORTED_LANGUAGES = ["en", "es", "ht", "zh-Hans", "vi", "ar"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: "English",
  es: "Spanish",
  ht: "Haitian Creole",
  "zh-Hans": "Simplified Chinese",
  vi: "Vietnamese",
  ar: "Arabic",
};

export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

/** Translate raw text to the target language via the built-in LLM. */
async function translateText(text: string, target: SupportedLanguage): Promise<string | null> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            `You translate messages between Head Start (early childhood program) staff and families. ` +
            `Translate the user's message into ${LANGUAGE_NAMES[target]}. ` +
            `Keep the tone warm and simple. Preserve names, dates, times, and phone numbers exactly. ` +
            `If the message is already in ${LANGUAGE_NAMES[target]}, return it unchanged. ` +
            `Reply with ONLY the translated text — no quotes, no explanations.`,
        },
        { role: "user", content: text },
      ],
    });
    const raw = result.choices?.[0]?.message?.content;
    const joined =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw)
          ? raw.map((part) => ("text" in part ? part.text : "")).join("")
          : "";
    const out = joined.trim();
    return out.length > 0 ? out : null;
  } catch (error) {
    console.warn("[Translation] LLM call failed:", error);
    return null;
  }
}

/**
 * Return `message.body` in the target language, using (and filling) the
 * per-message cache. Returns the original body when translation is
 * unavailable so messaging never breaks.
 */
export async function translatedBody(
  message: ChatMessage,
  target: SupportedLanguage
): Promise<{ body: string; translated: boolean }> {
  const cached = message.translations?.[target];
  if (cached) return { body: cached, translated: cached !== message.body };

  const out = await translateText(message.body, target);
  if (!out) return { body: message.body, translated: false };

  // Cache — best effort; a lost write only means re-translating later.
  try {
    const db = await getDb();
    if (db) {
      const translations = { ...(message.translations ?? {}), [target]: out };
      await db.update(chatMessages).set({ translations }).where(eq(chatMessages.id, message.id));
    }
  } catch (error) {
    console.warn("[Translation] cache write failed:", error);
  }

  return { body: out, translated: out !== message.body };
}

/**
 * Translate a batch of messages for a viewer. Only messages authored by the
 * OTHER side are translated — your own words always render exactly as typed.
 *
 * The LLM is skipped when we can prove it's unnecessary:
 *  - the message carries a `__source` language stamp equal to the target
 *  - it has no stamp, was written by staff, and the target is English
 *    (staff compose in English; legacy messages predate stamping)
 * Small concurrency cap keeps thread loads snappy without hammering the LLM.
 */
export async function translateThreadForViewer(
  messages: ChatMessage[],
  viewerSide: "staff" | "family",
  viewerLanguage: SupportedLanguage
): Promise<Map<number, { body: string; translated: boolean }>> {
  const result = new Map<number, { body: string; translated: boolean }>();
  const otherSide = viewerSide === "staff" ? "family" : "staff";
  const targets = messages.filter((m) => {
    if (m.senderRole !== otherSide) return false;
    const source = m.translations?.["__source"];
    if (source === viewerLanguage) return false;
    if (!source && m.senderRole === "staff" && viewerLanguage === "en") return false;
    return true;
  });

  const CONCURRENCY = 4;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const chunk = targets.slice(i, i + CONCURRENCY);
    const translated = await Promise.all(chunk.map((m) => translatedBody(m, viewerLanguage)));
    chunk.forEach((m, idx) => result.set(m.id, translated[idx]));
  }
  return result;
}
