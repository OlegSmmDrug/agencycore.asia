export interface ProjectPeriod {
  monthNumber: number;
  startDate: string;
  endDate: string;
  displayName: string;
  calendarMonth: string;
}

export const getProjectPeriods = (projectStartDate: string, projectDeadline?: string): ProjectPeriod[] => {
  if (!projectStartDate) return [];

  const start = new Date(projectStartDate);
  const end = projectDeadline ? new Date(projectDeadline) : new Date();
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const totalMonths = Math.max(1, Math.ceil(diffDays / 30));

  const months = [];
  const monthNames = ['Первый', 'Второй', 'Третий', 'Четвертый', 'Пятый', 'Шестой', 'Седьмой', 'Восьмой', 'Девятый', 'Десятый', 'Одиннадцатый', 'Двенадцатый'];

  for (let i = 1; i <= totalMonths; i++) {
    const periodStart = new Date(start);
    periodStart.setDate(periodStart.getDate() + (i - 1) * 30);

    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 29);

    const displayName = i <= 12 ? `${monthNames[i - 1]} месяц работы` : `${i}-й месяц работы`;

    const calendarMonth = periodStart.toISOString().slice(0, 7);

    months.push({
      monthNumber: i,
      startDate: periodStart.toISOString().split('T')[0],
      endDate: periodEnd.toISOString().split('T')[0],
      displayName,
      calendarMonth
    });
  }

  return months;
};

export const getCurrentPeriodNumber = (projectStartDate: string): number => {
  if (!projectStartDate) return 1;

  const start = new Date(projectStartDate);
  const now = new Date();
  const diffTime = now.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 1;

  return Math.floor(diffDays / 30) + 1;
};

export const getMonthName = (monthNumber: number): string => {
  const monthNames = [
    'Первый', 'Второй', 'Третий', 'Четвертый', 'Пятый', 'Шестой',
    'Седьмой', 'Восьмой', 'Девятый', 'Десятый', 'Одиннадцатый', 'Двенадцатый'
  ];

  return monthNumber <= 12
    ? `${monthNames[monthNumber - 1]} месяц работы`
    : `${monthNumber}-й месяц работы`;
};

export const formatPeriodDateRange = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const formatDate = (date: Date) => {
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  return `${formatDate(start)} - ${formatDate(end)}`;
};
