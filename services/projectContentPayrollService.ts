import { User, Project, SalaryScheme } from '../types';
import { ContentMetrics } from './serviceMappingService';
import { supabase } from '../lib/supabase';
import { autoSyncContentPublications } from './autoContentPublicationService';

interface ContentPayrollDetail {
  projectId: string;
  projectName: string;
  contentType: string;
  quantity: number;
  rate: number;
  total: number;
  sharePercentage: number;
}

interface ProjectContentPayroll {
  totalEarnings: number;
  details: ContentPayrollDetail[];
}

interface CachedUser {
  id: string;
  jobTitle: string;
  name: string;
}

let usersCache: CachedUser[] | null = null;

const getUsersByIds = async (userIds: string[]): Promise<CachedUser[]> => {
  if (!usersCache) {
    const { data, error } = await supabase
      .from('users')
      .select('id, job_title, name');

    if (error) {
      console.error('[Project Content Payroll] Error fetching users:', error);
      return [];
    }

    usersCache = (data || []).map(u => ({
      id: u.id,
      jobTitle: u.job_title || '',
      name: u.name
    }));
  }

  return usersCache.filter(u => userIds.includes(u.id));
};

const normalizeContentType = (metricKey: string): string => {
  const key = metricKey.toLowerCase();

  if (key.includes('post') || key === 'posts') return 'Post';
  if (key.includes('reel')) return 'Reels Production';
  if (key.includes('stor') || key === 'stories_') return 'Stories ';
  if (key.includes('сложный') || key.includes('visual')) return 'Сложный визуал';
  if (key.includes('дублир')) return 'Дублирование контента в другую соц сеть';
  if (key.includes('монитор')) return 'Мониторинг сообщества';
  if (key.includes('ведение') && key.includes('язык')) return 'Ведение на 2 языках';
  if (key.includes('карусель')) return 'Карусель';

  return metricKey;
};

const isSMMRole = (jobTitle: string): boolean => {
  const title = jobTitle.toLowerCase();
  return title.includes('smm') || title.includes('контент');
};

export const calculateProjectContentPayroll = async (
  user: User,
  projects: Project[],
  salarySchemes: SalaryScheme[],
  month: string
): Promise<ProjectContentPayroll> => {
  console.log(`[Project Content Payroll] === Calculating for ${user.name} (${user.jobTitle}) - Month: ${month} ===`);

  const monthStart = new Date(month + '-01');
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);

  const userScheme = salarySchemes.find(
    s => s.targetType === 'user' && s.targetId === user.id
  );
  const jobTitleScheme = salarySchemes.find(
    s => s.targetType === 'jobTitle' && s.targetId === user.jobTitle
  );
  const scheme = userScheme || jobTitleScheme;

  if (!scheme || !scheme.kpiRules || scheme.kpiRules.length === 0) {
    console.log(`[Project Content Payroll] No salary scheme or KPI rules found for ${user.name}`);
    return { totalEarnings: 0, details: [] };
  }

  console.log(`[Project Content Payroll] Using scheme: ${scheme.targetType}/${scheme.targetId}`);
  console.log(`[Project Content Payroll] KPI rules:`, scheme.kpiRules.map(r => `${r.taskType}: ${r.value}`));

  const details: ContentPayrollDetail[] = [];
  let totalEarnings = 0;

  // Автосинхронизация контента из LiveDune для проектов пользователя
  const userProjects = projects.filter(p =>
    p.teamIds.includes(user.id) &&
    p.liveduneAccessToken &&
    p.liveduneAccountId &&
    p.organizationId
  );

  if (userProjects.length > 0) {
    console.log(`[Project Content Payroll] Auto-syncing ${userProjects.length} projects for ${user.name}`);

    const syncPromises = userProjects.map(project =>
      autoSyncContentPublications(project, { start: monthStart, end: monthEnd })
        .catch(err => {
          console.error(`[Project Content Payroll] Sync failed for ${project.name}:`, err);
          return { synced: 0, errors: 1 };
        })
    );

    const syncResults = await Promise.all(syncPromises);
    const totalSynced = syncResults.reduce((sum, r) => sum + r.synced, 0);

    if (totalSynced > 0) {
      console.log(`[Project Content Payroll] Synced ${totalSynced} new publications for ${user.name}`);
    }
  }

  // Получаем публикации контента за указанный месяц для этого пользователя
  const { data: publications, error } = await supabase
    .from('content_publications')
    .select('*, projects!inner(name)')
    .eq('assigned_user_id', user.id)
    .gte('published_at', monthStart.toISOString())
    .lte('published_at', monthEnd.toISOString());

  if (error) {
    console.error('[Project Content Payroll] Error fetching publications:', error);
    return { totalEarnings: 0, details: [] };
  }

  console.log(`[Project Content Payroll] Found ${publications?.length || 0} publications in ${month}`);

  if (!publications || publications.length === 0) {
    console.log(`[Project Content Payroll] No publications found for ${user.name} in ${month}`);
    return { totalEarnings: 0, details: [] };
  }

  // Группируем публикации по проекту и типу контента
  interface GroupedPublication {
    projectId: string;
    projectName: string;
    contentType: string;
    count: number;
  }

  const groupedByProject = publications.reduce((acc, pub) => {
    const key = `${pub.project_id}_${pub.content_type}`;
    if (!acc[key]) {
      acc[key] = {
        projectId: pub.project_id,
        projectName: pub.projects.name,
        contentType: pub.content_type,
        count: 0
      };
    }
    acc[key].count++;
    return acc;
  }, {} as Record<string, GroupedPublication>);

  console.log(`[Project Content Payroll] Grouped publications:`, groupedByProject);

  // Рассчитываем оплату за каждый тип контента
  const groups: GroupedPublication[] = Object.values(groupedByProject);

  for (const group of groups) {
    const rule = scheme.kpiRules.find(r => r.taskType === group.contentType);

    if (!rule) {
      console.log(`[Project Content Payroll] No rule found for content type: ${group.contentType}`);
      continue;
    }

    const earnings = group.count * rule.value;

    console.log(`[Project Content Payroll] ${group.projectName} - ${group.contentType}: ${group.count} × ${rule.value} = ${earnings}`);

    details.push({
      projectId: group.projectId,
      projectName: group.projectName,
      contentType: group.contentType,
      quantity: group.count,
      rate: rule.value,
      total: earnings,
      sharePercentage: 100 // каждая публикация уже назначена конкретному пользователю
    });

    totalEarnings += earnings;
  }

  console.log(`[Project Content Payroll] Total content earnings: ${totalEarnings}`);

  return { totalEarnings, details };
};
