import { supabase } from '../lib/supabase';
import { contentPublicationService } from './contentPublicationService';

interface LiveduneCacheItem {
  id: string;
  project_id: string;
  account_id: string;
  content_type: 'post' | 'story' | 'reels';
  content_id: string;
  published_date: string;
  user_id: string | null;
  organization_id: string;
  synced_at: string;
}

const mapContentType = (liveduneType: string): string => {
  switch (liveduneType) {
    case 'post':
      return 'Post';
    case 'story':
      return 'Stories';
    case 'reels':
      return 'Reels';
    default:
      return liveduneType;
  }
};

export const liveduneContentSyncService = {
  async syncProjectContent(projectId: string): Promise<{ synced: number; skipped: number; error?: string }> {
    console.log(`[LiveDune Sync] Starting sync for project ${projectId}`);

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, team_ids, organization_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('[LiveDune Sync] Project not found:', projectError);
      return { synced: 0, skipped: 0, error: 'Project not found' };
    }

    const { data: cachedContent, error: cacheError } = await supabase
      .from('livedune_content_cache')
      .select('*')
      .eq('project_id', projectId)
      .eq('organization_id', project.organization_id)
      .order('published_date', { ascending: true });

    if (cacheError) {
      console.error('[LiveDune Sync] Error fetching cached content:', cacheError);
      return { synced: 0, skipped: 0, error: cacheError.message };
    }

    if (!cachedContent || cachedContent.length === 0) {
      console.log('[LiveDune Sync] No cached content found');
      return { synced: 0, skipped: 0 };
    }

    console.log(`[LiveDune Sync] Found ${cachedContent.length} cached items`);

    const { data: existingPublications, error: pubError } = await supabase
      .from('content_publications')
      .select('id')
      .eq('project_id', projectId);

    const existingCount = existingPublications?.length || 0;

    if (existingCount > 0) {
      console.log(`[LiveDune Sync] Project already has ${existingCount} publications, skipping sync`);
      return { synced: 0, skipped: cachedContent.length };
    }

    let synced = 0;
    let skipped = 0;

    const smmMembers = await this.getSMMTeamMembers(project.team_ids || []);

    if (smmMembers.length === 0) {
      console.warn('[LiveDune Sync] No SMM members in project team, publications will have no assigned user');
    }

    for (const item of cachedContent as LiveduneCacheItem[]) {
      let assignedUserId = item.user_id;

      if (!assignedUserId && smmMembers.length > 0) {
        assignedUserId = smmMembers[synced % smmMembers.length].id;
      }

      if (!assignedUserId) {
        console.warn(`[LiveDune Sync] Skipping item ${item.content_id}: no user to assign`);
        skipped++;
        continue;
      }

      const success = await contentPublicationService.create({
        projectId: item.project_id,
        contentType: mapContentType(item.content_type),
        publishedAt: new Date(item.published_date).toISOString(),
        assignedUserId: assignedUserId,
        organizationId: item.organization_id,
        description: `Synced from LiveDune (${item.content_id})`
      });

      if (success) {
        synced++;
      } else {
        skipped++;
      }
    }

    console.log(`[LiveDune Sync] Completed: ${synced} synced, ${skipped} skipped`);
    return { synced, skipped };
  },

  async syncAllProjects(organizationId: string): Promise<{ total: number; synced: number; skipped: number }> {
    console.log(`[LiveDune Sync] Starting sync for all projects in organization ${organizationId}`);

    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, name')
      .eq('organization_id', organizationId);

    if (error || !projects) {
      console.error('[LiveDune Sync] Error fetching projects:', error);
      return { total: 0, synced: 0, skipped: 0 };
    }

    let totalSynced = 0;
    let totalSkipped = 0;

    for (const project of projects) {
      const result = await this.syncProjectContent(project.id);
      totalSynced += result.synced;
      totalSkipped += result.skipped;
    }

    console.log(`[LiveDune Sync] Organization sync completed: ${totalSynced} synced, ${totalSkipped} skipped from ${projects.length} projects`);
    return { total: projects.length, synced: totalSynced, skipped: totalSkipped };
  },

  async syncMonthRange(
    projectId: string,
    month: string
  ): Promise<{ synced: number; skipped: number }> {
    console.log(`[LiveDune Sync] Syncing month ${month} for project ${projectId}`);

    const monthStart = new Date(month + '-01');
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, team_ids, organization_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('[LiveDune Sync] Project not found:', projectError);
      return { synced: 0, skipped: 0 };
    }

    const { data: cachedContent, error: cacheError } = await supabase
      .from('livedune_content_cache')
      .select('*')
      .eq('project_id', projectId)
      .gte('published_date', monthStart.toISOString().split('T')[0])
      .lte('published_date', monthEnd.toISOString().split('T')[0]);

    if (cacheError || !cachedContent || cachedContent.length === 0) {
      console.log('[LiveDune Sync] No cached content for this month');
      return { synced: 0, skipped: 0 };
    }

    const smmMembers = await this.getSMMTeamMembers(project.team_ids || []);
    let synced = 0;
    let skipped = 0;

    for (const item of cachedContent as LiveduneCacheItem[]) {
      const { data: existing } = await supabase
        .from('content_publications')
        .select('id')
        .eq('project_id', item.project_id)
        .eq('content_type', mapContentType(item.content_type))
        .eq('published_at', new Date(item.published_date).toISOString())
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      let assignedUserId = item.user_id;
      if (!assignedUserId && smmMembers.length > 0) {
        assignedUserId = smmMembers[synced % smmMembers.length].id;
      }

      if (!assignedUserId) {
        skipped++;
        continue;
      }

      const success = await contentPublicationService.create({
        projectId: item.project_id,
        contentType: mapContentType(item.content_type),
        publishedAt: new Date(item.published_date).toISOString(),
        assignedUserId: assignedUserId,
        organizationId: item.organization_id,
        description: `Synced from LiveDune (${item.content_id})`
      });

      if (success) {
        synced++;
      } else {
        skipped++;
      }
    }

    return { synced, skipped };
  },

  async getSMMTeamMembers(teamIds: string[]): Promise<Array<{ id: string; name: string; jobTitle: string }>> {
    if (!teamIds || teamIds.length === 0) return [];

    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, job_title')
      .in('id', teamIds);

    if (error) {
      console.error('[LiveDune Sync] Error fetching team members:', error);
      return [];
    }

    const smmMembers = (users || []).filter(u => {
      const title = (u.job_title || '').toLowerCase();
      return title.includes('smm') || title.includes('контент');
    }).map(u => ({
      id: u.id,
      name: u.name,
      jobTitle: u.job_title || ''
    }));

    if (smmMembers.length > 0) {
      return smmMembers;
    }

    return (users || []).map(u => ({
      id: u.id,
      name: u.name,
      jobTitle: u.job_title || ''
    }));
  },

  async assignUserToPublication(publicationId: string, userId: string): Promise<boolean> {
    return await contentPublicationService.update(publicationId, { assignedUserId: userId });
  },

  async getUnassignedPublications(projectId: string): Promise<number> {
    const { count, error } = await supabase
      .from('content_publications')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .is('assigned_user_id', null);

    if (error) {
      console.error('[LiveDune Sync] Error counting unassigned:', error);
      return 0;
    }

    return count || 0;
  },

  async fetchAndSyncMonthFromLiveDune(
    projectId: string,
    month: string,
    liveduneAccessToken: string,
    liveduneAccountId: number
  ): Promise<{ synced: number; skipped: number; error?: string }> {
    console.log(`[LiveDune API Sync] Fetching content from LiveDune API for ${month}`);

    const monthStart = new Date(month + '-01');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (monthStart > today) {
      console.log(`[LiveDune API Sync] Month ${month} is in the future, skipping`);
      return { synced: 0, skipped: 0 };
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, team_ids, organization_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return { synced: 0, skipped: 0, error: 'Project not found' };
    }

    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

    const dateFrom = monthStart.toISOString().split('T')[0];
    const dateTo = monthEnd.toISOString().split('T')[0];

    const LIVEDUNE_PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/livedune-proxy`;
    const headers = {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };

    let synced = 0;
    let skipped = 0;
    let userRotationIndex = 0;

    const smmMembers = await this.getSMMTeamMembers(project.team_ids || []);

    if (smmMembers.length === 0) {
      console.warn('[LiveDune API Sync] No team members found, publications will be created without assigned user');
    } else {
      console.log(`[LiveDune API Sync] Found ${smmMembers.length} team members:`, smmMembers.map(m => m.name));
    }

    try {
      const postsUrl = `${LIVEDUNE_PROXY_URL}?endpoint=/accounts/${liveduneAccountId}/posts&access_token=${encodeURIComponent(liveduneAccessToken)}&date_from=${dateFrom}&date_to=${dateTo}`;
      console.log(`[LiveDune API Sync] Fetching posts from ${dateFrom} to ${dateTo}`);
      const postsResponse = await fetch(postsUrl, { headers });

      if (!postsResponse.ok) {
        console.error(`[LiveDune API Sync] Posts API returned ${postsResponse.status}`);
      }

      if (postsResponse.ok) {
        const postsData = await postsResponse.json();

        if (postsData.error) {
          console.error(`[LiveDune API Sync] Posts API error:`, postsData.error);
        }
        const posts = postsData.response || [];
        console.log(`[LiveDune API Sync] Fetched ${posts.length} posts from API`);

        if (posts.length > 0) {
          console.log(`[LiveDune API Sync] Sample post:`, posts[0]);
        }

        for (const post of posts) {
          const publishedAt = new Date(post.created || post.date).toISOString();

          const { data: existing } = await supabase
            .from('content_publications')
            .select('id')
            .eq('project_id', projectId)
            .eq('content_type', 'Post')
            .eq('published_at', publishedAt)
            .maybeSingle();

          if (existing) {
            skipped++;
            continue;
          }

          const assignedUserId = smmMembers.length > 0 ? smmMembers[userRotationIndex % smmMembers.length].id : null;
          userRotationIndex++;

          const result = await contentPublicationService.create({
            projectId,
            contentType: 'Post',
            publishedAt,
            assignedUserId,
            organizationId: project.organization_id,
            description: `From LiveDune API (${post.post_id || post.id})`
          });

          if (result) {
            console.log(`[LiveDune API Sync] Created Post publication for ${publishedAt}`);
            synced++;
          } else {
            console.error(`[LiveDune API Sync] Failed to create Post publication for ${publishedAt}`);
            skipped++;
          }
        }
      }

      const storiesUrl = `${LIVEDUNE_PROXY_URL}?endpoint=/accounts/${liveduneAccountId}/stories&access_token=${encodeURIComponent(liveduneAccessToken)}&date_from=${dateFrom}&date_to=${dateTo}`;
      console.log(`[LiveDune API Sync] Fetching stories from ${dateFrom} to ${dateTo}`);
      const storiesResponse = await fetch(storiesUrl, { headers });

      if (!storiesResponse.ok) {
        console.error(`[LiveDune API Sync] Stories API returned ${storiesResponse.status}`);
      }

      if (storiesResponse.ok) {
        const storiesData = await storiesResponse.json();

        if (storiesData.error) {
          console.error(`[LiveDune API Sync] Stories API error:`, storiesData.error);
        }
        const stories = storiesData.response || [];
        console.log(`[LiveDune API Sync] Fetched ${stories.length} stories from API`);

        if (stories.length > 0) {
          console.log(`[LiveDune API Sync] Sample story:`, stories[0]);
        }

        for (const story of stories) {
          const publishedAt = new Date(story.created || story.date).toISOString();

          const { data: existing } = await supabase
            .from('content_publications')
            .select('id')
            .eq('project_id', projectId)
            .eq('content_type', 'Stories')
            .eq('published_at', publishedAt)
            .maybeSingle();

          if (existing) {
            skipped++;
            continue;
          }

          const assignedUserId = smmMembers.length > 0 ? smmMembers[userRotationIndex % smmMembers.length].id : null;
          userRotationIndex++;

          const result = await contentPublicationService.create({
            projectId,
            contentType: 'Stories',
            publishedAt,
            assignedUserId,
            organizationId: project.organization_id,
            description: `From LiveDune API (${story.story_id || story.id})`
          });

          if (result) {
            console.log(`[LiveDune API Sync] Created Stories publication for ${publishedAt}`);
            synced++;
          } else {
            console.error(`[LiveDune API Sync] Failed to create Stories publication for ${publishedAt}`);
            skipped++;
          }
        }
      }

      const reelsUrl = `${LIVEDUNE_PROXY_URL}?endpoint=/accounts/${liveduneAccountId}/reels&access_token=${encodeURIComponent(liveduneAccessToken)}&date_from=${dateFrom}&date_to=${dateTo}`;
      console.log(`[LiveDune API Sync] Fetching reels from ${dateFrom} to ${dateTo}`);
      const reelsResponse = await fetch(reelsUrl, { headers });

      if (!reelsResponse.ok) {
        console.error(`[LiveDune API Sync] Reels API returned ${reelsResponse.status}`);
      }

      if (reelsResponse.ok) {
        const reelsData = await reelsResponse.json();

        if (reelsData.error) {
          console.error(`[LiveDune API Sync] Reels API error:`, reelsData.error);
        }
        const reels = reelsData.response || [];
        console.log(`[LiveDune API Sync] Fetched ${reels.length} reels from API`);

        if (reels.length > 0) {
          console.log(`[LiveDune API Sync] Sample reel:`, reels[0]);
        }

        for (const reel of reels) {
          const publishedAt = new Date(reel.created || reel.date).toISOString();

          const { data: existing } = await supabase
            .from('content_publications')
            .select('id')
            .eq('project_id', projectId)
            .eq('content_type', 'Reels')
            .eq('published_at', publishedAt)
            .maybeSingle();

          if (existing) {
            skipped++;
            continue;
          }

          const assignedUserId = smmMembers.length > 0 ? smmMembers[userRotationIndex % smmMembers.length].id : null;
          userRotationIndex++;

          const result = await contentPublicationService.create({
            projectId,
            contentType: 'Reels',
            publishedAt,
            assignedUserId,
            organizationId: project.organization_id,
            description: `From LiveDune API (${reel.reel_id || reel.id})`
          });

          if (result) {
            console.log(`[LiveDune API Sync] Created Reels publication for ${publishedAt}`);
            synced++;
          } else {
            console.error(`[LiveDune API Sync] Failed to create Reels publication for ${publishedAt}`);
            skipped++;
          }
        }
      }

      console.log(`[LiveDune API Sync] Completed: ${synced} synced, ${skipped} skipped`);
      return { synced, skipped };

    } catch (error) {
      console.error('[LiveDune API Sync] Error:', error);
      return { synced, skipped, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};
