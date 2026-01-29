import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const greenApiUrl = Deno.env.get('VITE_GREEN_API_URL') || 'https://api.green-api.com';
const greenApiIdInstance = Deno.env.get('VITE_GREEN_API_ID_INSTANCE');
const greenApiToken = Deno.env.get('VITE_GREEN_API_TOKEN');

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

interface GreenApiTextMessage {
  typeMessage: 'textMessage';
  textMessageData: {
    textMessage: string;
  };
}

interface GreenApiFileMessage {
  typeMessage: 'imageMessage' | 'videoMessage' | 'documentMessage' | 'audioMessage';
  fileMessageData?: {
    downloadUrl: string;
    caption?: string;
    fileName?: string;
    mimeType?: string;
  };
  imageMessageData?: {
    downloadUrl: string;
    caption?: string;
    fileName?: string;
  };
  videoMessageData?: {
    downloadUrl: string;
    caption?: string;
    fileName?: string;
  };
  audioMessageData?: {
    downloadUrl: string;
  };
  documentMessageData?: {
    downloadUrl: string;
    caption?: string;
    fileName?: string;
  };
  downloadUrl?: string;
  caption?: string;
}

interface GreenApiWebhookPayload {
  typeWebhook: 'incomingMessageReceived' | 'outgoingMessageReceived' | 'outgoingAPIMessageReceived' | 'outgoingMessageStatus' | 'stateInstanceChanged' | 'deviceInfo';
  instanceData?: {
    idInstance: number;
    wid: string;
    typeInstance: string;
  };
  timestamp?: number;
  idMessage?: string;
  senderData?: {
    chatId: string;
    chatName?: string;
    sender?: string;
    senderName?: string;
  };
  messageData?: GreenApiTextMessage | GreenApiFileMessage;
  sendByApi?: boolean;
  status?: string;
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
      message: 'Green API webhook is ready. Send POST requests to this endpoint.',
      endpoint: req.url
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload: GreenApiWebhookPayload = await req.json();

    console.log('=== Green API webhook received ===');
    console.log(JSON.stringify(payload, null, 2));

    await supabase.from('webhook_logs').insert({
      source: 'green-api',
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      body: JSON.stringify(payload),
      parsed_data: payload,
      result: 'processing'
    });

