import { Task, TaskStatus, Project, TaskType } from '../types';
import { projectService } from './projectService';
import { serviceMappingService, ContentMetrics } from './serviceMappingService';
import { getLivedunePosts, getLiveduneStories, getLiveduneReels } from './liveduneService';

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

interface LiveduneContentCounts {
  posts: number;
  reels: number;
  stories: number;
}

const getLiveduneContentCounts = async (
  project: Project,
  dateRange?: { start: Date; end: Date }
): Promise<LiveduneContentCounts> => {
  if (!project.liveduneAccessToken || !project.liveduneAccountId) {
    console.log(`[Content Calculation] ${project.name}: No Livedune credentials (token=${!!project.liveduneAccessToken}, accountId=${project.liveduneAccountId})`);
    return { posts: 0, reels: 0, stories: 0 };
  }

  try {
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

    console.log(`[Content Calculation] ${project.name}: Fetching Livedune content with accountId=${config.accountId} for date range: ${dateRangeStr}`);

    const [posts, reels, stories] = await Promise.all([
      getLivedunePosts(config, dateRangeStr),
      getLiveduneReels(config, dateRangeStr),
      getLiveduneStories(config, dateRangeStr)
    ]);

    console.log(`[Content Calculation] Results:`, {
      posts: posts.length,
      reels: reels.length,
      stories: stories.length
    });

    return {
      posts: posts.length,
      reels: reels.length,
      stories: stories.length
    };
  } catch (error) {
    console.error('Error fetching Livedune content counts:', error);
    return { posts: 0, reels: 0, stories: 0 };
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

      const totalCount = Math.max(taskCount, liveduneCount);

      console.log(`[Content Calculation] ${key} (${taskType}): tasks=${taskCount}, livedune=${liveduneCount}, final fact=${totalCount}`);

      result[key] = {
        plan: metric.plan,
        fact: totalCount
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

export const autoCalculateContentForProject = async (
  project: Project,
  tasks: Task[]
): Promise<Project | null> => {
  if (project.contentAutoCalculate === false) {
    return null;
  }

  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);

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
