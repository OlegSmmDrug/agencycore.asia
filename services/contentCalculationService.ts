import { Task, TaskStatus, Project, TaskType } from '../types';
import { projectService } from './projectService';
import { serviceMappingService, ContentMetrics } from './serviceMappingService';

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

    const result: ContentMetrics = {};

    for (const [key, metric] of Object.entries(currentMetrics)) {
      const taskType = getTaskTypeForMetric(key);
      if (!taskType) {
        result[key] = { plan: metric.plan, fact: metric.fact };
        continue;
      }

      const count = projectTasks.filter(t => t.type === taskType).length;
      result[key] = {
        plan: metric.plan,
        fact: count
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
