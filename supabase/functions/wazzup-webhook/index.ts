import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('8') && cleaned.length === 11) {
    cleaned = '7' + cleaned.slice(1);
  }
  
  if (cleaned.length === 10) {
    cleaned = '7' + cleaned;
  }
  
  return cleaned;
}

interface WazzupContact {
  name?: string;
  phone?: string;
}

interface WazzupMessage {
  messageId: string;
  dateTime: string;
  channelId: string;
  chatType: string;
  chatId: string;
  text?: string;
  type?: string;
  isEcho?: boolean;
  contact?: WazzupContact;
  contentUri?: string;
  status?: string;
}

interface WazzupStatus {
  messageId: string;
  timestamp: string;
  status: string;
}

interface WazzupWebhookPayload {
  test?: boolean;
  messages?: WazzupMessage[];
  statuses?: WazzupStatus[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ 
      status: 'online',
      message: 'Wazzup webhook is ready. Send POST requests to this endpoint.',
      endpoint: req.url
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get organization_id from query params
    const url = new URL(req.url);
    const organizationId = url.searchParams.get("organization_id") || null;

    // If no organization_id provided, get the first organization (default)
    let finalOrganizationId = organizationId;
    if (!finalOrganizationId) {
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1);

      if (orgs && orgs.length > 0) {
        finalOrganizationId = orgs[0].id;
      }
    }

    const payload: WazzupWebhookPayload = await req.json();
    
    console.log('=== Wazzup webhook received ===');
    console.log(JSON.stringify(payload, null, 2));

    await supabase.from('webhook_logs').insert({
      source: 'wazzup',
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      body: JSON.stringify(payload),
      parsed_data: payload,
      result: 'processing'
    });

