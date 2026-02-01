import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const getProxyUrl = (supabaseUrl: string) => `${supabaseUrl}/functions/v1/livedune-proxy`;

interface SyncRequest {
  date_from?: string; // YYYY-MM-DD
  date_to?: string;   // YYYY-MM-DD
  project_id?: string; // Sync specific project only
  organization_id?: string; // Sync specific organization only
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: SyncRequest = req.method === "POST" ? await req.json() : {};

    // Default to yesterday's date if not specified
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateFrom = body.date_from || yesterday.toISOString().split('T')[0];
    const dateTo = body.date_to || yesterday.toISOString().split('T')[0];

    console.log(`[LiveDune Sync] Starting sync from ${dateFrom} to ${dateTo}`);

    // Get all projects with LiveDune integration
    let projectsQuery = supabase
      .from('projects')
      .select('id, name, livedune_access_token, livedune_account_id, organization_id')
      .not('livedune_access_token', 'is', null)
      .not('livedune_account_id', 'is', null);

    if (body.project_id) {
      projectsQuery = projectsQuery.eq('id', body.project_id);
    }

    if (body.organization_id) {
      projectsQuery = projectsQuery.eq('organization_id', body.organization_id);
    }

    const { data: projects, error: projectsError } = await projectsQuery;

    if (projectsError) {
      throw new Error(`Failed to fetch projects: ${projectsError.message}`);
    }

