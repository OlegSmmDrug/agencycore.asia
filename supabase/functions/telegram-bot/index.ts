import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

type SupaClient = ReturnType<typeof createClient>;

function getSupabaseClient(): SupaClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function getBotToken(supabase: SupaClient): Promise<string> {
  const { data, error } = await supabase
    .from("telegram_bot_config")
    .select("bot_token")
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("Bot token not configured");
  return data.bot_token;
}

async function sendTg(
  botToken: string,
  chatId: number | string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<{ ok: boolean; description?: string }> {
  const resp = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...extra,
      }),
    },
  );
  const result = await resp.json();
  if (!result.ok) {
    console.error(`Telegram API error for chat ${chatId}:`, result.description);
  }
  return result;
}

function keyboard(rows: string[][]) {
  return {
    reply_markup: {
      keyboard: rows.map((row) => row.map((t) => ({ text: t }))),
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

type UserRole =
  | "director"
  | "pm"
  | "smm"
  | "targetologist"
  | "videographer"
  | "mobilograph"
  | "photographer"
  | "sales"
  | "accountant"
  | "member";

function detectRole(jobTitle: string | null | undefined): UserRole {
  if (!jobTitle) return "member";
  const t = jobTitle.toLowerCase();
  if (/ceo|директор|владел|собственн/i.test(t)) return "director";
  if (/pm|project.?manager|проджект|проект.?менедж/i.test(t)) return "pm";
  if (/smm|смм|контент/i.test(t)) return "smm";
  if (/target|таргет/i.test(t)) return "targetologist";
  if (/video|видеограф/i.test(t)) return "videographer";
  if (/mobilo|мобилограф/i.test(t)) return "mobilograph";
  if (/photo|фотограф/i.test(t)) return "photographer";
  if (/sale|продаж|менеджер/i.test(t)) return "sales";
  if (/бухгалт|accountant/i.test(t)) return "accountant";
  return "member";
}

interface LinkedUser {
  userId: string;
  organizationId: string;
  name: string;
  jobTitle: string | null;
  role: UserRole;
}

async function getLinkedUser(
  supabase: SupaClient,
  chatId: number,
): Promise<LinkedUser | null> {
  const { data: link } = await supabase
    .from("user_telegram_links")
    .select("user_id, organization_id")
    .eq("telegram_chat_id", chatId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!link) return null;

  const { data: user } = await supabase
    .from("users")
    .select("name, job_title")
    .eq("id", link.user_id)
    .maybeSingle();

  return {
    userId: link.user_id,
    organizationId: link.organization_id,
    name: user?.name || "—",
    jobTitle: user?.job_title || null,
    role: detectRole(user?.job_title),
  };
}

const ROLE_MENUS: Record<UserRole, string[][]> = {
  director: [
    ["Мои задачи", "Дедлайны"],
    ["Отчёт по команде", "Финансовая сводка"],
    ["Новые клиенты", "Статус проектов"],
  ],
  pm: [
    ["Мои задачи", "Дедлайны"],
    ["Статус проектов", "Загрузка команды"],
  ],
  smm: [
    ["Мои задачи", "Дедлайны"],
    ["Контент-план", "Публикации сегодня"],
  ],
  targetologist: [
    ["Мои задачи", "Дедлайны"],
    ["Рекламные кампании"],
  ],
  videographer: [
    ["Мои задачи", "Дедлайны"],
    ["Съёмки на неделю"],
  ],
  mobilograph: [
    ["Мои задачи", "Дедлайны"],
    ["Съёмки на неделю"],
  ],
  photographer: [
    ["Мои задачи", "Дедлайны"],
    ["Съёмки на неделю"],
  ],
  sales: [
    ["Мои задачи", "Дедлайны"],
    ["Новые клиенты", "Воронка продаж"],
  ],
  accountant: [
    ["Мои задачи", "Дедлайны"],
    ["Финансовая сводка"],
  ],
  member: [
    ["Мои задачи", "Дедлайны"],
  ],
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusEmoji(s: string): string {
  const map: Record<string, string> = {
    "To Do": "⬜",
    "In Progress": "🔵",
    "Done": "✅",
    "completed": "✅",
    "Rejected": "🔴",
  };
  return map[s] || "⬜";
}

const ACTIVE_TASK_STATUSES = ["To Do", "In Progress"];
const ACTIVE_PROJECT_STATUSES = ["New", "In Work", "Strategy/KP"];
const WON_CLIENT_STATUSES = ["Won", "In Work", "Contract Signing"];

async function handleMyTasks(
  supabase: SupaClient,
  botToken: string,
  chatId: number,
  user: LinkedUser,
) {
  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, status, deadline, project_id, projects(name)")
    .eq("assignee_id", user.userId)
    .eq("organization_id", user.organizationId)
    .in("status", ACTIVE_TASK_STATUSES)
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(15);

  if (!tasks || tasks.length === 0) {
    await sendTg(botToken, chatId, "У вас нет активных задач.");
    return;
  }

  let text = `<b>Ваши задачи (${tasks.length}):</b>\n\n`;
  for (const t of tasks) {
    const proj = (t as any).projects?.name || "";
    const due = t.deadline ? ` | до ${fmtDate(t.deadline)}` : "";
    text += `${statusEmoji(t.status)} <b>${t.title}</b>\n`;
    text += `   ${proj}${due}\n\n`;
  }

  await sendTg(botToken, chatId, text);
}

async function handleDeadlines(
  supabase: SupaClient,
  botToken: string,
  chatId: number,
  user: LinkedUser,
) {
  const now = new Date();
  const weekLater = new Date(now);
  weekLater.setDate(weekLater.getDate() + 7);

  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, status, deadline, projects(name)")
    .eq("assignee_id", user.userId)
    .eq("organization_id", user.organizationId)
    .in("status", ACTIVE_TASK_STATUSES)
    .not("deadline", "is", null)
    .lte("deadline", weekLater.toISOString())
    .order("deadline", { ascending: true })
    .limit(15);

  if (!tasks || tasks.length === 0) {
    await sendTg(botToken, chatId, "Нет дедлайнов на ближайшие 7 дней.");
    return;
  }

  let text = `<b>Дедлайны (7 дней):</b>\n\n`;
  for (const t of tasks) {
    const proj = (t as any).projects?.name || "";
    const dueDate = new Date(t.deadline);
    const isOverdue = dueDate < now;
    const prefix = isOverdue ? "🔴 ПРОСРОЧЕНО" : "🟡";
    text += `${prefix} <b>${t.title}</b>\n`;
    text += `   ${proj} | ${fmtDate(t.deadline)}\n\n`;
  }

  await sendTg(botToken, chatId, text);
}

async function handleTeamReport(
  supabase: SupaClient,
  botToken: string,
  chatId: number,
  user: LinkedUser,
) {
  const { data: members } = await supabase
    .from("users")
    .select("id, name, job_title")
    .eq("organization_id", user.organizationId);

  if (!members || members.length === 0) {
    await sendTg(botToken, chatId, "Нет данных о команде.");
    return;
  }

  let text = `<b>Отчёт по команде (${members.length} чел.):</b>\n\n`;

  for (const m of members) {
    const { count: activeTasks } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", m.id)
      .eq("organization_id", user.organizationId)
      .in("status", ACTIVE_TASK_STATUSES);

    const { count: overdue } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", m.id)
      .eq("organization_id", user.organizationId)
      .in("status", ACTIVE_TASK_STATUSES)
      .lt("deadline", new Date().toISOString());

    const overdueLabel = (overdue || 0) > 0 ? ` | 🔴 просрочено: ${overdue}` : "";
    text += `<b>${m.name}</b> (${m.job_title || "—"})\n`;
    text += `   Задач: ${activeTasks || 0}${overdueLabel}\n\n`;
  }

  await sendTg(botToken, chatId, text);
}

async function handleFinanceSummary(
  supabase: SupaClient,
  botToken: string,
  chatId: number,
  user: LinkedUser,
) {
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStr = monthStart.toISOString().slice(0, 10);

  const { data: txAll } = await supabase
    .from("transactions")
    .select("amount, type")
    .eq("organization_id", user.organizationId)
    .gte("date", monthStr);

  let income = 0;
  let expense = 0;
  for (const t of txAll || []) {
    if (t.type === "Refund") {
      expense += Math.abs(t.amount || 0);
    } else {
      income += (t.amount || 0);
    }
  }
  const profit = income - expense;

  const { count: activeProjects } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", user.organizationId)
    .in("status", ACTIVE_PROJECT_STATUSES);

  const { count: activeClients } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", user.organizationId)
    .in("status", WON_CLIENT_STATUSES);

  const month = new Date().toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });

  let text = `<b>Финансовая сводка за ${month}:</b>\n\n`;
  text += `Доходы: <b>${Math.round(income).toLocaleString()} ₸</b>\n`;
  text += `Расходы: <b>${Math.round(expense).toLocaleString()} ₸</b>\n`;
  text += `Прибыль: <b>${Math.round(profit).toLocaleString()} ₸</b>\n\n`;
  text += `Активных проектов: <b>${activeProjects || 0}</b>\n`;
  text += `Активных клиентов: <b>${activeClients || 0}</b>`;

  await sendTg(botToken, chatId, text);
}

async function handleNewClients(
  supabase: SupaClient,
  botToken: string,
  chatId: number,
  user: LinkedUser,
) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: clients } = await supabase
    .from("clients")
    .select("name, company, status, created_at, lead_source")
    .eq("organization_id", user.organizationId)
    .gte("created_at", weekAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(10);

  if (!clients || clients.length === 0) {
    await sendTg(botToken, chatId, "За последнюю неделю новых клиентов нет.");
    return;
  }

  let text = `<b>Новые клиенты за 7 дней (${clients.length}):</b>\n\n`;
  for (const c of clients) {
    const source = c.lead_source ? ` | ${c.lead_source}` : "";
    text += `<b>${c.name}</b>${c.company ? ` (${c.company})` : ""}\n`;
    text += `   ${c.status || "new"}${source} | ${fmtDate(c.created_at)}\n\n`;
  }

  await sendTg(botToken, chatId, text);
}

async function handleProjectStatus(
  supabase: SupaClient,
  botToken: string,
  chatId: number,
  user: LinkedUser,
) {
  const { data: projects } = await supabase
    .from("projects")
    .select("name, status, end_date, client_id, clients(name)")
    .eq("organization_id", user.organizationId)
    .in("status", ACTIVE_PROJECT_STATUSES)
    .order("end_date", { ascending: true, nullsFirst: false })
    .limit(10);

  if (!projects || projects.length === 0) {
    await sendTg(botToken, chatId, "Нет активных проектов.");
    return;
  }

  let text = `<b>Активные проекты (${projects.length}):</b>\n\n`;
  for (const p of projects) {
    const endDate = p.end_date ? ` | до ${fmtDate(p.end_date)}` : "";
    const isOverdue = p.end_date && new Date(p.end_date) < new Date();
    const prefix = isOverdue ? "🔴" : "🟢";
    const clientName = (p as any).clients?.name || "—";
    text += `${prefix} <b>${p.name}</b>\n`;
    text += `   ${clientName}${endDate}\n\n`;
  }

  await sendTg(botToken, chatId, text);
}

async function handleTeamWorkload(
  supabase: SupaClient,
  botToken: string,
  chatId: number,
  user: LinkedUser,
) {
  const { data: members } = await supabase
    .from("users")
    .select("id, name, job_title")
    .eq("organization_id", user.organizationId);

  if (!members || members.length === 0) {
    await sendTg(botToken, chatId, "Нет данных о команде.");
    return;
  }

  let text = `<b>Загрузка команды:</b>\n\n`;
  for (const m of members) {
    const { count } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", m.id)
      .eq("organization_id", user.organizationId)
      .in("status", ACTIVE_TASK_STATUSES);

    const bar = "▓".repeat(Math.min(count || 0, 10)) +
      "░".repeat(Math.max(10 - (count || 0), 0));
    text += `${bar} <b>${m.name}</b> — ${count || 0} задач\n`;
  }

  await sendTg(botToken, chatId, text);
}

async function handleShootingSchedule(
  supabase: SupaClient,
  botToken: string,
  chatId: number,
  user: LinkedUser,
) {
  const now = new Date();
  const weekLater = new Date(now);
  weekLater.setDate(weekLater.getDate() + 7);

  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, status, deadline, start_time, end_time, projects(name)")
    .eq("assignee_id", user.userId)
    .eq("organization_id", user.organizationId)
    .in("status", ACTIVE_TASK_STATUSES)
    .not("deadline", "is", null)
    .gte("deadline", now.toISOString().split("T")[0])
    .lte("deadline", weekLater.toISOString().split("T")[0])
    .order("deadline", { ascending: true })
    .limit(15);

  if (!tasks || tasks.length === 0) {
    await sendTg(botToken, chatId, "Нет съёмок на ближайшую неделю.");
    return;
  }

  let text = `<b>Съёмки на неделю:</b>\n\n`;
  let lastDate = "";
  for (const t of tasks) {
    const dateStr = fmtDate(t.deadline);
    if (dateStr !== lastDate) {
      text += `\n📅 <b>${dateStr}</b>\n`;
      lastDate = dateStr;
    }
    const proj = (t as any).projects?.name || "";
    const time = t.start_time
      ? ` ${t.start_time}${t.end_time ? "-" + t.end_time : ""}`
      : "";
    text += `   ${statusEmoji(t.status)} ${t.title}${time}\n`;
    if (proj) text += `      ${proj}\n`;
  }

  await sendTg(botToken, chatId, text);
}

async function handleContentPlan(
  supabase: SupaClient,
  botToken: string,
  chatId: number,
  user: LinkedUser,
) {
  const now = new Date();
  const weekLater = new Date(now);
  weekLater.setDate(weekLater.getDate() + 7);

  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, status, deadline, type, projects(name)")
    .eq("assignee_id", user.userId)
    .eq("organization_id", user.organizationId)
    .in("status", ACTIVE_TASK_STATUSES)
    .not("deadline", "is", null)
    .gte("deadline", now.toISOString().split("T")[0])
    .lte("deadline", weekLater.toISOString().split("T")[0])
    .order("deadline", { ascending: true })
    .limit(20);

  if (!tasks || tasks.length === 0) {
    await sendTg(botToken, chatId, "Нет контента на ближайшую неделю.");
    return;
  }

  let text = `<b>Контент-план (7 дней):</b>\n\n`;
  let lastDate = "";
  for (const t of tasks) {
    const dateStr = fmtDate(t.deadline);
    if (dateStr !== lastDate) {
      text += `\n📅 <b>${dateStr}</b>\n`;
      lastDate = dateStr;
    }
    const proj = (t as any).projects?.name || "";
    const tp = t.type ? ` [${t.type}]` : "";
    text += `   ${statusEmoji(t.status)} ${t.title}${tp}\n`;
    if (proj) text += `      ${proj}\n`;
  }

  await sendTg(botToken, chatId, text);
}

async function handleTodayPublications(
  supabase: SupaClient,
  botToken: string,
  chatId: number,
  user: LinkedUser,
) {
  const today = new Date().toISOString().split("T")[0];

  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, status, type, projects(name)")
    .eq("assignee_id", user.userId)
    .eq("organization_id", user.organizationId)
    .eq("deadline", today)
    .order("created_at", { ascending: true })
    .limit(20);

  if (!tasks || tasks.length === 0) {
    await sendTg(botToken, chatId, "На сегодня публикаций нет.");
    return;
  }

  let text = `<b>Задачи на сегодня (${tasks.length}):</b>\n\n`;
  for (const t of tasks) {
    const proj = (t as any).projects?.name || "";
    const tp = t.type ? ` [${t.type}]` : "";
    text += `${statusEmoji(t.status)} <b>${t.title}</b>${tp}\n`;
    if (proj) text += `   ${proj}\n`;
    text += "\n";
  }

  await sendTg(botToken, chatId, text);
}

async function handleSalesFunnel(
  supabase: SupaClient,
  botToken: string,
  chatId: number,
  user: LinkedUser,
) {
  const { data: stages } = await supabase
    .from("crm_pipeline_stages")
    .select("id, name, sort_order")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (!stages || stages.length === 0) {
    await sendTg(botToken, chatId, "Воронка продаж не настроена.");
    return;
  }

  let text = `<b>Воронка продаж:</b>\n\n`;
  for (const stage of stages) {
    const { count } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", user.organizationId)
      .eq("pipeline_stage_id", stage.id);

    const bar = "▓".repeat(Math.min(count || 0, 8)) +
      "░".repeat(Math.max(8 - (count || 0), 0));
    text += `${bar} <b>${stage.name}</b> — ${count || 0}\n`;
  }

  await sendTg(botToken, chatId, text);
}

async function handleAdCampaigns(
  supabase: SupaClient,
  botToken: string,
  chatId: number,
  user: LinkedUser,
) {
  const { data: projects } = await supabase
    .from("projects")
    .select("name, facebook_access_token, ad_account_id")
    .eq("organization_id", user.organizationId)
    .in("status", ["active", "in_progress"])
    .not("facebook_access_token", "is", null)
    .limit(5);

  if (!projects || projects.length === 0) {
    await sendTg(
      botToken,
      chatId,
      "Нет проектов с подключённой рекламой.\nНастройте интеграцию в CRM.",
    );
    return;
  }

  let text = `<b>Проекты с рекламой (${projects.length}):</b>\n\n`;
  for (const p of projects) {
    const hasAd = p.ad_account_id ? "✅ Подключен" : "⬜ Нет аккаунта";
    text += `<b>${p.name}</b> — ${hasAd}\n`;
  }
  text +=
    "\nПодробная статистика доступна в разделе <b>Маркетинг</b> в AgencyCore.";

  await sendTg(botToken, chatId, text);
}

const TEXT_HANDLERS: Record<
  string,
  (s: SupaClient, b: string, c: number, u: LinkedUser) => Promise<void>
> = {
  "Мои задачи": handleMyTasks,
  "Дедлайны": handleDeadlines,
  "Отчёт по команде": handleTeamReport,
  "Финансовая сводка": handleFinanceSummary,
  "Новые клиенты": handleNewClients,
  "Статус проектов": handleProjectStatus,
  "Загрузка команды": handleTeamWorkload,
  "Съёмки на неделю": handleShootingSchedule,
  "Контент-план": handleContentPlan,
  "Публикации сегодня": handleTodayPublications,
  "Воронка продаж": handleSalesFunnel,
  "Рекламные кампании": handleAdCampaigns,
};

async function handleMenu(
  supabase: SupaClient,
  botToken: string,
  chatId: number,
) {
  const user = await getLinkedUser(supabase, chatId);
  if (!user) {
    await sendTg(
      botToken,
      chatId,
      "Аккаунт не привязан.\nИспользуйте /link XXXXXX для привязки.",
    );
    return;
  }

  const menu = ROLE_MENUS[user.role] || ROLE_MENUS.member;
  const roleName: Record<UserRole, string> = {
    director: "Директор",
    pm: "Проект-менеджер",
    smm: "SMM-менеджер",
    targetologist: "Таргетолог",
    videographer: "Видеограф",
    mobilograph: "Мобилограф",
    photographer: "Фотограф",
    sales: "Менеджер по продажам",
    accountant: "Бухгалтер",
    member: "Сотрудник",
  };

  await sendTg(
    botToken,
    chatId,
    `<b>${user.name}</b> | ${roleName[user.role]}\n\nВыберите действие:`,
    keyboard(menu),
  );
}

async function handleTextQuery(
  supabase: SupaClient,
  botToken: string,
  chatId: number,
  text: string,
) {
  const handler = TEXT_HANDLERS[text];
  if (!handler) return false;

  const user = await getLinkedUser(supabase, chatId);
  if (!user) {
    await sendTg(
      botToken,
      chatId,
      "Аккаунт не привязан. Используйте /link XXXXXX",
    );
    return true;
  }

  await handler(supabase, botToken, chatId, user);
  return true;
}

async function handleStart(
  botToken: string,
  chatId: number,
  firstName: string,
) {
  const text =
    `Добро пожаловать, <b>${firstName}</b>!\n\n` +
    `Я бот <b>AgencyCore</b>.\n\n` +
    `Чтобы привязать аккаунт:\n` +
    `1. Откройте <b>Настройки профиля → Уведомления</b> в AgencyCore\n` +
    `2. Нажмите <b>«Получить код привязки»</b>\n` +
    `3. Отправьте мне полученный код:\n` +
    `<code>/link XXXXXX</code>\n\n` +
    `После привязки отправьте /menu для доступа к функциям.`;

  await sendTg(botToken, chatId, text);
}

async function handleLinkCode(
  supabase: SupaClient,
  botToken: string,
  chatId: number,
  username: string,
  firstName: string,
  code: string,
) {
  const trimmedCode = code.trim().toUpperCase();
  if (!trimmedCode || trimmedCode.length < 4) {
    await sendTg(
      botToken,
      chatId,
      "Неверный формат кода. Отправьте:\n<code>/link XXXXXX</code>",
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
    await sendTg(
      botToken,
      chatId,
      "Код не найден или истёк. Получите новый в CRM.",
    );
    return;
  }

  if (new Date(linkCode.expires_at) < new Date()) {
    await supabase
      .from("telegram_link_codes")
      .delete()
      .eq("id", linkCode.id);
    await sendTg(botToken, chatId, "Код истёк. Получите новый в CRM.");
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
    await sendTg(botToken, chatId, "Ваш Telegram уже привязан. Отправьте /menu");
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
      { onConflict: "user_id,telegram_chat_id" },
    );

  if (linkError) {
    await sendTg(botToken, chatId, "Ошибка при привязке. Попробуйте позже.");
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
    .select("name")
    .eq("id", linkCode.user_id)
    .maybeSingle();

  await sendTg(
    botToken,
    chatId,
    `Telegram привязан к <b>${user?.name || "—"}</b>.\n\nОтправьте /menu для начала работы.`,
  );
}

async function handleUnlink(
  supabase: SupaClient,
  botToken: string,
  chatId: number,
) {
  await supabase
    .from("user_telegram_links")
    .delete()
    .eq("telegram_chat_id", chatId);

  await sendTg(
    botToken,
    chatId,
    "Telegram отвязан. Уведомления отключены.",
    { reply_markup: { remove_keyboard: true } },
  );
}

async function handleStatus(
  supabase: SupaClient,
  botToken: string,
  chatId: number,
) {
  const { data: links } = await supabase
    .from("user_telegram_links")
    .select("user_id, is_active, users(name, email)")
    .eq("telegram_chat_id", chatId);

  if (!links || links.length === 0) {
    await sendTg(botToken, chatId, "Telegram не привязан. Используйте /link");
    return;
  }

  let text = "<b>Привязанные аккаунты:</b>\n\n";
  for (const link of links) {
    const u = (link as any).users;
    const st = link.is_active ? "Активно" : "Отключено";
    text += `<b>${u?.name || "—"}</b> (${u?.email || "—"}) — ${st}\n`;
  }

  await sendTg(botToken, chatId, text);
}

async function handleHelp(botToken: string, chatId: number) {
  await sendTg(
    botToken,
    chatId,
    `<b>Команды AgencyCore:</b>\n\n` +
      `/menu - Открыть меню действий\n` +
      `/tasks - Мои задачи\n` +
      `/deadlines - Ближайшие дедлайны\n` +
      `/link XXXXXX - Привязать аккаунт\n` +
      `/status - Проверить привязку\n` +
      `/unlink - Отвязать аккаунт\n` +
      `/help - Список команд`,
  );
}

async function handleSendNotification(
  supabase: SupaClient,
  botToken: string,
  body: { user_id: string; title: string; message: string; type?: string },
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
      const result = await sendTg(botToken, link.telegram_chat_id, text);
      if (result.ok) sentCount++;
    } catch (e) {
      console.error(`Send failed for ${link.telegram_chat_id}:`, e);
    }
  }

  return { sent: sentCount > 0, sent_count: sentCount };
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
        },
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
        await handleLinkCode(
          supabase,
          botToken,
          chatId,
          username,
          firstName,
          text.substring(6).trim(),
        );
      } else if (text === "/unlink") {
        await handleUnlink(supabase, botToken, chatId);
      } else if (text === "/status") {
        await handleStatus(supabase, botToken, chatId);
      } else if (text === "/help") {
        await handleHelp(botToken, chatId);
      } else if (text === "/menu") {
        await handleMenu(supabase, botToken, chatId);
      } else if (text === "/tasks") {
        const user = await getLinkedUser(supabase, chatId);
        if (user) await handleMyTasks(supabase, botToken, chatId, user);
        else await sendTg(botToken, chatId, "Аккаунт не привязан. /link XXXXXX");
      } else if (text === "/deadlines") {
        const user = await getLinkedUser(supabase, chatId);
        if (user) await handleDeadlines(supabase, botToken, chatId, user);
        else await sendTg(botToken, chatId, "Аккаунт не привязан. /link XXXXXX");
      } else if (text.startsWith("/set ")) {
        await sendTg(
          botToken,
          chatId,
          "Привязка по email отключена.\nИспользуйте <code>/link XXXXXX</code>",
        );
      } else {
        const handled = await handleTextQuery(supabase, botToken, chatId, text);
        if (!handled) {
          await sendTg(
            botToken,
            chatId,
            "Отправьте /menu для списка действий или /help для команд.",
          );
        }
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
      },
    );
  }
});