    if (payload.test) {
      console.log('✓ Test webhook received');
      return new Response(JSON.stringify({ success: true, message: 'Test OK' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (payload.messages && payload.messages.length > 0) {
      console.log(`\n>>> Processing ${payload.messages.length} message(s)`);
      
      for (const msg of payload.messages) {
        console.log(`\n--- Message ${msg.messageId} ---`);
        console.log(`Type: ${msg.type}`);
        console.log(`Status: ${msg.status}`);
        console.log(`isEcho: ${msg.isEcho}`);
        console.log(`Text: ${msg.text || '[no text]'}`);
        console.log(`ChatId: ${msg.chatId}`);
        
        const direction = msg.isEcho === true ? 'outgoing' : 'incoming';
        console.log(`Direction: ${direction}`);
        
        const rawPhone = msg.chatId;
        const normalizedPhone = normalizePhone(rawPhone);
        
        console.log(`Looking for client: ${rawPhone} -> ${normalizedPhone}`);
        
        const { data: allClients, error: clientError } = await supabase
          .from('clients')
          .select('id, phone, name');
        
        if (clientError) {
          console.error('Error fetching clients:', clientError);
          continue;
        }
        
        let clientId = null;
        if (allClients) {
          for (const client of allClients) {
            const clientNormalized = normalizePhone(client.phone || '');
            if (clientNormalized === normalizedPhone) {
              clientId = client.id;
              console.log(`✓ Found client: ${client.name} (${client.id})`);
              break;
            }
          }
        }

        if (clientId) {
          const { data: existing } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .eq('message_id', msg.messageId)
            .maybeSingle();

          if (!existing) {
            console.log(`Creating ${direction} message...`);
            
            let mediaType = null;
            let contentText = msg.text || '';

            if (msg.contentUri) {
              if (msg.type === 'image') {
                mediaType = 'image';
                contentText = contentText || '[Изображение]';
              } else if (msg.type === 'video') {
                mediaType = 'video';
                contentText = contentText || '[Видео]';
              } else if (msg.type === 'audio' || msg.type === 'voice') {
                mediaType = 'audio';
                contentText = contentText || '[Аудиосообщение]';
              } else if (msg.type === 'document' || msg.type === 'file') {
                mediaType = 'document';
                contentText = contentText || '[Документ]';
              } else {
                mediaType = msg.type || 'document';
                contentText = contentText || '[Файл]';
              }
            }

            const messageData: any = {
              client_id: clientId,
              message_id: msg.messageId,
              direction: direction,
              content: contentText,
              sender_name: direction === 'incoming' ? (msg.contact?.name || msg.chatId) : null,
              user_id: null,
              status: msg.status === 'inbound' ? 'delivered' : 'sent',
              timestamp: msg.dateTime,
              media_url: msg.contentUri || null,
              media_type: mediaType,
              channel_id: msg.channelId,
              chat_id: msg.chatId,
              chat_type: msg.chatType,
              is_read: direction === 'outgoing'
            };
            
            const { data: inserted, error: insertError } = await supabase
              .from('whatsapp_messages')
              .insert(messageData)
              .select();
            
            if (insertError) {
              console.error('Error inserting message:', insertError);
              await supabase.from('webhook_logs').insert({
                source: 'wazzup',
                method: 'ERROR',
                body: JSON.stringify(messageData),
                error_message: insertError.message,
                result: 'error'
              });
            } else {
              console.log('✓ Message saved successfully');
            }
          } else {
            console.log(`Message already exists`);
          }
        } else if (direction === 'incoming') {
          console.log(`✗ No client found for: ${rawPhone}, creating new lead`);

          const clientName = msg.contact?.name || `WhatsApp ${rawPhone}`;

          const { data: newClient, error: createError } = await supabase
            .from('clients')
            .insert({
              organization_id: finalOrganizationId,
              name: clientName,
              company: '',
              phone: rawPhone,
              status: 'New Lead',
              source: 'WhatsApp',
              utm_source: 'whatsapp',
              utm_medium: 'direct',
              utm_campaign: 'incoming_message',
              description: `Автоматически создан из входящего сообщения WhatsApp`
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating new client:', createError);
            await supabase.from('webhook_logs').insert({
              source: 'wazzup',
              method: 'ERROR',
              body: JSON.stringify({ phone: rawPhone, normalized: normalizedPhone, name: clientName }),
              error_message: `Failed to create client: ${createError.message}`,
              result: 'client_creation_failed'
            });
          } else {
            console.log(`✓ Created new client: ${newClient.name} (${newClient.id})`);
            clientId = newClient.id;

            await supabase.from('webhook_logs').insert({
              source: 'wazzup',
              method: 'INFO',
              body: JSON.stringify({ phone: rawPhone, clientId: newClient.id, name: clientName }),
              result: 'client_created'
            });

            console.log(`Creating incoming message for new client...`);

            let mediaType = null;
            let contentText = msg.text || '';

            if (msg.contentUri) {
              if (msg.type === 'image') {
                mediaType = 'image';
                contentText = contentText || '[Изображение]';
              } else if (msg.type === 'video') {
                mediaType = 'video';
                contentText = contentText || '[Видео]';
              } else if (msg.type === 'audio' || msg.type === 'voice') {
                mediaType = 'audio';
                contentText = contentText || '[Аудиосообщение]';
              } else if (msg.type === 'document' || msg.type === 'file') {
                mediaType = 'document';
                contentText = contentText || '[Документ]';
              } else {
                mediaType = msg.type || 'document';
                contentText = contentText || '[Файл]';
              }
            }

            const messageData: any = {
              client_id: clientId,
              message_id: msg.messageId,
              direction: 'incoming',
              content: contentText,
              sender_name: msg.contact?.name || msg.chatId,
              user_id: null,
              status: msg.status === 'inbound' ? 'delivered' : 'sent',
              timestamp: msg.dateTime,
              media_url: msg.contentUri || null,
              media_type: mediaType,
              channel_id: msg.channelId,
              chat_id: msg.chatId,
              chat_type: msg.chatType,
              is_read: false
            };

            const { error: insertError } = await supabase
              .from('whatsapp_messages')
              .insert(messageData);

            if (insertError) {
              console.error('Error inserting message for new client:', insertError);
            } else {
              console.log('✓ Message saved for new client');
            }
          }
        } else {
          console.log(`✗ No client found for outgoing message: ${rawPhone}`);
          await supabase.from('webhook_logs').insert({
            source: 'wazzup',
            method: 'INFO',
            body: JSON.stringify({ phone: rawPhone, normalized: normalizedPhone }),
            error_message: 'Client not found',
            result: 'client_not_found'
          });
        }
      }
    }

    if (payload.statuses && payload.statuses.length > 0) {
      console.log(`\n>>> Processing ${payload.statuses.length} status update(s)`);
      for (const status of payload.statuses) {
        console.log(`Updating status for ${status.messageId}: ${status.status}`);
        const { error: updateError } = await supabase
          .from('whatsapp_messages')
          .update({ status: status.status })
          .eq('message_id', status.messageId);
        
        if (updateError) {
          console.error('Error updating status:', updateError);
        } else {
          console.log('✓ Status updated');
        }
      }
    }

    console.log('\n=== Webhook processing complete ===\n');

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('\n!!! Webhook error !!!', error);
    
    await supabase.from('webhook_logs').insert({
      source: 'wazzup',
      method: 'ERROR',
      error_message: error.message,
      result: 'error'
    }).catch(() => {});
    
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});