    if (!projects || projects.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No projects with LiveDune integration found",
          synced: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[LiveDune Sync] Found ${projects.length} projects to sync`);

    const results = [];

    for (const project of projects) {
      try {
        console.log(`[LiveDune Sync] Syncing project: ${project.name} (${project.id})`);

        const accountId = project.livedune_account_id;
        const accessToken = project.livedune_access_token;
        const proxyUrl = getProxyUrl(supabaseUrl);

        // Fetch posts
        const postsUrl = `${proxyUrl}?endpoint=/accounts/${accountId}/posts&access_token=${encodeURIComponent(accessToken)}&date_from=${dateFrom}&date_to=${dateTo}`;
        console.log(`[LiveDune Sync] Fetching posts from: ${postsUrl}`);
        const postsResponse = await fetch(postsUrl);
        console.log(`[LiveDune Sync] Posts response status: ${postsResponse.status}`);
        const postsText = await postsResponse.text();
        console.log(`[LiveDune Sync] Posts raw response (full): ${postsText}`);
        const postsData = JSON.parse(postsText);
        console.log(`[LiveDune Sync] Posts parsed data structure:`, JSON.stringify(postsData, null, 2));
        const posts = postsData.response || [];
        console.log(`[LiveDune Sync] Found ${posts.length} posts`);
        if (posts.length > 0) {
          console.log(`[LiveDune Sync] First post sample:`, JSON.stringify(posts[0], null, 2));
        }

        // Fetch stories
        const storiesUrl = `${proxyUrl}?endpoint=/accounts/${accountId}/stories&access_token=${encodeURIComponent(accessToken)}&date_from=${dateFrom}&date_to=${dateTo}`;
        console.log(`[LiveDune Sync] Fetching stories from: ${storiesUrl}`);
        const storiesResponse = await fetch(storiesUrl);
        console.log(`[LiveDune Sync] Stories response status: ${storiesResponse.status}`);
        const storiesText = await storiesResponse.text();
        console.log(`[LiveDune Sync] Stories raw response (full): ${storiesText}`);
        const storiesData = JSON.parse(storiesText);
        console.log(`[LiveDune Sync] Stories parsed data structure:`, JSON.stringify(storiesData, null, 2));
        const stories = storiesData.response || [];
        console.log(`[LiveDune Sync] Found ${stories.length} stories`);
        if (stories.length > 0) {
          console.log(`[LiveDune Sync] First story sample:`, JSON.stringify(stories[0], null, 2));
        }

        // Fetch reels
        let reels = [];
        const reelsUrl = `${proxyUrl}?endpoint=/accounts/${accountId}/reels&access_token=${encodeURIComponent(accessToken)}&date_from=${dateFrom}&date_to=${dateTo}`;
        console.log(`[LiveDune Sync] Fetching reels from: ${reelsUrl}`);
        const reelsResponse = await fetch(reelsUrl);
        console.log(`[LiveDune Sync] Reels response status: ${reelsResponse.status}`);

        if (reelsResponse.ok) {
          const reelsText = await reelsResponse.text();
          console.log(`[LiveDune Sync] Reels raw response (full): ${reelsText}`);
          const reelsData = JSON.parse(reelsText);
          console.log(`[LiveDune Sync] Reels parsed data structure:`, JSON.stringify(reelsData, null, 2));
          reels = reelsData.response || [];
          console.log(`[LiveDune Sync] Found ${reels.length} reels`);
          if (reels.length > 0) {
            console.log(`[LiveDune Sync] First reel sample:`, JSON.stringify(reels[0], null, 2));
          }
        }

        // If no reels from dedicated endpoint, try to get them from posts
        if (reels.length === 0) {
          reels = posts.filter((post: any) =>
            ['reels', 'reel'].includes(post.type?.toLowerCase() || '')
          );
        }

        // Filter out reels from posts array
        const actualPosts = posts.filter((post: any) =>
          !['reels', 'reel'].includes(post.type?.toLowerCase() || '')
        );

        console.log(`[LiveDune Sync] Project ${project.name}: ${actualPosts.length} posts, ${stories.length} stories, ${reels.length} reels`);

        // Prepare cache data
        const cacheData = [];

        // Process posts
        for (const post of actualPosts) {
          cacheData.push({
            project_id: project.id,
            account_id: accountId.toString(),
            content_type: 'post',
            content_id: post.post_id || post.id,
            published_date: new Date(post.created || post.date).toISOString().split('T')[0],
            metrics: {
              likes: post.reactions?.likes || 0,
              comments: post.reactions?.comments || 0,
              saved: post.reactions?.saved || 0,
              reach: post.reach?.total || post.reach || 0,
              engagement_rate: post.engagement_rate || post.er || 0,
              type: post.type
            },
            thumbnail_url: null,
            permalink: post.url || '#',
            caption: post.text || '',
            user_id: null,
            task_id: null,
            organization_id: project.organization_id,
            synced_at: new Date().toISOString()
          });
        }

        // Process stories
        for (const story of stories) {
          cacheData.push({
            project_id: project.id,
            account_id: accountId.toString(),
            content_type: 'story',
            content_id: story.story_id || story.id,
            published_date: new Date(story.created || story.date).toISOString().split('T')[0],
            metrics: {
              views: story.views || story.impressions || 0,
              replies: story.replies || 0,
              interactions: story.interactions || story.taps_forward || 0,
              exits: story.exits || story.taps_back || 0,
              reach: story.reach || 0,
              impressions: story.impressions || story.views || 0,
              engagement_rate: story.engagement_rate || 0
            },
            thumbnail_url: null,
            permalink: story.url || '#',
            caption: null,
            user_id: null,
            task_id: null,
            organization_id: project.organization_id,
            synced_at: new Date().toISOString()
          });
        }

        // Process reels
        for (const reel of reels) {
          cacheData.push({
            project_id: project.id,
            account_id: accountId.toString(),
            content_type: 'reels',
            content_id: reel.reel_id || reel.post_id || reel.id,
            published_date: new Date(reel.created || reel.date).toISOString().split('T')[0],
            metrics: {
              views: reel.views || reel.plays || 0,
              likes: reel.reactions?.likes || reel.likes || 0,
              comments: reel.reactions?.comments || reel.comments || 0,
              shares: reel.reactions?.shares || reel.shares || 0,
              saves: reel.reactions?.saved || reel.saves || 0,
              reach: reel.reach?.total || reel.reach || 0,
              plays: reel.plays || reel.views || 0,
              engagement_rate: reel.engagement_rate || reel.er || 0
            },
            thumbnail_url: null,
            permalink: reel.url || '#',
            caption: reel.text || '',
            user_id: null,
            task_id: null,
            organization_id: project.organization_id,
            synced_at: new Date().toISOString()
          });
        }

        if (cacheData.length > 0) {
          const { error: cacheError } = await supabase
            .from('livedune_content_cache')
            .upsert(cacheData, {
              onConflict: 'project_id,content_id,content_type',
              ignoreDuplicates: false
            });

          if (cacheError) {
            console.error(`[LiveDune Sync] Error caching project ${project.name}:`, cacheError);
            results.push({
              project_id: project.id,
              project_name: project.name,
              success: false,
              error: cacheError.message
            });
          } else {
            console.log(`[LiveDune Sync] Successfully cached ${cacheData.length} items for ${project.name}`);

            // Now sync to content_publications
            const { data: syncData, error: syncError } = await supabase
              .rpc('sync_livedune_to_publications', {
                p_project_id: project.id
              });

            results.push({
              project_id: project.id,
              project_name: project.name,
              success: true,
              cached_items: cacheData.length,
              posts: actualPosts.length,
              stories: stories.length,
              reels: reels.length,
              synced_publications: syncData || 0
            });
          }
        } else {
          results.push({
            project_id: project.id,
            project_name: project.name,
            success: true,
            cached_items: 0,
            message: "No new content found for this period"
          });
        }
      } catch (projectError: any) {
        console.error(`[LiveDune Sync] Error syncing project ${project.name}:`, projectError);
        results.push({
          project_id: project.id,
          project_name: project.name,
          success: false,
          error: projectError.message
        });
      }
    }

    const totalSynced = results.reduce((sum, r) => sum + (r.cached_items || 0), 0);

    return new Response(
      JSON.stringify({
        success: true,
        date_from: dateFrom,
        date_to: dateTo,
        projects_processed: projects.length,
        total_items_synced: totalSynced,
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[LiveDune Sync] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
