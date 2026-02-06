import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getBotToken(
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const { data, error } = await supabase
    .from("telegram_bot_config")
    .select("bot_token")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Bot token not configured");
  }
  return data.bot_token;
}

async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  parseMode: string = "HTML"
) {
  const resp = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
    }
  );
  return resp.json();
}

async function handleStart(
  botToken: string,
  chatId: number,
  firstName: string
) {
  const text =
    `Добро пожаловать, <b>${firstName}</b>!\n\n` +
    `Я бот <b>AgencyCore</b> для уведомлений.\n\n` +
    `Чтобы привязать аккаунт:\n` +
    `1. Откройте <b>Настройки профиля → Уведомления</b> в AgencyCore\n` +
    `2. Нажмите <b>«Получить код привязки»</b>\n` +
    `3. Отправьте мне полученный код командой:\n` +
    `<code>/link XXXXXX</code>\n\n` +
    `Это гарантирует, что только вы сможете привязать свой аккаунт.`;

  await sendTelegramMessage(botToken, chatId, text);
}

async function handleLinkCode(
  supabase: ReturnType<typeof createClient>,
  botToken: string,
  chatId: number,
  username: string,
  firstName: string,
  code: string
) {
  const trimmedCode = code.trim().toUpperCase();

  if (!trimmedCode || trimmedCode.length < 4) {
    await sendTelegramMessage(
      botToken,
      chatId,
      "Неверный формат кода. Получите код в <b>Настройки профиля → Уведомления</b> и отправьте:\n<code>/link XXXXXX</code>"
    );
    return;
  }

  await supabase
    .from("telegram_link_codes")
    .delete()
    .lt("expires_at", new Date().toISOString());

  const { data: linkCode, error: codeError } = await supabase
    .from("telegram_link_codes")
    .select("id, user_id, organization_id, expires_at")
    .eq("code", trimmedCode)
    .maybeSingle();

  if (codeError || !linkCode) {
    await sendTelegramMessage(
      botToken,
      chatId,
      "Код не найден или истёк. Получите новый код в <b>Настройки профиля → Уведомления</b>."
    );
    return;
  }

  if (new Date(linkCode.expires_at) < new Date()) {
    await supabase
      .from("telegram_link_codes")
      .delete()
      .eq("id", linkCode.id);
    await sendTelegramMessage(
      botToken,
      chatId,
      "Код истёк. Получите новый код в <b>Настройки профиля → Уведомления</b>."
    );
    return;
  }

  const { data: existing } = await supabase
    .from("user_telegram_links")
    .select("id")
    .eq("user_id", linkCode.user_id)
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("telegram_link_codes")
      .delete()
      .eq("id", linkCode.id);

    const { data: user } = await supabase
      .from("users")
      .select("name")
      .eq("id", linkCode.user_id)
      .maybeSingle();

    await sendTelegramMessage(
      botToken,
      chatId,
      `Ваш Telegram уже привязан к аккаунту <b>${user?.name || "—"}</b>. Уведомления активны.`
    );
    return;
  }

  const { error: linkError } = await supabase
    .from("user_telegram_links")
    .upsert(
      {
        user_id: linkCode.user_id,
        organization_id: linkCode.organization_id,
        telegram_chat_id: chatId,
        telegram_username: username || "",
        telegram_first_name: firstName || "",
        is_active: true,
      },
      { onConflict: "user_id,telegram_chat_id" }
    );

  if (linkError) {
    await sendTelegramMessage(
      botToken,
      chatId,
      "Произошла ошибка при привязке. Попробуйте позже."
    );
    return;
  }

  await supabase
    .from("telegram_link_codes")
    .delete()
    .eq("id", linkCode.id);

  const { data: existingPrefs } = await supabase
    .from("user_notification_preferences")
    .select("id")
    .eq("user_id", linkCode.user_id)
    .maybeSingle();

  if (!existingPrefs) {
    await supabase.from("user_notification_preferences").insert({
      user_id: linkCode.user_id,
      organization_id: linkCode.organization_id,
      telegram_enabled: true,
      notify_new_task: true,
      notify_task_status: true,
      notify_task_overdue: true,
      notify_new_client: true,
      notify_deadline: true,
    });
  }

  const { data: user } = await supabase
    .from("users")
    .select("name, email")
    .eq("id", linkCode.user_id)
    .maybeSingle();

  await sendTelegramMessage(
    botToken,
    chatId,
    `Telegram успешно привязан к аккаунту <b>${user?.name || "—"}</b> (${user?.email || ""}).\n\n` +
      `Теперь вы будете получать уведомления из AgencyCore.\n\n` +
      `Настроить типы уведомлений: <b>Настройки профиля → Уведомления</b>.`
  );
}

async function handleUnlink(
  supabase: ReturnType<typeof createClient>,
  botToken: string,
  chatId: number
) {
  const { error } = await supabase
    .from("user_telegram_links")
    .delete()
    .eq("telegram_chat_id", chatId);

  if (error) {
    await sendTelegramMessage(
      botToken,
      chatId,
      "Произошла ошибка при отвязке. Попробуйте позже."
    );
    return;
  }

  await sendTelegramMessage(
    botToken,
    chatId,
    "Ваш Telegram отвязан от AgencyCore. Уведомления больше не будут приходить.\n\nЧтобы привязать снова, получите новый код в CRM."
  );
}

