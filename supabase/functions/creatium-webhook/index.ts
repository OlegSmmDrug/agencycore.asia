import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", message: "Creatium webhook is working", timestamp: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let rawBody = "";
  let formData: Record<string, any> = {};
  let headersObj: Record<string, string> = {};
  let logResult = "processing";
  let logError: string | null = null;
  let clientId: string | null = null;
  
  try {
    req.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    
    const contentType = req.headers.get("content-type") || "";
    rawBody = await req.text();

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(rawBody);
      params.forEach((value, key) => {
        formData[key] = value;
      });
    } else if (contentType.includes("application/json")) {
      formData = JSON.parse(rawBody);
    } else {
      try {
        formData = JSON.parse(rawBody);
      } catch {
        const params = new URLSearchParams(rawBody);
        params.forEach((value, key) => {
          formData[key] = value;
        });
      }
    }

    const name = formData.name || formData.fio || formData.client_name || "";
    const phone = formData.phone || formData.tel || formData.telephone || "";
    const email = formData.email || formData.mail || "";
    const pageTitle = formData.page_title || "";
    const formType = formData.form_type || "";
    const pageUrl = formData.page_url || "";
    const website = formData.website || formData.site_name || "";

    const utmSource = formData.utm_source || "";
    const utmMedium = formData.utm_medium || "";
    const utmCampaign = formData.utm_campaign || "";
    const utmContent = formData.utm_content || "";
    const utmTerm = formData.utm_term || "";

    const ymclidMetrika = formData.ymclid_metrika || formData.ymclid || "";
    const yclidDirect = formData.yclid_direct || formData.yclid || "";
    const gclid = formData.gclid || "";
    const clientIdGoogle = formData.client_id_google || formData["Client ID by Google"] || "";
    const clientIdYandex = formData.client_id_yandex || formData["Client ID by Yandex"] || "";

    // Get organization_id from query params or form data
    const url = new URL(req.url);
    const organizationId = url.searchParams.get("organization_id") || formData.organization_id || null;

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

    const allFields = Object.entries(formData)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    let technicalDescription = "";
    if (pageTitle) technicalDescription += `Страница: ${pageTitle}\n`;
    if (formType) technicalDescription += `Форма: ${formType}\n`;
    if (pageUrl) technicalDescription += `URL: ${pageUrl}\n`;
    if (website) technicalDescription += `Сайт: ${website}\n`;
    if (utmSource || utmMedium || utmCampaign) {
      technicalDescription += `UTM: ${[utmSource, utmMedium, utmCampaign].filter(Boolean).join(" / ")}\n`;
    }
    technicalDescription += `\n--- Все поля ---\n${allFields}`;

    const clientData = {
      organization_id: finalOrganizationId,
      name: String(name).trim() || "Заявка с сайта",
      company: String(name).trim() || "Заявка с сайта",
      phone: String(phone).trim(),
      email: String(email).trim(),
      status: "New Lead",
      source: "Creatium",
      description: technicalDescription.trim(),
      technical_description: technicalDescription.trim(),
      service: formType || null,
      budget: 0,
      prepayment: 0,
      is_archived: false,
      progress_level: 0,
      contract_status: "draft",
      lead_source_page: pageTitle || null,
      lead_source_form: formType || null,
      lead_source_website: website || null,
      lead_source_url: pageUrl || null,
      utm_source: utmSource || null,
      utm_medium: utmMedium || null,
      utm_campaign: utmCampaign || null,
      utm_content: utmContent || null,
      utm_term: utmTerm || null,
      ymclid_metrika: ymclidMetrika || null,
      yclid_direct: yclidDirect || null,
      gclid: gclid || null,
      client_id_google: clientIdGoogle || null,
      client_id_yandex: clientIdYandex || null
    };

    const { data, error } = await supabase
      .from("clients")
      .insert(clientData)
      .select()
      .single();

    if (error) {
      logResult = "error";
      logError = error.message;
    } else {
      logResult = "success";
      clientId = data.id;
    }
  } catch (err) {
    logResult = "exception";
    logError = String(err);
  }

  try {
    await supabase.from("webhook_logs").insert({
      source: "creatium",
      method: req.method,
      headers: headersObj,
      body: rawBody,
      parsed_data: formData,
      result: logResult,
      error_message: logError
    });
  } catch (logErr) {
    console.error("Failed to write log:", logErr);
  }

  if (logResult === "success") {
    return new Response(
      JSON.stringify({ success: true, lead_id: clientId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } else {
    return new Response(
      JSON.stringify({ success: false, error: logError }),
      { status: logResult === "exception" ? 500 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});