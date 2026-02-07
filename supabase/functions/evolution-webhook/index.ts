import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("8") && cleaned.length === 11) {
    cleaned = "7" + cleaned.slice(1);
  }
  if (cleaned.length === 10) {
    cleaned = "7" + cleaned;
  }
  return cleaned;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "online", message: "Evolution API webhook ready" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const payload = await req.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const event = payload.event;
    const instanceName = payload.instance;

    await supabase.from("webhook_logs").insert({
      source: "evolution_api",
      webhook_type: event || "unknown",
      payload,
      received_at: new Date().toISOString(),
    });

    if (!instanceName) {
      return new Response(JSON.stringify({ error: "no instance" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: evoInst } = await supabase
      .from("evolution_instances")
      .select("*")
      .eq("instance_name", instanceName)
      .limit(1)
      .single();

    if (!evoInst) {
      return new Response(JSON.stringify({ error: "instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = evoInst.organization_id;

    if (event === "QRCODE_UPDATED") {
      const qr = payload.data?.qrcode?.base64 || payload.data?.qrcode;
      if (qr) {
        await supabase
          .from("evolution_instances")
          .update({
            qr_code: qr,
            qr_code_updated_at: new Date().toISOString(),
            connection_status: "qr",
          })
          .eq("instance_name", instanceName);
      }
    }

    if (event === "CONNECTION_UPDATE") {
      const state = payload.data?.state;
      if (state) {
        const updates: Record<string, any> = {
          connection_status: state === "close" ? "disconnected" : state,
          updated_at: new Date().toISOString(),
        };
        if (state === "open") {
          updates.last_connected_at = new Date().toISOString();
          updates.error_message = null;
          const wuid = payload.data?.instance?.wuid;
          if (wuid) updates.phone_number = wuid.split("@")[0];
        }
        await supabase
          .from("evolution_instances")
          .update(updates)
          .eq("instance_name", instanceName);
      }
    }

    if (event === "MESSAGES_UPSERT") {
      const msg = payload.data;
      if (!msg?.key) {
        return new Response(JSON.stringify({ status: "ignored" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const messageId = msg.key.id;
      const remoteJid = msg.key.remoteJid;
      const fromMe = msg.key.fromMe;
      const isGroup = remoteJid?.includes("@g.us");

      const { data: existing } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("message_id", messageId)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ status: "duplicate" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let phone: string | null = null;
      if (!isGroup && remoteJid) {
        phone = normalizePhone(remoteJid.split("@")[0]);
      }

      let clientId: string | null = null;
      if (phone) {
        const { data: client } = await supabase
          .from("clients")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("phone", phone)
          .maybeSingle();

        if (client) {
          clientId = client.id;
        } else if (!fromMe) {
          const { data: newClient } = await supabase
            .from("clients")
            .insert({
              organization_id: organizationId,
              name: msg.pushName || phone,
              phone,
              status: "lead",
            })
            .select("id")
            .single();
          if (newClient) clientId = newClient.id;
        }
      }

      let content = "";
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;
      let mediaFilename: string | null = null;
      const m = msg.message;

      if (m?.conversation) {
        content = m.conversation;
      } else if (m?.extendedTextMessage) {
        content = m.extendedTextMessage.text;
      } else if (m?.imageMessage) {
        content = m.imageMessage.caption || "[Image]";
        mediaUrl = m.imageMessage.url;
        mediaType = "image";
      } else if (m?.videoMessage) {
        content = m.videoMessage.caption || "[Video]";
        mediaUrl = m.videoMessage.url;
        mediaType = "video";
      } else if (m?.audioMessage) {
        content = "[Audio]";
        mediaUrl = m.audioMessage.url;
        mediaType = "audio";
      } else if (m?.documentMessage) {
        content = m.documentMessage.caption || "[Document]";
        mediaUrl = m.documentMessage.url;
        mediaType = "document";
        mediaFilename = m.documentMessage.fileName;
      }

      const chatId = remoteJid;
      const ts = msg.messageTimestamp
        ? new Date(msg.messageTimestamp * 1000).toISOString()
        : new Date().toISOString();

      await supabase.from("whatsapp_chats").upsert(
        {
          chat_id: chatId,
          chat_name: isGroup ? msg.pushName || chatId : phone || chatId,
          chat_type: isGroup ? "group" : "individual",
          client_id: clientId,
          phone,
          last_message_at: ts,
          organization_id: organizationId,
          provider_type: "evolution",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "chat_id" }
      );

      await supabase.from("whatsapp_messages").insert({
        organization_id: organizationId,
        client_id: clientId,
        message_id: messageId,
        direction: fromMe ? "outgoing" : "incoming",
        content,
        sender_name: msg.pushName || phone || "Unknown",
        status: "sent",
        timestamp: ts,
        media_url: mediaUrl,
        media_type: mediaType,
        media_filename: mediaFilename,
        chat_id: chatId,
        chat_type: "whatsapp",
        is_read: fromMe,
        provider_type: "evolution",
      });
    }

    if (event === "MESSAGES_UPDATE") {
      const upd = payload.data;
      if (upd?.key?.id && upd?.update?.status !== undefined) {
        const statusMap: Record<number, string> = { 1: "sent", 2: "delivered", 3: "read" };
        const mapped = statusMap[upd.update.status] || "sent";
        await supabase
          .from("whatsapp_messages")
          .update({ status: mapped })
          .eq("message_id", upd.key.id);
      }
    }

    return new Response(JSON.stringify({ status: "ok", event }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("evolution-webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
