import { User, Project, SalaryScheme } from '../types';
import { ContentMetrics } from './serviceMappingService';

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

export const calculateProjectContentPayroll = (
  user: User,
  projects: Project[],
  salarySchemes: SalaryScheme[],
  month: string
): ProjectContentPayroll => {
  console.log(`[Project Content Payroll] === Calculating for ${user.name} (${user.jobTitle}) - Month: ${month} ===`);

  const monthStart = new Date(month + '-01');
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

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

  const eligibleProjects = projects.filter(project => {
    if (!project.teamIds || !project.teamIds.includes(user.id)) {
      return false;
    }

    if (!project.startDate || !project.endDate) {
      return false;
    }

    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);

    const overlaps = projectStart <= monthEnd && projectEnd >= monthStart;
    return overlaps;
  });

  console.log(`[Project Content Payroll] Found ${eligibleProjects.length} eligible projects`);

  for (const project of eligibleProjects) {
    if (!project.contentMetrics || Object.keys(project.contentMetrics).length === 0) {
      console.log(`[Project Content Payroll] Project ${project.name}: No content metrics`);
      continue;
    }

    console.log(`[Project Content Payroll] Project ${project.name}:`, project.contentMetrics);

    const teamMembers = project.teamIds || [];

    const smmCount = Math.max(1, teamMembers.length);
    const userShare = 1 / smmCount;

    console.log(`[Project Content Payroll] Project ${project.name}: ${teamMembers.length} team members, user share: ${(userShare * 100).toFixed(1)}%`);

    for (const [metricKey, metricData] of Object.entries(project.contentMetrics)) {
      const fact = metricData.fact || 0;
      if (fact === 0) continue;

      const normalizedType = normalizeContentType(metricKey);

      const rule = scheme.kpiRules.find(r => r.taskType === normalizedType);

      if (!rule) {
        console.log(`[Project Content Payroll]   - ${metricKey} (${normalizedType}): fact=${fact}, no matching rule`);
        continue;
      }

      const userQuantity = fact * userShare;
      const earnings = userQuantity * rule.value;

      console.log(`[Project Content Payroll]   - ${metricKey} → ${normalizedType}: fact=${fact}, userShare=${userQuantity.toFixed(2)}, rate=${rule.value}, earnings=${earnings.toFixed(2)}`);

      details.push({
        projectId: project.id,
        projectName: project.name,
        contentType: normalizedType,
        quantity: userQuantity,
        rate: rule.value,
        total: earnings,
        sharePercentage: userShare * 100
      });

      totalEarnings += earnings;
    }
  }

  console.log(`[Project Content Payroll] Total content earnings: ${totalEarnings}`);

  return { totalEarnings, details };
};
