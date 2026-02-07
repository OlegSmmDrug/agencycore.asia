import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getEvolutionSettings(supabase: any) {
  const { data, error } = await supabase
    .from("evolution_settings")
    .select("*")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Evolution API не настроен. Укажите server_url и api_key в настройках.");
  }

  return { serverUrl: data.server_url.replace(/\/+$/, ""), apiKey: data.api_key };
}

async function proxyToEvolution(
  serverUrl: string,
  apiKey: string,
  endpoint: string,
  method: string,
  body?: any
) {
  const url = `${serverUrl}${endpoint}`;

  const res = await fetch(url, {
    method,
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    return { ok: false, status: res.status, data: json };
  }

  return { ok: true, status: res.status, data: json };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = req.method !== "GET" ? await req.json() : null;
    const action: string = body?.action || new URL(req.url).searchParams.get("action") || "";

    if (action === "save_settings") {
      const { serverUrl, apiKey } = body;
      if (!serverUrl || !apiKey) {
        return new Response(
          JSON.stringify({ error: "serverUrl and apiKey required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cleanUrl = serverUrl.replace(/\/+$/, "");

      let healthy = false;
      try {
        const testRes = await fetch(`${cleanUrl}/instance/fetchInstances`, {
          method: "GET",
          headers: { apikey: apiKey, "Content-Type": "application/json" },
        });
        healthy = testRes.ok;
      } catch { /* server unreachable */ }

      const { data: existing } = await supabase
        .from("evolution_settings")
        .select("id")
        .eq("is_active", true)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("evolution_settings")
          .update({
            server_url: cleanUrl,
            api_key: apiKey,
            health_status: healthy ? "healthy" : "unhealthy",
            last_health_check: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("evolution_settings").insert({
          server_url: cleanUrl,
          api_key: apiKey,
          is_active: true,
          health_status: healthy ? "healthy" : "unhealthy",
          last_health_check: new Date().toISOString(),
        });
      }

      return new Response(
        JSON.stringify({ ok: true, status: 200, data: { connected: healthy } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_settings") {
      const { data } = await supabase
        .from("evolution_settings")
        .select("server_url, is_active, health_status, last_health_check")
        .eq("is_active", true)
        .maybeSingle();

      return new Response(
        JSON.stringify({ ok: true, status: 200, data: data || null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!action) {
      return new Response(
        JSON.stringify({ error: "action is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { serverUrl, apiKey } = await getEvolutionSettings(supabase);

    let result: any;

    switch (action) {
      case "test_connection": {
        result = await proxyToEvolution(serverUrl, apiKey, "/instance/fetchInstances", "GET");
        break;
      }

      case "create_instance": {
        const { instanceName, organizationId } = body;
        if (!instanceName || !organizationId) {
          return new Response(
            JSON.stringify({ error: "instanceName and organizationId required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook`;

        const payload = {
          instanceName,
          qrcode: true,
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: true,
            events: [
              "QRCODE_UPDATED",
              "CONNECTION_UPDATE",
              "MESSAGES_UPSERT",
              "MESSAGES_UPDATE",
              "SEND_MESSAGE",
            ],
          },
        };

        result = await proxyToEvolution(serverUrl, apiKey, "/instance/create", "POST", payload);

        if (result.ok) {
          const qrBase64 = result.data?.qrcode?.base64 || null;

          await supabase.from("evolution_instances").insert({
            organization_id: organizationId,
            instance_name: instanceName,
            connection_status: qrBase64 ? "qr" : "connecting",
            webhook_configured: true,
            qr_code: qrBase64,
            qr_code_updated_at: qrBase64 ? new Date().toISOString() : null,
          });

          result.data = {
            ...result.data,
            qrCode: qrBase64,
          };
        }
        break;
      }

      case "connect_instance": {
        const { instanceName: connName } = body;
        if (!connName) {
          return new Response(
            JSON.stringify({ error: "instanceName required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        result = await proxyToEvolution(serverUrl, apiKey, `/instance/connect/${connName}`, "GET");

        if (result.ok) {
          const qrCode = result.data?.code || null;
          const pairingCode = result.data?.pairingCode || null;

          const { data: inst } = await supabase
            .from("evolution_instances")
            .select("qr_code")
            .eq("instance_name", connName)
            .maybeSingle();

          const existingQr = inst?.qr_code || null;

          await supabase
            .from("evolution_instances")
            .update({
              connection_status: "qr",
              updated_at: new Date().toISOString(),
            })
            .eq("instance_name", connName);

          result.data = {
            qrCode: existingQr,
            qrCodeRaw: qrCode,
            pairingCode,
            state: "qr",
          };
        }
        break;
      }

      case "connection_state": {
        const { instanceName: stateName } = body;
        if (!stateName) {
          return new Response(
            JSON.stringify({ error: "instanceName required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        result = await proxyToEvolution(
          serverUrl,
          apiKey,
          `/instance/connectionState/${stateName}`,
          "GET"
        );

        if (result.ok) {
          const state = result.data?.instance?.state || result.data?.state || "disconnected";

          const updates: any = {
            connection_status: state === "close" ? "disconnected" : state,
            updated_at: new Date().toISOString(),
          };
          if (state === "open") {
            updates.last_connected_at = new Date().toISOString();
            updates.error_message = null;
          }

          await supabase
            .from("evolution_instances")
            .update(updates)
            .eq("instance_name", stateName);

          result.data = { state: updates.connection_status };
        }
        break;
      }

      case "restart_instance": {
        const { instanceName: restartName } = body;
        result = await proxyToEvolution(
          serverUrl,
          apiKey,
          `/instance/restart/${restartName}`,
          "PUT"
        );

        if (result.ok) {
          await supabase
            .from("evolution_instances")
            .update({ connection_status: "connecting", updated_at: new Date().toISOString() })
            .eq("instance_name", restartName);
        }
        break;
      }

      case "logout_instance": {
        const { instanceName: logoutName } = body;
        result = await proxyToEvolution(
          serverUrl,
          apiKey,
          `/instance/logout/${logoutName}`,
          "DELETE"
        );

        await supabase
          .from("evolution_instances")
          .update({
            connection_status: "disconnected",
            phone_number: null,
            qr_code: null,
            last_connected_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("instance_name", logoutName);
        break;
      }

      case "delete_instance": {
        const { instanceName: deleteName } = body;

        result = await proxyToEvolution(
          serverUrl,
          apiKey,
          `/instance/delete/${deleteName}`,
          "DELETE"
        );

        await supabase.from("evolution_instances").delete().eq("instance_name", deleteName);

        result = { ok: true, status: 200, data: { deleted: true } };
        break;
      }

      case "send_text": {
        const { instanceName: textInst, number, text } = body;
        result = await proxyToEvolution(
          serverUrl,
          apiKey,
          `/message/sendText/${textInst}`,
          "POST",
          { number, text }
        );
        break;
      }

      case "send_media": {
        const {
          instanceName: mediaInst,
          number: mediaNumber,
          mediatype,
          media,
          caption,
          fileName,
        } = body;
        result = await proxyToEvolution(
          serverUrl,
          apiKey,
          `/message/sendMedia/${mediaInst}`,
          "POST",
          { number: mediaNumber, mediatype, media, caption, fileName }
        );
        break;
      }

      case "send_audio": {
        const { instanceName: audioInst, number: audioNumber, audio } = body;
        result = await proxyToEvolution(
          serverUrl,
          apiKey,
          `/message/sendWhatsAppAudio/${audioInst}`,
          "POST",
          { number: audioNumber, audio }
        );
        break;
      }

      case "set_webhook": {
        const { instanceName: whName } = body;
        if (!whName) {
          return new Response(
            JSON.stringify({ error: "instanceName required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook`;
        result = await proxyToEvolution(
          serverUrl,
          apiKey,
          `/webhook/set/${whName}`,
          "POST",
          {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            webhookBase64: true,
            events: [
              "QRCODE_UPDATED",
              "CONNECTION_UPDATE",
              "MESSAGES_UPSERT",
              "MESSAGES_UPDATE",
              "SEND_MESSAGE",
            ],
          }
        );

        if (result.ok) {
          await supabase
            .from("evolution_instances")
            .update({ webhook_configured: true, updated_at: new Date().toISOString() })
            .eq("instance_name", whName);
        }
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      status: result.status || 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("evolution-proxy error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
