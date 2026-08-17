import "server-only";

import { env } from "@/lib/env";
import {
  formatTelegramSummary,
  getTelegramSummary,
  type SummaryWindow,
} from "./summary";

type TelegramConfig = {
  botToken: string;
  chatId: string;
};

function requireTelegramConfig(): TelegramConfig {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }
  if (!env.TELEGRAM_CHAT_ID) {
    throw new Error("TELEGRAM_CHAT_ID is not configured");
  }
  return {
    botToken: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID,
  };
}

export function isConfiguredChat(chatId: number | string): boolean {
  return String(chatId) === env.TELEGRAM_CHAT_ID;
}

export async function sendTelegramMessage(text: string): Promise<void> {
  const { botToken, chatId } = requireTelegramConfig();
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram sendMessage failed: ${response.status} ${body}`);
  }
}

export async function sendSummary(
  window: SummaryWindow = "24h",
): Promise<void> {
  const summary = await getTelegramSummary(window);
  await sendTelegramMessage(formatTelegramSummary(summary));
}

export function parseSummaryWindow(text: string): SummaryWindow | null {
  const normalized = text.trim().toLowerCase();
  if (
    normalized === "/stats" ||
    normalized === "/stats@vantage_bot" ||
    normalized === "/24h" ||
    normalized === "stats"
  ) {
    return "24h";
  }
  if (normalized === "/all" || normalized === "all") return "all";
  return null;
}

export function helpMessage(): string {
  return [
    "Vantage bot commands:",
    "",
    "/stats - last 24h report",
    "/24h - last 24h report",
    "/all - all-time report",
  ].join("\n");
}
