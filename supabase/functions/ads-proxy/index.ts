import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GoogleAdsRequest {
  platform: "google";
  credentials: {
    client_id: string;
    client_secret: string;
    refresh_token: string;
    customer_id: string;
    developer_token: string;
  };
  dateRange: string;
}

interface TikTokAdsRequest {
  platform: "tiktok";
  credentials: {
    access_token: string;
    advertiser_id: string;
  };
  dateRange: string;
}

type AdsRequest = GoogleAdsRequest | TikTokAdsRequest;

interface StandardMetrics {
  spend: number;
  clicks: number;
  impressions: number;
  leads: number;
  conversions: number;
  cpl: number;
  ctr: number;
  cpc: number;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    spend: number;
    clicks: number;
    impressions: number;
    conversions: number;
    ctr: number;
    cpc: number;
  }>;
  dailyStats: Array<{
    date: string;
    spend: number;
    clicks: number;
    impressions: number;
    conversions: number;
  }>;
}

function emptyMetrics(): StandardMetrics {
  return {
    spend: 0,
    clicks: 0,
    impressions: 0,
    leads: 0,
    conversions: 0,
    cpl: 0,
    ctr: 0,
    cpc: 0,
    campaigns: [],
    dailyStats: [],
  };
}

function getDateRange(dateRange: string): { startDate: string; endDate: string } {
  const days = dateRange === "7d" ? 7 : dateRange === "14d" ? 14 : dateRange === "90d" ? 90 : 30;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

async function refreshGoogleToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Google token refresh failed:", error);
      return null;
    }

    const data = await response.json();
    return data.access_token || null;
  } catch (e) {
    console.error("Google token refresh error:", e);
    return null;
  }
}

async function fetchGoogleAdsMetrics(
  req: GoogleAdsRequest,
): Promise<{ data?: StandardMetrics; error?: string }> {
  const { credentials, dateRange } = req;
  const { client_id, client_secret, refresh_token, customer_id, developer_token } = credentials;

  if (!client_id || !client_secret || !refresh_token || !customer_id) {
    return { error: "Отсутствуют учетные данные Google Ads" };
  }

  if (!developer_token) {
    return { error: "Отсутствует Developer Token. Укажите его в настройках интеграции Google Ads." };
  }

  const accessToken = await refreshGoogleToken(client_id, client_secret, refresh_token);
  if (!accessToken) {
    return { error: "Не удалось обновить токен доступа Google. Проверьте Client ID, Client Secret и Refresh Token." };
  }

  const cleanCustomerId = customer_id.replace(/-/g, "");
  const { startDate, endDate } = getDateRange(dateRange);

  try {
    const campaignQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
    `;

    const campaignResponse = await fetch(
      `https://googleads.googleapis.com/v18/customers/${cleanCustomerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "developer-token": developer_token,
        },
        body: JSON.stringify({ query: campaignQuery }),
      },
    );

    if (!campaignResponse.ok) {
      const errorText = await campaignResponse.text();
      console.error("Google Ads API error:", campaignResponse.status, errorText);
      let detail = "";
      try {
        const errJson = JSON.parse(errorText);
        detail = errJson?.error?.message || errorText.slice(0, 200);
      } catch { detail = errorText.slice(0, 200); }
      return { error: `Google Ads API ${campaignResponse.status}: ${detail}` };
    }

    const campaignData = await campaignResponse.json();
    const results = campaignData[0]?.results || [];

    const campaigns = results.map((r: any) => ({
      id: r.campaign?.id || "",
      name: r.campaign?.name || "",
      status: r.campaign?.status || "UNKNOWN",
      spend: (r.metrics?.costMicros || 0) / 1_000_000,
      clicks: r.metrics?.clicks || 0,
      impressions: r.metrics?.impressions || 0,
      conversions: r.metrics?.conversions || 0,
      ctr: (r.metrics?.ctr || 0) * 100,
      cpc: (r.metrics?.averageCpc || 0) / 1_000_000,
    }));

    const totalSpend = campaigns.reduce((s: number, c: any) => s + c.spend, 0);
    const totalClicks = campaigns.reduce((s: number, c: any) => s + c.clicks, 0);
    const totalImpressions = campaigns.reduce((s: number, c: any) => s + c.impressions, 0);
    const totalConversions = campaigns.reduce((s: number, c: any) => s + c.conversions, 0);

    const dailyQuery = `
      SELECT
        segments.date,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status != 'REMOVED'
    `;

    let dailyStats: StandardMetrics["dailyStats"] = [];
    try {
      const dailyResponse = await fetch(
        `https://googleads.googleapis.com/v18/customers/${cleanCustomerId}/googleAds:searchStream`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "developer-token": developer_token,
          },
          body: JSON.stringify({ query: dailyQuery }),
        },
      );

      if (dailyResponse.ok) {
        const dailyData = await dailyResponse.json();
        const dailyRows = dailyData[0]?.results || [];
        const dailyMap: Record<string, { spend: number; clicks: number; impressions: number; conversions: number }> = {};

        for (const row of dailyRows) {
          const date = row.segments?.date || "";
          if (!dailyMap[date]) {
            dailyMap[date] = { spend: 0, clicks: 0, impressions: 0, conversions: 0 };
          }
          dailyMap[date].spend += (row.metrics?.costMicros || 0) / 1_000_000;
          dailyMap[date].clicks += row.metrics?.clicks || 0;
          dailyMap[date].impressions += row.metrics?.impressions || 0;
          dailyMap[date].conversions += row.metrics?.conversions || 0;
        }

        dailyStats = Object.entries(dailyMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, d]) => ({ date, ...d }));
      }
    } catch {
      // daily stats are optional
    }

    return {
      data: {
        spend: totalSpend,
        clicks: totalClicks,
        impressions: totalImpressions,
        leads: totalConversions,
        conversions: totalConversions,
        cpl: totalConversions > 0 ? totalSpend / totalConversions : 0,
        ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
        campaigns,
        dailyStats,
      },
    };
  } catch (e) {
    console.error("Google Ads fetch error:", e);
    return { error: `Ошибка при запросе Google Ads: ${e instanceof Error ? e.message : "Unknown"}` };
  }
}