    if (payload.typeWebhook === 'incomingMessageReceived' ||
        payload.typeWebhook === 'outgoingMessageReceived' ||
        payload.typeWebhook === 'outgoingAPIMessageReceived') {

      const isIncoming = payload.typeWebhook === 'incomingMessageReceived';
      const isOutgoingPhone = payload.typeWebhook === 'outgoingMessageReceived';
      const isOutgoingAPI = payload.typeWebhook === 'outgoingAPIMessageReceived';

      console.log(`\n>>> Processing ${isIncoming ? 'incoming' : 'outgoing'} message (${payload.typeWebhook})`);

      const chatId = payload.senderData?.chatId || '';
      const rawPhone = chatId.replace('@c.us', '').replace('@g.us', '');
      const normalizedPhone = normalizePhone(rawPhone);

      console.log(`Looking for client: ${rawPhone} -> ${normalizedPhone}`);

      const { data: allClients, error: clientError } = await supabase
        .from('clients')
        .select('id, phone, name, organization_id');

      if (clientError) {
        console.error('Error fetching clients:', clientError);
        throw clientError;
      }

      let clientId = null;
      let organizationId = null;
      if (allClients) {
        for (const client of allClients) {
          const clientNormalized = normalizePhone(client.phone || '');
          if (clientNormalized === normalizedPhone) {
            clientId = client.id;
            organizationId = client.organization_id;
            console.log(`✓ Found client: ${client.name} (${client.id}), org: ${organizationId}`);
            break;
          }
        }
      }

      if (clientId && payload.idMessage) {
        const { data: existing } = await supabase
          .from('whatsapp_messages')
          .select('id')
          .eq('message_id', payload.idMessage)
          .maybeSingle();

        if (!existing) {
          let content = '';
          let mediaUrl = null;
          let mediaType = null;

          const messageData = payload.messageData;

          if (messageData?.typeMessage === 'textMessage') {
            content = (messageData as GreenApiTextMessage).textMessageData?.textMessage || '';
          } else if (messageData?.typeMessage === 'imageMessage') {
            const fileData = messageData as GreenApiFileMessage;
            const downloadUrl = fileData.imageMessageData?.downloadUrl || fileData.fileMessageData?.downloadUrl || fileData.downloadUrl || null;
            if (downloadUrl) {
              mediaUrl = downloadUrl;
            }
            content = fileData.imageMessageData?.caption || fileData.fileMessageData?.caption || fileData.caption || '';
            mediaType = 'image';
          } else if (messageData?.typeMessage === 'videoMessage') {
            const fileData = messageData as GreenApiFileMessage;
            const downloadUrl = fileData.videoMessageData?.downloadUrl || fileData.fileMessageData?.downloadUrl || fileData.downloadUrl || null;
            if (downloadUrl) {
              mediaUrl = downloadUrl;
            }
            content = fileData.videoMessageData?.caption || fileData.fileMessageData?.caption || fileData.caption || '';
            mediaType = 'video';
          } else if (messageData?.typeMessage === 'audioMessage') {
            const fileData = messageData as GreenApiFileMessage;
            const downloadUrl = fileData.audioMessageData?.downloadUrl || fileData.fileMessageData?.downloadUrl || fileData.downloadUrl || null;
            if (downloadUrl) {
              mediaUrl = downloadUrl;
            }
            content = '[Голосовое сообщение]';
            mediaType = 'audio';
          } else if (messageData?.typeMessage === 'documentMessage') {
            const fileData = messageData as GreenApiFileMessage;
            const downloadUrl = fileData.documentMessageData?.downloadUrl || fileData.fileMessageData?.downloadUrl || fileData.downloadUrl || null;
            const fileName = fileData.documentMessageData?.fileName || fileData.fileMessageData?.fileName || 'Документ';
            if (downloadUrl) {
              mediaUrl = downloadUrl;
            }
            content = fileData.documentMessageData?.caption || fileData.fileMessageData?.caption || fileData.caption || fileName;
            mediaType = 'document';
          }

          const direction = isIncoming ? 'incoming' : 'outgoing';

          const chatType = chatId.includes('@g.us') ? 'group' : 'individual';

          let chatName: string;
          if (chatType === 'group') {
            chatName = payload.senderData?.chatName || `Группа ${rawPhone}`;
          } else {
            chatName = payload.senderData?.chatName || payload.senderData?.senderName || rawPhone;
          }

          if (organizationId) {
            const { data: existingChat } = await supabase
              .from('whatsapp_chats')
              .select('id, chat_name')
              .eq('chat_id', chatId)
              .eq('organization_id', organizationId)
              .maybeSingle();

            if (existingChat) {
              await supabase
                .from('whatsapp_chats')
                .update({
                  last_message_at: payload.timestamp ? new Date(payload.timestamp * 1000).toISOString() : new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('chat_id', chatId)
                .eq('organization_id', organizationId);
            } else {
              await supabase
                .from('whatsapp_chats')
                .insert({
                  chat_id: chatId,
                  chat_name: chatName,
                  chat_type: chatType,
                  client_id: clientId,
                  phone: chatType === 'individual' ? rawPhone : null,
                  last_message_at: payload.timestamp ? new Date(payload.timestamp * 1000).toISOString() : new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  organization_id: organizationId
                });
            }
          }

          if (organizationId) {
            const messageInsert: any = {
              client_id: clientId,
              message_id: payload.idMessage,
              direction: direction,
              content: content || '',
              sender_name: direction === 'incoming' ? (payload.senderData?.senderName || payload.senderData?.chatName || rawPhone) : 'Менеджер',
              user_id: null,
              status: direction === 'outgoing' ? 'sent' : 'delivered',
              timestamp: payload.timestamp ? new Date(payload.timestamp * 1000).toISOString() : new Date().toISOString(),
              media_url: mediaUrl,
              media_type: mediaType,
              media_filename: mediaType ? (messageData as any)?.documentMessageData?.fileName || (messageData as any)?.fileMessageData?.fileName || null : null,
              channel_id: payload.instanceData?.idInstance?.toString() || null,
              chat_id: chatId,
              chat_name: chatName,
              chat_type: 'whatsapp',
              is_read: direction === 'outgoing',
              organization_id: organizationId
            };

            const { error: insertError } = await supabase
              .from('whatsapp_messages')
              .insert(messageInsert);

          if (insertError) {
            console.error('Error inserting message:', insertError);
            await supabase.from('webhook_logs').insert({
              source: 'green-api',
              method: 'ERROR',
              body: JSON.stringify(messageInsert),
              error_message: insertError.message,
              result: 'error'
            });
          } else {
            console.log('✓ Message saved successfully');
          }
        } else {
          console.log('✗ No organization_id found for client');
        }
        } else {
          console.log('Message already exists, skipping duplicate');
        }
      } else {
        if (!clientId && isIncoming) {
          console.log(`✗ No client found for: ${rawPhone}, creating new lead`);

          const instanceIdString = payload.instanceData?.idInstance?.toString();

          const { data: integration } = await supabase
            .from('integrations')
            .select('organization_id')
            .eq('integration_type', 'green_api')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

          if (!integration?.organization_id) {
            console.log('✗ No active Green API integration found, cannot create client');
            return new Response(JSON.stringify({ success: false, message: 'No active integration' }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          organizationId = integration.organization_id;
          const clientName = payload.senderData?.senderName || payload.senderData?.chatName || `WhatsApp ${rawPhone}`;

          const { data: newClient, error: createError } = await supabase
            .from('clients')
            .insert({
              name: clientName,
              company: '',
              phone: rawPhone,
              status: 'New Lead',
              source: 'WhatsApp',
              utm_source: 'whatsapp',
              utm_medium: 'direct',
              utm_campaign: 'incoming_message',
              description: `Автоматически создан из входящего сообщения WhatsApp`,
              organization_id: organizationId
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating new client:', createError);
            await supabase.from('webhook_logs').insert({
              source: 'green-api',
              method: 'ERROR',
              body: JSON.stringify({ phone: rawPhone, normalized: normalizedPhone, name: clientName }),
              error_message: `Failed to create client: ${createError.message}`,
              result: 'client_creation_failed'
            });
          } else {
            console.log(`✓ Created new client: ${newClient.name} (${newClient.id})`);
            clientId = newClient.id;

            await supabase.from('webhook_logs').insert({
              source: 'green-api',
              method: 'INFO',
              body: JSON.stringify({ phone: rawPhone, clientId: newClient.id, name: clientName }),
              result: 'client_created'
            });

            if (clientId && payload.idMessage) {
              const { data: existing } = await supabase
                .from('whatsapp_messages')
                .select('id')
                .eq('message_id', payload.idMessage)
                .maybeSingle();

              if (!existing) {
                let content = '';
                let mediaUrl = null;
                let mediaType = null;

                const messageData = payload.messageData;

                if (messageData?.typeMessage === 'textMessage') {
                  content = (messageData as GreenApiTextMessage).textMessageData?.textMessage || '';
                } else if (messageData?.typeMessage === 'imageMessage') {
                  const fileData = messageData as GreenApiFileMessage;
                  const downloadUrl = fileData.imageMessageData?.downloadUrl || fileData.fileMessageData?.downloadUrl || fileData.downloadUrl || null;
                  if (downloadUrl) {
                    mediaUrl = downloadUrl;
                  }
                  content = fileData.imageMessageData?.caption || fileData.fileMessageData?.caption || fileData.caption || '';
                  mediaType = 'image';
                } else if (messageData?.typeMessage === 'videoMessage') {
                  const fileData = messageData as GreenApiFileMessage;
                  const downloadUrl = fileData.videoMessageData?.downloadUrl || fileData.fileMessageData?.downloadUrl || fileData.downloadUrl || null;
                  if (downloadUrl) {
                    mediaUrl = downloadUrl;
                  }
                  content = fileData.videoMessageData?.caption || fileData.fileMessageData?.caption || fileData.caption || '';
                  mediaType = 'video';
                } else if (messageData?.typeMessage === 'audioMessage') {
                  const fileData = messageData as GreenApiFileMessage;
                  const downloadUrl = fileData.audioMessageData?.downloadUrl || fileData.fileMessageData?.downloadUrl || fileData.downloadUrl || null;
                  if (downloadUrl) {
                    mediaUrl = downloadUrl;
                  }
                  content = '[Голосовое сообщение]';
                  mediaType = 'audio';
                } else if (messageData?.typeMessage === 'documentMessage') {
                  const fileData = messageData as GreenApiFileMessage;
                  const downloadUrl = fileData.documentMessageData?.downloadUrl || fileData.fileMessageData?.downloadUrl || fileData.downloadUrl || null;
                  const fileName = fileData.documentMessageData?.fileName || fileData.fileMessageData?.fileName || 'Документ';
                  if (downloadUrl) {
                    mediaUrl = downloadUrl;
                  }
                  content = fileData.documentMessageData?.caption || fileData.fileMessageData?.caption || fileData.caption || fileName;
                  mediaType = 'document';
                }

                const direction = 'incoming';

                const chatType = chatId.includes('@g.us') ? 'group' : 'individual';

                let chatName: string;
                if (chatType === 'group') {
                  chatName = payload.senderData?.chatName || `Группа ${rawPhone}`;
                } else {
                  chatName = payload.senderData?.chatName || payload.senderData?.senderName || rawPhone;
                }

                const { data: existingChat } = await supabase
                  .from('whatsapp_chats')
                  .select('id, chat_name')
                  .eq('chat_id', chatId)
                  .eq('organization_id', organizationId)
                  .maybeSingle();

                if (existingChat) {
                  await supabase
                    .from('whatsapp_chats')
                    .update({
                      last_message_at: payload.timestamp ? new Date(payload.timestamp * 1000).toISOString() : new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    })
                    .eq('chat_id', chatId)
                    .eq('organization_id', organizationId);
                } else {
                  await supabase
                    .from('whatsapp_chats')
                    .insert({
                      chat_id: chatId,
                      chat_name: chatName,
                      chat_type: chatType,
                      client_id: clientId,
                      phone: chatType === 'individual' ? rawPhone : null,
                      last_message_at: payload.timestamp ? new Date(payload.timestamp * 1000).toISOString() : new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      organization_id: organizationId
                    });
                }

                const messageInsert: any = {
                  client_id: clientId,
                  message_id: payload.idMessage,
                  direction: 'incoming',
                  content: content || '',
                  sender_name: payload.senderData?.senderName || payload.senderData?.chatName || rawPhone,
                  user_id: null,
                  status: 'delivered',
                  timestamp: payload.timestamp ? new Date(payload.timestamp * 1000).toISOString() : new Date().toISOString(),
                  media_url: mediaUrl,
                  media_type: mediaType,
                  media_filename: mediaType ? (messageData as any)?.documentMessageData?.fileName || (messageData as any)?.fileMessageData?.fileName || null : null,
                  channel_id: payload.instanceData?.idInstance?.toString() || null,
                  chat_id: chatId,
                  chat_name: chatName,
                  chat_type: 'whatsapp',
                  is_read: direction === 'outgoing',
                  organization_id: organizationId
                };

                const { error: insertError } = await supabase
                  .from('whatsapp_messages')
                  .insert(messageInsert);

                if (insertError) {
                  console.error('Error inserting message for new client:', insertError);
                } else {
                  console.log('✓ Message saved for new client');
                }
              }
            }
          }
        }
      }
    } else if (payload.typeWebhook === 'outgoingMessageStatus') {
      console.log('\n>>> Processing outgoing message status');

      if (payload.idMessage && payload.status) {
        const { error: updateError } = await supabase
          .from('whatsapp_messages')
          .update({ status: payload.status })
          .eq('message_id', payload.idMessage);

        if (updateError) {
          console.error('Error updating status:', updateError);
        } else {
          console.log(`✓ Status updated to: ${payload.status}`);
        }
      }
    } else if (payload.typeWebhook === 'stateInstanceChanged') {
      console.log(`\n>>> Instance state changed: ${JSON.stringify(payload)}`);
    }

    console.log('\n=== Webhook processing complete ===\n');

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('\n!!! Webhook error !!!', error);

    await supabase.from('webhook_logs').insert({
      source: 'green-api',
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