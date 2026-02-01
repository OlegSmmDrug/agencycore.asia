import { supabase } from '../lib/supabase';
import { Project } from '../types';
import { getLivedunePosts, getLiveduneStories, getLiveduneReels } from './liveduneService';

interface ContentPublication {
  project_id: string;
  assigned_user_id: string;
  content_type: string;
  description: string;
  published_at: string;
  organization_id: string;
}

const findSMMUser = async (project: Project): Promise<string | null> => {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, job_title')
    .eq('organization_id', project.organizationId)
    .or('job_title.ilike.%SMM%,job_title.ilike.%СММ%');

  if (error || !users || users.length === 0) {
    console.warn(`[Auto Sync] No SMM user found for project ${project.name}`);
    return null;
  }

  const teamSMM = users.find(u => project.teamIds.includes(u.id));
  return teamSMM ? teamSMM.id : users[0].id;
};

const normalizeContentType = (type: string): string => {
  const lowerType = type.toLowerCase();
  if (lowerType === 'post' || lowerType === 'posts') return 'Post';
  if (lowerType === 'story' || lowerType === 'stories') return 'Stories ';
  if (lowerType === 'reel' || lowerType === 'reels') return 'Reels Production';
  return type;
};

export const autoSyncContentPublications = async (
  project: Project,
  dateRange?: { start: Date; end: Date }
): Promise<{ synced: number; errors: number }> => {
  if (!project.liveduneAccessToken || !project.liveduneAccountId || !project.organizationId) {
    return { synced: 0, errors: 0 };
  }

  try {
    const smmUserId = await findSMMUser(project);
    if (!smmUserId) {
      console.warn(`[Auto Sync] Skipping ${project.name}: no SMM user`);
      return { synced: 0, errors: 0 };
    }

    const config = {
      accessToken: project.liveduneAccessToken,
      accountId: project.liveduneAccountId
    };

    let dateRangeStr = '30d';
    if (dateRange) {
      const fromStr = dateRange.start.toISOString().split('T')[0];
      const toStr = dateRange.end.toISOString().split('T')[0];
      dateRangeStr = `${fromStr}|${toStr}`;
    }

    const [posts, stories, reels] = await Promise.all([
      getLivedunePosts(config, dateRangeStr),
      getLiveduneStories(config, dateRangeStr),
      getLiveduneReels(config, dateRangeStr)
    ]);

    const publications: ContentPublication[] = [];

    for (const post of posts) {
      if (post.created) {
        publications.push({
          project_id: project.id,
          assigned_user_id: smmUserId,
          content_type: 'Post',
          description: post.text || 'Пост из LiveDune',
          published_at: new Date(post.created).toISOString(),
          organization_id: project.organizationId
        });
      }
    }

    for (const story of stories) {
      if (story.created) {
        publications.push({
          project_id: project.id,
          assigned_user_id: smmUserId,
          content_type: 'Stories ',
          description: 'Сторис из LiveDune',
          published_at: new Date(story.created).toISOString(),
          organization_id: project.organizationId
        });
      }
    }

    for (const reel of reels) {
      if (reel.created) {
        publications.push({
          project_id: project.id,
          assigned_user_id: smmUserId,
          content_type: 'Reels Production',
          description: reel.text || 'Reels из LiveDune',
          published_at: new Date(reel.created).toISOString(),
          organization_id: project.organizationId
        });
      }
    }

    if (publications.length === 0) {
      return { synced: 0, errors: 0 };
    }

    let synced = 0;
    let errors = 0;

    for (const pub of publications) {
      const { data: existing } = await supabase
        .from('content_publications')
        .select('id')
        .eq('project_id', pub.project_id)
        .eq('assigned_user_id', pub.assigned_user_id)
        .eq('content_type', pub.content_type)
        .eq('published_at', pub.published_at)
        .maybeSingle();

      if (existing) {
        continue;
      }

      const { error } = await supabase
        .from('content_publications')
        .insert([pub]);

      if (error) {
        console.error(`[Auto Sync] Error inserting publication:`, error);
        errors++;
      } else {
        synced++;
      }
    }

    console.log(`[Auto Sync] ${project.name}: synced ${synced} publications, ${errors} errors`);
    return { synced, errors };
  } catch (error) {
    console.error(`[Auto Sync] Error syncing ${project.name}:`, error);
    return { synced: 0, errors: 1 };
  }
};
