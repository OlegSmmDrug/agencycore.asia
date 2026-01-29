import { User } from '../types';

export type DashboardType = 'director' | 'sales' | 'targetologist' | 'pm' | 'smm' | 'videographer' | 'mobilograph' | 'photographer' | 'creative' | 'intern' | 'accountant';

export const getDashboardType = (user: User): DashboardType => {
  const jobTitle = user.jobTitle.toLowerCase();

  if (jobTitle.includes('ceo') || jobTitle.includes('director') || jobTitle.includes('владелец')) {
    return 'director';
  }

  if (jobTitle.includes('pm') || jobTitle.includes('project manager') || jobTitle.includes('проджект')) {
    return 'pm';
  }

  if (jobTitle.includes('smm') || jobTitle.includes('смм') || jobTitle.includes('контент')) {
    return 'smm';
  }

  if (jobTitle.includes('targetologist') || jobTitle.includes('таргетолог')) {
    return 'targetologist';
  }

  if (jobTitle.includes('videographer') || jobTitle.includes('видеограф')) {
    return 'videographer';
  }

  if (jobTitle.includes('mobilograph') || jobTitle.includes('мобилограф')) {
    return 'mobilograph';
  }

  if (jobTitle.includes('photographer') || jobTitle.includes('фотограф')) {
    return 'photographer';
  }

  if (
    jobTitle.includes('designer') ||
    jobTitle.includes('дизайнер') ||
    jobTitle.includes('copywriter') ||
    jobTitle.includes('копирайтер')
  ) {
    return 'creative';
  }

  if (jobTitle.includes('intern') || jobTitle.includes('стажер')) {
    return 'intern';
  }

  if (jobTitle.includes('accountant') || jobTitle.includes('бухгалтер')) {
    return 'accountant';
  }

  if (jobTitle.includes('sales') || jobTitle.includes('manager') || jobTitle.includes('менеджер')) {
    return 'sales';
  }

  return 'creative';
};

export const getDashboardTitle = (type: DashboardType): string => {
  const titles: Record<DashboardType, string> = {
    director: 'Операционная панель директора',
    sales: 'Кабинет менеджера по продажам',
    targetologist: 'Панель таргетолога',
    pm: 'Управление проектами',
    smm: 'Панель SMM-специалиста',
    videographer: 'Рабочее место видеографа',
    mobilograph: 'Панель мобилографа',
    photographer: 'Рабочее место фотографа',
    creative: 'Рабочее место специалиста',
    intern: 'Кабинет стажёра',
    accountant: 'Панель бухгалтера'
  };

  return titles[type];
};