async function fetchTikTokAdsMetrics(
  req: TikTokAdsRequest,
): Promise<{ data?: StandardMetrics; error?: string }> {
  const { credentials, dateRange } = req;
  const { access_token, advertiser_id } = credentials;

  if (!access_token || !advertiser_id) {
    return { error: "Отсутствуют учетные данные TikTok Ads" };
  }

  const { startDate, endDate } = getDateRange(dateRange);

  try {
    const params = new URLSearchParams({
      advertiser_id: advertiser_id,
      report_type: "BASIC",
      data_level: "AUCTION_CAMPAIGN",
      dimensions: '["campaign_id"]',
      metrics:
        '["spend","clicks","impressions","conversion","ctr","cpc","campaign_name"]',
      start_date: startDate,
      end_date: endDate,
    });

    const response = await fetch(
      `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?${params}`,
      {
        headers: { "Access-Token": access_token },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("TikTok Ads API error:", errorText);
      return { error: `Ошибка TikTok Ads API: ${response.status}` };
    }

    const data = await response.json();

    if (data.code !== 0) {
      return { error: data.message || "Ошибка TikTok Ads API" };
    }

    const rows = data.data?.list || [];

    const campaigns = rows.map((row: any) => ({
      id: row.dimensions?.campaign_id || "",
      name: row.metrics?.campaign_name || row.dimensions?.campaign_id || "",
      status: "ACTIVE",
      spend: Number(row.metrics?.spend || 0),
      clicks: Number(row.metrics?.clicks || 0),
      impressions: Number(row.metrics?.impressions || 0),
      conversions: Number(row.metrics?.conversion || 0),
      ctr: Number(row.metrics?.ctr || 0) * 100,
      cpc: Number(row.metrics?.cpc || 0),
    }));

    const totalSpend = campaigns.reduce((s: number, c: any) => s + c.spend, 0);
    const totalClicks = campaigns.reduce((s: number, c: any) => s + c.clicks, 0);
    const totalImpressions = campaigns.reduce(
      (s: number, c: any) => s + c.impressions,
      0,
    );
    const totalConversions = campaigns.reduce(
      (s: number, c: any) => s + c.conversions,
      0,
    );

    const dailyParams = new URLSearchParams({
      advertiser_id: advertiser_id,
      report_type: "BASIC",
      data_level: "AUCTION_ADVERTISER",
      dimensions: '["stat_time_day"]',
      metrics: '["spend","clicks","impressions","conversion"]',
      start_date: startDate,
      end_date: endDate,
    });

    let dailyStats: StandardMetrics["dailyStats"] = [];
    try {
      const dailyResponse = await fetch(
        `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?${dailyParams}`,
        {
          headers: { "Access-Token": access_token },
        },
      );

      if (dailyResponse.ok) {
        const dailyData = await dailyResponse.json();
        if (dailyData.code === 0) {
          dailyStats = (dailyData.data?.list || []).map((row: any) => ({
            date: row.dimensions?.stat_time_day || "",
            spend: Number(row.metrics?.spend || 0),
            clicks: Number(row.metrics?.clicks || 0),
            impressions: Number(row.metrics?.impressions || 0),
            conversions: Number(row.metrics?.conversion || 0),
          }));
        }
      }
    } catch {
      // daily stats optional
    }

    return {
      data: {
        spend: totalSpend,
        clicks: totalClicks,
        impressions: totalImpressions,
        leads: totalConversions,
        conversions: totalConversions,
        cpl: totalConversions > 0 ? totalSpend / totalConversions : 0,
        ctr:
          totalImpressions > 0
            ? (totalClicks / totalImpressions) * 100
            : 0,
        cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
        campaigns,
        dailyStats,
      },
    };
  } catch (e) {
    console.error("TikTok Ads fetch error:", e);
    return {
      error: `Ошибка при запросе TikTok Ads: ${e instanceof Error ? e.message : "Unknown"}`,
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: AdsRequest = await req.json();

    if (!body.platform || !body.credentials) {
      return new Response(
        JSON.stringify({ error: "Missing platform or credentials" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let result: { data?: StandardMetrics; error?: string };

    if (body.platform === "google") {
      result = await fetchGoogleAdsMetrics(body as GoogleAdsRequest);
    } else if (body.platform === "tiktok") {
      result = await fetchTikTokAdsMetrics(body as TikTokAdsRequest);
    } else {
      result = { error: `Unsupported platform: ${body.platform}` };
    }

    if (result.error) {
      return new Response(
        JSON.stringify({ error: result.error, data: emptyMetrics() }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ data: result.data }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("ads-proxy error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Internal server error",
        data: emptyMetrics(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
