import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LIVEDUNE_API_URL = 'https://api.livedune.com';

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint') || '/accounts';
    const accessToken = url.searchParams.get('access_token');
    const accountId = url.searchParams.get('account_id');
    const dateFrom = url.searchParams.get('date_from');
    const dateTo = url.searchParams.get('date_to');

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'access_token is required' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const liveduneUrl = new URL(endpoint, LIVEDUNE_API_URL);
    liveduneUrl.searchParams.set('access_token', accessToken);

    if (accountId) {
      liveduneUrl.searchParams.set('id', accountId);
    }
    if (dateFrom) {
      liveduneUrl.searchParams.set('date_from', dateFrom);
    }
    if (dateTo) {
      liveduneUrl.searchParams.set('date_to', dateTo);
    }

    console.log('Proxying request to Livedune:', liveduneUrl.toString());

    const response = await fetch(liveduneUrl.toString());
    const data = await response.json();

    console.log('Livedune response status:', response.status);
    console.log('Livedune response data:', data);

    return new Response(
      JSON.stringify(data),
      {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error proxying to Livedune:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});