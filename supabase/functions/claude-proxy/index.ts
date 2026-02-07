import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { model, max_tokens, temperature, system, messages, organization_id, user_id } =
      await req.json();

    if (!model || !messages || !organization_id || !user_id) {
      return jsonResponse(
        { error: "Missing required fields: model, messages, organization_id, user_id" },
        400
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings } = await supabase
      .from("ai_platform_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!settings) {
      return jsonResponse({ error: "AI platform settings not configured" }, 503);
    }

    if (!settings.global_ai_enabled) {
      return jsonResponse({ error: "AI features are temporarily disabled by the platform administrator" }, 403);
    }

    const masterApiKey = settings.master_api_key;
    if (!masterApiKey) {
      return jsonResponse({ error: "AI service is not configured. Contact the platform administrator." }, 503);
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("id, is_ai_enabled, ai_credit_balance, ai_daily_limit")
      .eq("id", organization_id)
      .maybeSingle();

    if (!org) {
      return jsonResponse({ error: "Organization not found" }, 404);
    }

    if (!org.is_ai_enabled) {
      return jsonResponse({ error: "AI features are not activated for your organization" }, 403);
    }

    if (org.ai_credit_balance <= 0) {
      return jsonResponse(
        { error: "Insufficient AI credits. Please top up your balance.", code: "INSUFFICIENT_CREDITS" },
        402
      );
    }

    const dailyLimit = org.ai_daily_limit ?? settings.default_daily_limit;
    const { data: dailySpend } = await supabase.rpc("get_org_daily_ai_spend", { p_org_id: organization_id });

    if (dailySpend !== null && dailySpend >= dailyLimit) {
      return jsonResponse(
        { error: "Daily AI spending limit exceeded. Try again tomorrow.", code: "DAILY_LIMIT_EXCEEDED" },
        429
      );
    }

    const claudeResponse = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": masterApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: max_tokens || 2000,
        temperature: temperature ?? 0.7,
        system: system || undefined,
        messages,
      }),
    });

    const claudeData = await claudeResponse.json();

    if (!claudeResponse.ok) {
      return jsonResponse(claudeData, claudeResponse.status);
    }

    const usage = claudeData.usage;
    const inputTokens = usage?.input_tokens || 0;
    const outputTokens = usage?.output_tokens || 0;

    const userMessage = messages?.[messages.length - 1]?.content || "";
    const requestSummary = typeof userMessage === "string"
      ? userMessage.substring(0, 200)
      : JSON.stringify(userMessage).substring(0, 200);

    const requestId = `req_${crypto.randomUUID()}`;

    const { data: deductResult } = await supabase.rpc("deduct_ai_credits", {
      p_org_id: organization_id,
      p_user_id: user_id,
      p_request_id: requestId,
      p_model_slug: model,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_request_summary: requestSummary,
    });

    const billing = deductResult || {};

    return jsonResponse({
      ...claudeData,
      billing: {
        credits_deducted: billing.deducted || 0,
        balance_after: billing.balance_after || 0,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        success: billing.success || false,
        error: billing.error || null,
      },
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error.message || "Internal server error" },
      500
    );
  }
});
