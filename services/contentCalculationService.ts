import { Task, TaskStatus, Project, TaskType } from '../types';
import { projectService } from './projectService';
import { serviceMappingService, ContentMetrics } from './serviceMappingService';
import { getLivedunePosts, getLiveduneStories, getLiveduneReels } from './liveduneService';
import { autoSyncContentPublications } from './autoContentPublicationService';

interface ContentFacts {
  postsFact: number;
  reelsFact: number;
  storiesFact: number;
}

const getTaskTypeForMetric = (metricKey: string): TaskType | null => {
  const key = metricKey.toLowerCase();

  if (key.includes('post') || key.includes('посты') || key.includes('пост')) {
    return 'Post';
  }
  if (key.includes('reel') || key.includes('рилс')) {
    return 'Reels';
  }
  if (key.includes('stor') || key.includes('стори')) {
    return 'Stories';
  }

  return null;
};

export interface LiveduneContentCounts {
  posts: number;
  reels: number;
  stories: number;
  hasError?: boolean;
}

export const getLiveduneContentCounts = async (
  project: Project,
  dateRange?: { start: Date; end: Date }
): Promise<LiveduneContentCounts> => {
  try {
    // Попытка 1: Получить данные из локального кеша (content_publications)
    const { supabase } = await import('../lib/supabase');

    let query = supabase
      .from('content_publications')
      .select('content_type')
      .eq('project_id', project.id);

    if (dateRange) {
      query = query
        .gte('published_at', dateRange.start.toISOString())
        .lte('published_at', dateRange.end.toISOString());
    }

    const { data: publications, error: dbError } = await query;

    if (!dbError && publications && publications.length > 0) {
      const posts = publications.filter(p => p.content_type.toLowerCase() === 'post').length;
      const reels = publications.filter(p => p.content_type.toLowerCase() === 'reels' || p.content_type.toLowerCase() === 'reel').length;
      const stories = publications.filter(p => p.content_type.toLowerCase() === 'story' || p.content_type.toLowerCase() === 'stories').length;

      console.log(`[Content Calculation] ${project.name}: Using content_publications data:`, {
        posts,
        reels,
        stories
      });

      return { posts, reels, stories, hasError: false };
    }

    // Попытка 2: Получить данные из livedune_content_cache
    const { data: cachedContent, error: cacheError } = await supabase
      .from('livedune_content_cache')
      .select('content_type')
      .eq('project_id', project.id);

    if (!cacheError && cachedContent && cachedContent.length > 0) {
      let filteredCache = cachedContent;

      if (dateRange) {
        const { data: dateFiltered } = await supabase
          .from('livedune_content_cache')
          .select('content_type')
          .eq('project_id', project.id)
          .gte('published_date', dateRange.start.toISOString().split('T')[0])
          .lte('published_date', dateRange.end.toISOString().split('T')[0]);

        if (dateFiltered) filteredCache = dateFiltered;
      }

      const posts = filteredCache.filter(p => p.content_type === 'post').length;
      const reels = filteredCache.filter(p => p.content_type === 'reels').length;
      const stories = filteredCache.filter(p => p.content_type === 'story').length;

      console.log(`[Content Calculation] ${project.name}: Using livedune_content_cache data:`, {
        posts,
        reels,
        stories
      });

      return { posts, reels, stories, hasError: false };
    }

    // Попытка 3: Обратиться к API Livedune (только если есть токен)
    if (!project.liveduneAccessToken || !project.liveduneAccountId) {
      console.log(`[Content Calculation] ${project.name}: No Livedune credentials and no cached data`);
      return { posts: 0, reels: 0, stories: 0, hasError: false };
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

    console.log(`[Content Calculation] ${project.name}: Fetching from Livedune API with accountId=${config.accountId} for date range: ${dateRangeStr}`);

    const [posts, reels, stories] = await Promise.all([
      getLivedunePosts(config, dateRangeStr),
      getLiveduneReels(config, dateRangeStr),
      getLiveduneStories(config, dateRangeStr)
    ]);

    console.log(`[Content Calculation] ${project.name} (accountId=${config.accountId}) API Results:`, {
      posts: posts.length,
      reels: reels.length,
      stories: stories.length
    });

    // Данные из API используются только для подсчета
    // Сохранение происходит через forceSyncLiveduneContent()
    return {
      posts: posts.length,
      reels: reels.length,
      stories: stories.length,
      hasError: false
    };
  } catch (error) {
    console.error(`[Content Calculation] ${project.name}: Error in getLiveduneContentCounts:`, error);
    return { posts: 0, reels: 0, stories: 0, hasError: true };
  }
};

export const calculateDynamicContentFacts = async (
  project: Project,
  tasks: Task[],
  dateRange?: { start: Date; end: Date }
): Promise<ContentMetrics> => {
  try {
    const currentMetrics = project.contentMetrics || {};
    if (Object.keys(currentMetrics).length === 0) {
      return {};
    }

    let projectTasks = tasks.filter(t => t.projectId === project.id && t.status === TaskStatus.DONE);

    if (dateRange) {
      projectTasks = projectTasks.filter(t => {
        if (!t.deadline) return false;
        const taskDate = new Date(t.deadline);
        return taskDate >= dateRange.start && taskDate <= dateRange.end;
      });
    }

    const liveduneCounts = await getLiveduneContentCounts(project, dateRange);

    console.log(`[Content Calculation] Processing metrics for project ${project.name}:`, currentMetrics);

    if (liveduneCounts.hasError) {
      console.warn(`[Content Calculation] ${project.name}: LiveDune error detected. Preserving manual data.`);
    } else if (liveduneCounts.posts > 0 || liveduneCounts.reels > 0 || liveduneCounts.stories > 0) {
      autoSyncContentPublications(project, dateRange).catch(err =>
        console.error(`[Content Calculation] Auto-sync failed for ${project.name}:`, err)
      );
    }

    const result: ContentMetrics = {};

    for (const [key, metric] of Object.entries(currentMetrics)) {
      const taskType = getTaskTypeForMetric(key);
      if (!taskType) {
        result[key] = { plan: metric.plan, fact: metric.fact };
        console.log(`[Content Calculation] ${key}: No task type mapping, keeping fact=${metric.fact}`);
        continue;
      }

      const taskCount = projectTasks.filter(t => t.type === taskType).length;

      let liveduneCount = 0;
      if (taskType === 'Post') {
        liveduneCount = liveduneCounts.posts;
      } else if (taskType === 'Reels') {
        liveduneCount = liveduneCounts.reels;
      } else if (taskType === 'Stories') {
        liveduneCount = liveduneCounts.stories;
      }

      let finalCount: number;
      if (liveduneCounts.hasError) {
        finalCount = Math.max(taskCount, metric.fact || 0);
        console.log(`[Content Calculation] ${key} (${taskType}): LiveDune error, using tasks=${taskCount} or manual=${metric.fact}, final fact=${finalCount}`);
      } else {
        finalCount = Math.max(taskCount, liveduneCount);
        console.log(`[Content Calculation] ${key} (${taskType}): tasks=${taskCount}, livedune=${liveduneCount}, final fact=${finalCount}`);
      }

      result[key] = {
        plan: metric.plan,
        fact: finalCount
      };
    }

    return result;
  } catch (error) {
    console.error('Error calculating dynamic content facts:', error);
    return {};
  }
};

export const calculateContentFacts = (
  projectId: string,
  tasks: Task[],
  dateRange?: { start: Date; end: Date }
): ContentFacts => {
  let projectTasks = tasks.filter(t => t.projectId === projectId && t.status === TaskStatus.DONE);

  if (dateRange) {
    projectTasks = projectTasks.filter(t => {
      if (!t.deadline) return false;
      const taskDate = new Date(t.deadline);
      return taskDate >= dateRange.start && taskDate <= dateRange.end;
    });
  }

  const postsFact = projectTasks.filter(t => t.type === 'content_post').length;
  const reelsFact = projectTasks.filter(t => t.type === 'content_reel').length;
  const storiesFact = projectTasks.filter(t => t.type === 'content_story').length;

  return { postsFact, reelsFact, storiesFact };
};

export const updateProjectContentFacts = async (
  projectId: string,
  facts: ContentFacts
): Promise<Project | null> => {
  try {
    const updated = await projectService.update(projectId, {
      postsFact: facts.postsFact,
      reelsFact: facts.reelsFact,
      storiesFact: facts.storiesFact,
      contentLastCalculatedAt: new Date().toISOString()
    });
    return updated;
  } catch (error) {
    console.error('Error in updateProjectContentFacts:', error);
    return null;
  }
};

export const updateProjectDynamicContentFacts = async (
  project: Project,
  newFacts: ContentMetrics
): Promise<Project | null> => {
  try {
    const currentMetrics = project.contentMetrics || {};
    const updatedMetrics: ContentMetrics = { ...currentMetrics };

    for (const key in newFacts) {
      if (updatedMetrics[key]) {
        updatedMetrics[key].fact = newFacts[key].fact;
      } else {
        updatedMetrics[key] = newFacts[key];
      }
    }

    const updated = await projectService.update(project.id, {
      contentMetrics: updatedMetrics,
      contentLastCalculatedAt: new Date().toISOString()
    });
    return updated;
  } catch (error) {
    console.error('Error in updateProjectDynamicContentFacts:', error);
    return null;
  }
};

export const forceSyncLiveduneContent = async (
  project: Project,
  daysBack: number = 30
): Promise<boolean> => {
  try {
    if (!project.liveduneAccessToken || !project.liveduneAccountId) {
      console.log(`[forceSyncLiveduneContent] ${project.name}: No Livedune credentials`);
      return false;
    }

    const config = {
      accessToken: project.liveduneAccessToken,
      accountId: project.liveduneAccountId
    };

    console.log(`[forceSyncLiveduneContent] ${project.name}: Fetching data from Livedune API for last ${daysBack} days`);

    // Загружаем данные из API
    const [posts, reels, stories] = await Promise.all([
      getLivedunePosts(config, `${daysBack}d`),
      getLiveduneReels(config, `${daysBack}d`),
      getLiveduneStories(config, `${daysBack}d`)
    ]);

    console.log(`[forceSyncLiveduneContent] ${project.name}: API returned ${posts.length} posts, ${reels.length} reels, ${stories.length} stories`);

    // Очищаем старые данные
    const { supabase } = await import('../lib/supabase');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    await supabase
      .from('content_publications')
      .delete()
      .eq('project_id', project.id)
      .gte('published_at', cutoffDate.toISOString());

    console.log(`[forceSyncLiveduneContent] ${project.name}: Cleared old publications`);

    // Вставляем новые данные
    const publicationsToInsert: any[] = [];

    posts.forEach(post => {
      publicationsToInsert.push({
        project_id: project.id,
        organization_id: project.organizationId,
        content_type: 'post',
        published_at: post.created || new Date().toISOString(),
        description: `Synced from Livedune: ${post.text?.substring(0, 100) || ''}`
      });
    });

    reels.forEach(reel => {
      publicationsToInsert.push({
        project_id: project.id,
        organization_id: project.organizationId,
        content_type: 'reels',
        published_at: reel.created || new Date().toISOString(),
        description: `Synced from Livedune: ${reel.text?.substring(0, 100) || ''}`
      });
    });

    stories.forEach(story => {
      publicationsToInsert.push({
        project_id: project.id,
        organization_id: project.organizationId,
        content_type: 'story',
        published_at: story.created || new Date().toISOString(),
        description: 'Synced from Livedune'
      });
    });

    if (publicationsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('content_publications')
        .insert(publicationsToInsert);

      if (insertError) {
        console.error(`[forceSyncLiveduneContent] ${project.name}: Error inserting:`, insertError);
        return false;
      }

      console.log(`[forceSyncLiveduneContent] ${project.name}: Successfully synced ${publicationsToInsert.length} publications`);
    }

    return true;
  } catch (error) {
    console.error(`[forceSyncLiveduneContent] Error:`, error);
    return false;
  }
};

export const autoCalculateContentForProject = async (
  project: Project,
  tasks: Task[],
  daysBack: number = 30,
  forceSync: boolean = false
): Promise<Project | null> => {
  if (project.contentAutoCalculate === false && !forceSync) {
    return null;
  }

  // Принудительная синхронизация из Livedune
  if (forceSync && project.liveduneAccessToken) {
    console.log(`[autoCalculateContentForProject] ${project.name}: Force syncing from Livedune`);
    await forceSyncLiveduneContent(project, daysBack);
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // Последние N дней (но не раньше start_date проекта)
  const calculatedStartDate = new Date(today);
  calculatedStartDate.setDate(calculatedStartDate.getDate() - daysBack);
  calculatedStartDate.setHours(0, 0, 0, 0);

  const projectStartDate = new Date(project.startDate);
  const startDate = calculatedStartDate > projectStartDate ? calculatedStartDate : projectStartDate;

  const projectEndDate = new Date(project.endDate);
  const endDate = projectEndDate > today ? today : projectEndDate;

  console.log(`[autoCalculateContentForProject] ${project.name}: Calculating content for last ${daysBack} days (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})`);

  const dynamicFacts = await calculateDynamicContentFacts(project, tasks, { start: startDate, end: endDate });

  if (Object.keys(dynamicFacts).length > 0) {
    return await updateProjectDynamicContentFacts(project, dynamicFacts);
  }

  const legacyFacts = calculateContentFacts(project.id, tasks, { start: startDate, end: endDate });
  return await updateProjectContentFacts(project.id, legacyFacts);
};

export const getContentTasksBreakdown = (
  projectId: string,
  tasks: Task[]
): {
  posts: Task[];
  reels: Task[];
  stories: Task[];
  completedPosts: Task[];
  completedReels: Task[];
  completedStories: Task[];
} => {
  const projectTasks = tasks.filter(t => t.projectId === projectId);

  const posts = projectTasks.filter(t => t.type === 'Post');
  const reels = projectTasks.filter(t => t.type === 'Reels');
  const stories = projectTasks.filter(t => t.type === 'Stories');

  const completedPosts = posts.filter(t => t.status === TaskStatus.DONE);
  const completedReels = reels.filter(t => t.status === TaskStatus.DONE);
  const completedStories = stories.filter(t => t.status === TaskStatus.DONE);

  return {
    posts,
    reels,
    stories,
    completedPosts,
    completedReels,
    completedStories
  };
};

export const shouldCalculateContent = (project: Project): boolean => {
  if (project.contentAutoCalculate === false) {
    return false;
  }

  if (!project.contentLastCalculatedAt) {
    return true;
  }

  const lastCalc = new Date(project.contentLastCalculatedAt);
  const now = new Date();
  const minutesSinceCalc = (now.getTime() - lastCalc.getTime()) / (1000 * 60);

  return minutesSinceCalc >= 5;
};
