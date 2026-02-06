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

async function getBotToken(supabase: ReturnType<typeof createClient>): Promise<string> {
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
    `Чтобы привязать ваш аккаунт, отправьте команду:\n` +
    `<code>/set ваш-email@example.com</code>\n\n` +
    `Используйте тот email, под которым вы зарегистрированы в системе AgencyCore.`;

  await sendTelegramMessage(botToken, chatId, text);
}

async function handleSetEmail(
  supabase: ReturnType<typeof createClient>,
  botToken: string,
  chatId: number,
  username: string,
  firstName: string,
  email: string
) {
  const trimmedEmail = email.trim().toLowerCase();

  if (!trimmedEmail || !trimmedEmail.includes("@")) {
    await sendTelegramMessage(
      botToken,
      chatId,
      "Неверный формат email. Попробуйте:\n<code>/set ваш-email@example.com</code>"
    );
    return;
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, organization_id, email")
    .eq("email", trimmedEmail)
    .maybeSingle();

  if (userError || !user) {
    await sendTelegramMessage(
      botToken,
      chatId,
      `Пользователь с email <b>${trimmedEmail}</b> не найден в системе.\n\nУбедитесь, что вы используете тот же email, под которым зарегистрированы в AgencyCore.`
    );
    return;
  }

  const { data: existing } = await supabase
    .from("user_telegram_links")
    .select("id")
    .eq("user_id", user.id)
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (existing) {
    await sendTelegramMessage(
      botToken,
      chatId,
      `Ваш Telegram-аккаунт уже привязан к <b>${user.name}</b> (${trimmedEmail}).\n\nУведомления активны.`
    );
    return;
  }

  const { error: linkError } = await supabase
    .from("user_telegram_links")
    .upsert(
      {
        user_id: user.id,
        organization_id: user.organization_id,
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
      "Произошла ошибка при привязке аккаунта. Попробуйте позже."
    );
    return;
  }

  const { data: existingPrefs } = await supabase
    .from("user_notification_preferences")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingPrefs) {
    await supabase.from("user_notification_preferences").insert({
      user_id: user.id,
      organization_id: user.organization_id,
      telegram_enabled: true,
      notify_new_task: true,
      notify_task_status: true,
      notify_task_overdue: true,
      notify_new_client: true,
      notify_deadline: true,
    });
  }

  await sendTelegramMessage(
    botToken,
    chatId,
    `Ваш Telegram-аккаунт успешно привязан к учетной записи <b>${user.name}</b> (${trimmedEmail}).\n\n` +
      `Теперь вы будете получать уведомления из AgencyCore прямо в Telegram.\n\n` +
      `Настроить типы уведомлений можно в разделе <b>Настройки профиля</b> -> <b>Уведомления</b>.`
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
    "Ваш Telegram-аккаунт отвязан от AgencyCore. Уведомления больше не будут приходить.\n\nЧтобы привязать снова, используйте <code>/set email@example.com</code>"
  );
}

async function handleHelp(botToken: string, chatId: number) {
  const text =
    `<b>Команды бота AgencyCore:</b>\n\n` +
    `/start - Начало работы\n` +
    `/set email@example.com - Привязать аккаунт\n` +
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
      "Ваш Telegram не привязан ни к одному аккаунту AgencyCore.\n\nИспользуйте <code>/set email@example.com</code> для привязки."
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
      const result = await handleSendNotification(
        supabase,
        botToken,
        body
      );
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
      } else if (text.startsWith("/set ")) {
        const email = text.substring(5).trim();
        await handleSetEmail(
          supabase,
          botToken,
          chatId,
          username,
          firstName,
          email
        );
      } else if (text === "/unlink") {
        await handleUnlink(supabase, botToken, chatId);
      } else if (text === "/status") {
        await handleStatus(supabase, botToken, chatId);
      } else if (text === "/help") {
        await handleHelp(botToken, chatId);
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
