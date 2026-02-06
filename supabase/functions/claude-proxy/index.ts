import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { model, max_tokens, temperature, system, messages, organization_id } =
      await req.json();

    if (!model || !messages || !organization_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: model, messages, organization_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: integration } = await supabase
      .from("integrations")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("integration_type", "claude_api")
      .eq("is_active", true)
      .maybeSingle();

    if (!integration) {
      return new Response(
        JSON.stringify({ error: "Claude API integration not found or inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: credential } = await supabase
      .from("integration_credentials")
      .select("credential_value")
      .eq("integration_id", integration.id)
      .eq("credential_key", "api_key")
      .maybeSingle();

    const apiKey = credential?.credential_value;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Claude API key not configured in integration credentials" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claudeResponse = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2024-10-22",
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
      return new Response(JSON.stringify(claudeData), {
        status: claudeResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(claudeData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