async function handleHelp(botToken: string, chatId: number) {
  const text =
    `<b>Команды бота AgencyCore:</b>\n\n` +
    `/start - Начало работы\n` +
    `/link XXXXXX - Привязать аккаунт по коду из CRM\n` +
    `/status - Проверить статус привязки\n` +
    `/unlink - Отвязать аккаунт\n` +
    `/help - Список команд`;

  await sendTelegramMessage(botToken, chatId, text);
}

async function handleStatus(
  supabase: ReturnType<typeof createClient>,
  botToken: string,
  chatId: number
) {
  const { data: links } = await supabase
    .from("user_telegram_links")
    .select("user_id, is_active, linked_at, users(name, email)")
    .eq("telegram_chat_id", chatId);

  if (!links || links.length === 0) {
    await sendTelegramMessage(
      botToken,
      chatId,
      "Ваш Telegram не привязан ни к одному аккаунту AgencyCore.\n\nПолучите код привязки в <b>Настройки профиля → Уведомления</b>."
    );
    return;
  }

  let text = "<b>Привязанные аккаунты:</b>\n\n";
  for (const link of links) {
    const user = (link as any).users;
    const status = link.is_active ? "Активно" : "Отключено";
    text += `- <b>${user?.name || "—"}</b> (${user?.email || "—"}) — ${status}\n`;
  }

  await sendTelegramMessage(botToken, chatId, text);
}

async function handleSendNotification(
  supabase: ReturnType<typeof createClient>,
  botToken: string,
  body: { user_id: string; title: string; message: string; type?: string }
) {
  const { data: links } = await supabase
    .from("user_telegram_links")
    .select("telegram_chat_id")
    .eq("user_id", body.user_id)
    .eq("is_active", true);

  if (!links || links.length === 0) {
    return { sent: false, reason: "no_linked_accounts" };
  }

  const { data: prefs } = await supabase
    .from("user_notification_preferences")
    .select("*")
    .eq("user_id", body.user_id)
    .maybeSingle();

  if (prefs && !prefs.telegram_enabled) {
    return { sent: false, reason: "telegram_disabled" };
  }

  if (prefs && body.type) {
    const typeMap: Record<string, string> = {
      task_assigned: "notify_new_task",
      task_reassigned: "notify_new_task",
      task_status_changed: "notify_task_status",
      task_overdue: "notify_task_overdue",
      deadline_approaching: "notify_deadline",
      new_client: "notify_new_client",
    };
    const prefKey = typeMap[body.type];
    if (prefKey && prefs[prefKey] === false) {
      return { sent: false, reason: "notification_type_disabled" };
    }
  }

  const text = `<b>${body.title}</b>\n\n${body.message}`;

  let sentCount = 0;
  for (const link of links) {
    try {
      await sendTelegramMessage(botToken, link.telegram_chat_id, text);
      sentCount++;
    } catch (e) {
      console.error(`Failed to send to chat ${link.telegram_chat_id}:`, e);
    }
  }

  return { sent: true, sent_count: sentCount };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const botToken = await getBotToken(supabase);

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (path === "send-notification" && req.method === "POST") {
      const body = await req.json();
      const result = await handleSendNotification(supabase, botToken, body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "setup-webhook" && req.method === "POST") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const webhookUrl = `${supabaseUrl}/functions/v1/telegram-bot`;
      const resp = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: webhookUrl }),
        }
      );
      const result = await resp.json();
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const update = await req.json();

      if (!update.message) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const msg = update.message;
      const chatId = msg.chat.id;
      const text = (msg.text || "").trim();
      const username = msg.from?.username || "";
      const firstName = msg.from?.first_name || "";

      if (text === "/start") {
        await handleStart(botToken, chatId, firstName);
      } else if (text.startsWith("/link ")) {
        const code = text.substring(6).trim();
        await handleLinkCode(
          supabase,
          botToken,
          chatId,
          username,
          firstName,
          code
        );
      } else if (text === "/unlink") {
        await handleUnlink(supabase, botToken, chatId);
      } else if (text === "/status") {
        await handleStatus(supabase, botToken, chatId);
      } else if (text === "/help") {
        await handleHelp(botToken, chatId);
      } else if (text.startsWith("/set ")) {
        await sendTelegramMessage(
          botToken,
          chatId,
          "Привязка по email отключена в целях безопасности.\n\nИспользуйте код из CRM:\n1. Откройте <b>Настройки профиля → Уведомления</b>\n2. Нажмите <b>«Получить код привязки»</b>\n3. Отправьте: <code>/link XXXXXX</code>"
        );
      } else {
        await sendTelegramMessage(
          botToken,
          chatId,
          "Неизвестная команда. Используйте /help для списка команд."
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Telegram bot error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
