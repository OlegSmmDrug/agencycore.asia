import React, { useState, useEffect, useMemo } from 'react';
import { ProjectExpense, User, Project, DynamicExpenseItem } from '../types';
import { projectExpensesService, calculateSmmExpenses, calculateProductionExpenses, calculateTotalExpenses, calculateMargin, calculateProjectPeriodDates, getProjectMonthsCount } from '../services/projectExpensesService';
import { GLOBAL_RATES } from '../services/projectAnalytics';
import { projectService } from '../services/projectService';
import { costAnalysisService } from '../services/costAnalysisService';
import { calculatorCategoryHelper, CalculatorCategoryInfo } from '../services/calculatorCategoryHelper';
import { getProjectPeriods, getCurrentPeriodNumber, getMonthName, formatPeriodDateRange } from '../utils/projectPeriodHelper';
import CostBreakdown from './CostBreakdown';
import PlanFactComparison from './PlanFactComparison';
import ExpenseTrends from './ExpenseTrends';
import ProjectFinancialSummary from './ProjectFinancialSummary';
import { SyncPreviewModal } from './SyncPreviewModal';
import { ExpenseValidation } from './ExpenseValidation';
import { ChevronLeft, ChevronRight, Lock, Unlock, Copy } from 'lucide-react';

interface ProjectExpensesProps {
  projectId: string;
  projectBudget: number;
  currentUser: User;
  project: Project;
  onUpdateProject: (project: Project) => void;
  adsSpend?: number;
  loadingAdsSpend?: boolean;
  facebookSpend?: number;
  googleSpend?: number;
  tiktokSpend?: number;
}

const ProjectExpenses: React.FC<ProjectExpensesProps> = ({
  projectId,
  projectBudget,
  currentUser,
  project,
  onUpdateProject,
  adsSpend = 0,
  loadingAdsSpend = false,
  facebookSpend = 0,
  googleSpend = 0,
  tiktokSpend = 0
}) => {
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [selectedPeriodNumber, setSelectedPeriodNumber] = useState<number>(() => {
    return project.startDate ? getCurrentPeriodNumber(project.startDate) : 1;
  });
  const [currentExpense, setCurrentExpense] = useState<Partial<ProjectExpense> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(project.startDate || '');
  const [tempDuration, setTempDuration] = useState(project.duration || 30);
  const [lastAutoSync, setLastAutoSync] = useState<Date | null>(null);
  const [nextSyncIn, setNextSyncIn] = useState<number>(180);
  const [activeTab, setActiveTab] = useState<'current' | 'analytics'>('current');
  const [showSyncPreview, setShowSyncPreview] = useState(false);
  const [syncChanges, setSyncChanges] = useState<any[]>([]);
  const [syncType, setSyncType] = useState<'legacy' | 'dynamic'>('dynamic');
  const [isMonthFrozen, setIsMonthFrozen] = useState(false);
  const [categories, setCategories] = useState<CalculatorCategoryInfo[]>([]);

  const canEdit = currentUser.jobTitle.toLowerCase().includes('pm') ||
                  currentUser.jobTitle.toLowerCase().includes('project manager') ||
                  currentUser.jobTitle.toLowerCase().includes('бухгалтер') ||
                  currentUser.jobTitle.toLowerCase().includes('accountant') ||
                  currentUser.systemRole === 'Admin';

  const margin = project.budget - (project.mediaBudget || 0);
  const marginPercent = project.budget > 0 ? Math.round((margin / project.budget) * 100) : 0;
  const mediaPercent = project.budget > 0 ? Math.round(((project.mediaBudget || 0) / project.budget) * 100) : 0;

  const projectPeriods = useMemo(() => {
    return getProjectPeriods(project.startDate || '', project.endDate);
  }, [project.startDate, project.endDate]);

  const currentPeriod = useMemo(() => {
    return projectPeriods.find(p => p.monthNumber === selectedPeriodNumber) || projectPeriods[0];
  }, [projectPeriods, selectedPeriodNumber]);

  const currentMonthNumber = useMemo(() => {
    return project.startDate ? getCurrentPeriodNumber(project.startDate) : 1;
  }, [project.startDate]);

  const currentCalendarMonth = useMemo(() => {
    return currentPeriod?.calendarMonth || new Date().toISOString().slice(0, 7);
  }, [currentPeriod]);

  const costAnalysis = useMemo(() => {
    if (currentExpense && currentExpense.id) {
      return costAnalysisService.analyzeCosts(currentExpense as ProjectExpense);
    }
    return null;
  }, [currentExpense]);

  const calculateEndDate = () => {
    if (!tempStartDate) return '-';
    const start = new Date(tempStartDate);
    start.setDate(start.getDate() + tempDuration);
    return start.toLocaleDateString('ru-RU');
  };

  const handleSaveDates = async () => {
    const endDate = tempStartDate ? new Date(tempStartDate) : null;
    if (endDate) {
      endDate.setDate(endDate.getDate() + tempDuration);
    }
    onUpdateProject({
      ...project,
      startDate: tempStartDate,
      duration: tempDuration,
      endDate: endDate?.toISOString() || ''
    });
    setIsEditingDates(false);
  };

  const handleRenewProject = async () => {
    try {
      const updatedProject = await projectService.renewProject(project.id, project, currentUser.id);
      onUpdateProject(updatedProject);
    } catch (error) {
      console.error('Error renewing project:', error);
    }
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && selectedPeriodNumber > 1) {
      setSelectedPeriodNumber(selectedPeriodNumber - 1);
    } else if (direction === 'next' && selectedPeriodNumber < currentMonthNumber) {
      setSelectedPeriodNumber(selectedPeriodNumber + 1);
    }
  };

  const detectCategory = (serviceName: string): string => {
    const lower = serviceName.toLowerCase();

    if (lower.includes('post') || lower.includes('пост') ||
        lower.includes('stor') || lower.includes('стори') ||
        lower.includes('reel') || lower.includes('рилс') ||
        lower.includes('карусель') || lower.includes('анализ') ||
        lower.includes('мониторинг') || lower.includes('стратеги') ||
        lower.includes('дублирование') || lower.includes('визуал') ||
        lower.includes('язык')) {
      return 'smm';
    }

    if (lower.includes('видео') || lower.includes('монтаж') ||
        lower.includes('съем') || lower.includes('shooting') ||
        lower.includes('видеограф') || lower.includes('цветокор') ||
        lower.includes('анимац') || lower.includes('фото') ||
        lower.includes('ретуш') || lower.includes('мобилограф')) {
      return 'video';
    }

    if (lower.includes('таргет') || lower.includes('реклам') ||
        lower.includes('креатив')) {
      return 'target';
    }

    if (lower.includes('сайт') || lower.includes('landing') ||
        lower.includes('посадоч') || lower.includes('wordpress') ||
        lower.includes('ворд пресс')) {
      return 'sites';
    }

    return 'smm';
  };

  const copyFromPreviousMonth = async () => {
    const prevPeriodNumber = selectedPeriodNumber - 1;
    if (prevPeriodNumber < 1) return;

    try {
      const prevExpense = await projectExpensesService.getExpenseByProjectAndPeriod(projectId, prevPeriodNumber);
      if (prevExpense && currentPeriod) {
        setCurrentExpense({
          ...prevExpense,
          id: currentExpense?.id,
          month: currentPeriod.calendarMonth,
          projectMonthNumber: selectedPeriodNumber,
          periodStartDate: currentPeriod.startDate,
          periodEndDate: currentPeriod.endDate,
          revenue: 0
        });
      }
    } catch (error) {
      console.error('Error copying from previous month:', error);
    }
  };

  const updateDynamicExpense = (serviceId: string, field: 'count' | 'rate', value: number) => {
    if (!currentExpense) return;

    const updatedDynamicExpenses = { ...currentExpense.dynamicExpenses };
    if (!updatedDynamicExpenses[serviceId]) {
      const serviceName = serviceId.replace('kpi_', '').charAt(0).toUpperCase() + serviceId.replace('kpi_', '').slice(1).replace(/_/g, ' ');
      updatedDynamicExpenses[serviceId] = {
        serviceName,
        category: detectCategory(serviceName),
        count: 0,
        rate: 0,
        cost: 0,
        syncedAt: new Date().toISOString()
      };
    }

    updatedDynamicExpenses[serviceId] = {
      ...updatedDynamicExpenses[serviceId],
      [field]: value,
      cost: field === 'count'
        ? value * updatedDynamicExpenses[serviceId].rate
        : updatedDynamicExpenses[serviceId].count * value
    };

    setCurrentExpense({
      ...currentExpense,
      dynamicExpenses: updatedDynamicExpenses
    });
  };

  useEffect(() => {
    loadExpenses();
    loadCategories();
  }, [projectId]);

  useEffect(() => {
    if (projectPeriods.length > 0) {
      loadExpenseForPeriod(selectedPeriodNumber);
    }
  }, [selectedPeriodNumber, projectPeriods]);

  const loadCategories = async () => {
    try {
      const cats = await calculatorCategoryHelper.getAllCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  useEffect(() => {
    if (isMonthFrozen) return;

    const autoSync = async () => {
      if (!saving && canEdit) {
        try {
          const synced = await projectExpensesService.syncDynamicExpenses(projectId, currentCalendarMonth, currentUser.id);
          setCurrentExpense(synced);
          await loadExpenses();
          setLastAutoSync(new Date());
          setNextSyncIn(180);

        } catch (error) {
          console.error('Auto-sync error:', error);
        }
      }
    };

    const syncInterval = setInterval(() => {
      autoSync();
    }, 180000);

    const countdownInterval = setInterval(() => {
      setNextSyncIn(prev => {
        if (prev <= 1) return 180;
        return prev - 1;
      });
    }, 1000);

    autoSync();

    return () => {
      clearInterval(syncInterval);
      clearInterval(countdownInterval);
    };
  }, [projectId, selectedPeriodNumber, canEdit, isMonthFrozen]);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const data = await projectExpensesService.getExpensesByProject(projectId);
      setExpenses(data);
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExpenseForPeriod = async (periodNumber: number) => {
    try {
      setLoading(true);
      const period = projectPeriods.find(p => p.monthNumber === periodNumber);
      if (!period) {
        setLoading(false);
        return;
      }

      const expense = await projectExpensesService.getExpenseByProjectAndPeriod(projectId, periodNumber);
      if (expense) {
        setCurrentExpense(expense);
      } else {
        setCurrentExpense({
          projectId,
          month: period.calendarMonth,
          projectMonthNumber: periodNumber,
          periodStartDate: period.startDate,
          periodEndDate: period.endDate,
          smmExpenses: 0,
          smmPostsCount: 0,
          smmReelsCount: 0,
          smmStoriesCount: 0,
          smmSpecDesignCount: 0,
          smmMonitoring: false,
          smmDubbingCount: 0,
          smmScenariosCount: 0,
          smmManualAdjustment: 0,
          pmExpenses: 0,
          pmSalaryShare: 0,
          pmProjectCount: 1,
          productionExpenses: 0,
          productionMobilographHours: 0,
          productionPhotographerHours: 0,
          productionVideographerHours: 0,
          productionVideoCost: 0,
          productionManualAdjustment: 0,
          modelsExpenses: 0,
          targetologistExpenses: 0,
          targetologistSalaryShare: 0,
          targetologistProjectCount: 1,
          otherExpenses: 0,
          otherExpensesDescription: '',
          revenue: 0,
          notes: '',
        });
      }
    } catch (error) {
      console.error('Error loading expense:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFromProject = async () => {
    try {
      setSaving(true);
      const synced = await projectExpensesService.syncFromProjectContent(projectId, currentCalendarMonth, currentUser.id);
      setCurrentExpense(synced);
      await loadExpenses();
      setLastAutoSync(new Date());
      setNextSyncIn(180);
    } catch (error) {
      console.error('Error syncing expenses:', error);
      alert('Ошибка при синхронизации данных');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncDynamicExpenses = async () => {
    try {
      setSaving(true);
      const synced = await projectExpensesService.syncDynamicExpenses(projectId, currentCalendarMonth, currentUser.id);
      setCurrentExpense(synced);
      await loadExpenses();
      setLastAutoSync(new Date());
      setNextSyncIn(180);
    } catch (error) {
      console.error('Error syncing dynamic expenses:', error);
      alert('Ошибка при синхронизации динамических расходов');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!currentExpense || !currentExpense.projectId || !currentExpense.month) return;

    try {
      setSaving(true);
      const saved = await projectExpensesService.createOrUpdateExpense(
        currentExpense as ProjectExpense,
        currentUser.id
      );
      setCurrentExpense(saved);
      setIsEditing(false);
      await loadExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Ошибка при сохранении расходов');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof ProjectExpense, value: any) => {
    if (!currentExpense) return;

    const updated = { ...currentExpense, [field]: value };

    const smmExpenses = calculateSmmExpenses(updated);
    const productionExpenses = calculateProductionExpenses(updated);

    updated.smmExpenses = smmExpenses;
    updated.productionExpenses = productionExpenses;
    updated.totalExpenses = calculateTotalExpenses({
      ...updated,
      smmExpenses,
      productionExpenses,
    });
    updated.marginPercent = calculateMargin(updated.revenue || 0, updated.totalExpenses || 0);

    setCurrentExpense(updated);
  };

  const totalExpenses = currentExpense?.totalExpenses || 0;
  const revenue = currentExpense?.revenue || 0;
  const expenseMargin = currentExpense?.marginPercent || 0;
  const netProfit = revenue - totalExpenses;

  const previousMonthExpense = expenses.find(e => {
    const date = new Date(currentCalendarMonth + '-01');
    date.setMonth(date.getMonth() - 1);
    return e.month === date.toISOString().slice(0, 7);
  });

  if (loading && !currentExpense) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl border border-blue-700 shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/30 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-white text-lg">Финансы проекта</h3>
            </div>
            {loading && (
              <span className="text-xs text-blue-200 flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Обновление...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-xs font-semibold text-blue-100 uppercase tracking-wide">Выручка</span>
              </div>
              <p className="text-2xl font-bold text-white">{revenue.toLocaleString()} ₸</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                <span className="text-xs font-semibold text-blue-100 uppercase tracking-wide">Расходы на услуги</span>
              </div>
              <p className="text-2xl font-bold text-white">{totalExpenses.toLocaleString()} ₸</p>
              {totalExpenses > 0 && (
                <p className="text-xs text-blue-200 mt-2">
                  Себестоимость услуг
                </p>
              )}
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${netProfit >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                <span className="text-xs font-semibold text-blue-100 uppercase tracking-wide">Прибыль</span>
              </div>
              <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-white' : 'text-rose-300'}`}>
                {netProfit.toLocaleString()} ₸
              </p>
              {revenue > 0 && (
                <p className="text-xs text-blue-200 mt-2">
                  Маржинальность: {expenseMargin.toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('current')}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'current'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Текущий месяц
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Аналитика и Отчеты
          </button>
        </div>
      </div>

      {activeTab === 'analytics' ? (
        <>
          <ProjectFinancialSummary project={project} expenses={expenses} />
          <ExpenseTrends expenses={expenses} projectBudget={project.budget} />
        </>
      ) : (
        <>
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigatePeriod('prev')}
                  disabled={selectedPeriodNumber <= 1}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>

                <div>
                  <h2 className="text-2xl font-bold text-slate-800">
                    {currentPeriod ? getMonthName(currentPeriod.monthNumber) : 'Расходы проекта'}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {currentPeriod ? formatPeriodDateRange(currentPeriod.startDate, currentPeriod.endDate) : 'Управление расходами проекта'}
                  </p>
                </div>

                <button
                  onClick={() => navigatePeriod('next')}
                  disabled={selectedPeriodNumber >= currentMonthNumber}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                {canEdit && (
                  <button
                    onClick={copyFromPreviousMonth}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Копировать прошлый месяц
                  </button>
                )}

                <button
                  onClick={() => setIsMonthFrozen(!isMonthFrozen)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isMonthFrozen
                      ? 'bg-amber-100 text-amber-700 border border-amber-300'
                      : 'bg-slate-100 text-slate-700 border border-slate-300'
                  }`}
                >
                  {isMonthFrozen ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  {isMonthFrozen ? 'Месяц заморожен' : 'Заморозить месяц'}
                </button>

                {canEdit && !isMonthFrozen && (
                  <>
                    {lastAutoSync && (
                      <div className="text-xs text-slate-500 text-right">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                          Авто: {Math.floor(nextSyncIn / 60)}:{String(nextSyncIn % 60).padStart(2, '0')}
                        </div>
                        <div>Обновлено: {lastAutoSync.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {canEdit && (
              <div className="flex gap-2 justify-end">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        loadExpenseForPeriod(selectedPeriodNumber);
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Отмена
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Редактировать
                  </button>
                )}
              </div>
            )}
          </div>

          <ExpenseValidation
            revenue={revenue}
            totalExpenses={totalExpenses}
            projectBudget={projectBudget}
            marginPercent={expenseMargin}
            previousMonthExpenses={previousMonthExpense?.totalExpenses}
          />

          {(currentExpense?.dynamicExpenses && Object.keys(currentExpense.dynamicExpenses).length > 0) || (project.contentMetricsVisible && project.contentMetricsVisible.length > 0) ? (
            <div className="bg-gradient-to-br from-blue-50 to-sky-50 border-2 border-blue-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="text-2xl">💰</span>
                  Детализация расходов по услугам
                </h3>
                {currentExpense?.lastSyncedAt && (
                  <div className="text-xs text-slate-500">
                    Синхронизировано: {new Date(currentExpense.lastSyncedAt).toLocaleString('ru-RU')}
                  </div>
                )}
              </div>

              {(() => {
                const dynamicExpenses = currentExpense?.dynamicExpenses || {};
                const categoriesInUse = new Set<string>();

                Object.values(dynamicExpenses).forEach(item => {
                  if (item.category) categoriesInUse.add(item.category);
                });

                const normalize = (str: string): string => {
                  return str
                    .toLowerCase()
                    .replace(/[_\s]+/g, '')
                    .replace(/[^a-zа-я0-9]/g, '')
                    .trim();
                };

                const enrichedDynamicExpenses: Record<string, DynamicExpenseItem> = { ...dynamicExpenses };

                if (project.contentMetricsVisible && Array.isArray(project.contentMetricsVisible)) {
                  project.contentMetricsVisible.forEach((metricKey: string) => {
                    const metricKeyNormalized = normalize(metricKey);

                    const existingKey = Object.keys(enrichedDynamicExpenses).find(key => {
                      const keyNormalized = normalize(key.replace('kpi_', ''));
                      const itemNormalized = normalize(enrichedDynamicExpenses[key]?.serviceName || '');
                      return keyNormalized === metricKeyNormalized || itemNormalized === metricKeyNormalized;
                    });

                    if (!existingKey) {
                      const kpiKey = `kpi_${metricKey}`;
                      const serviceName = metricKey.charAt(0).toUpperCase() + metricKey.slice(1).replace(/_/g, ' ');
                      const detectedCategory = detectCategory(serviceName);

                      enrichedDynamicExpenses[kpiKey] = {
                        serviceName,
                        category: detectedCategory,
                        count: 0,
                        rate: 0,
                        cost: 0,
                        syncedAt: new Date().toISOString()
                      };
                      categoriesInUse.add(detectedCategory);
                    }
                  });
                }

                const sortedCategories = categories
                  .filter(cat => categoriesInUse.has(cat.id))
                  .sort((a, b) => a.sortOrder - b.sortOrder);

                if (sortedCategories.length === 0) {
                  const legacyCategories = ['smm', 'video', 'target', 'sites'].filter(catId =>
                    Object.values(enrichedDynamicExpenses).some(item => item.category === catId)
                  );

                  return legacyCategories.map(category => {
                    const categoryServices = Object.entries(enrichedDynamicExpenses).filter(
                      ([_, item]) => item.category === category
                    );
                    if (categoryServices.length === 0) return null;

                    const legacyNames: Record<string, string> = {
                      smm: 'SMM', video: 'Продакшн', target: 'Таргет', sites: 'Сайты'
                    };
                    const legacyIcons: Record<string, string> = {
                      smm: '📱', video: '🎬', target: '🎯', sites: '🌐'
                    };

                    const categoryTotal = categoryServices.reduce((sum, [_, item]) => sum + item.cost, 0);
                    const categoryPercent = totalExpenses > 0 ? (categoryTotal / totalExpenses * 100).toFixed(1) : '0.0';

                    return (
                      <div key={category} className="mb-6 last:mb-0">
                        <div className="bg-white rounded-lg p-4 mb-3 border border-blue-300">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{legacyIcons[category] || '📁'}</span>
                              <span className="text-lg font-bold text-slate-800">{legacyNames[category] || category}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold text-blue-700">{categoryTotal.toLocaleString()} ₸</div>
                              <div className="text-xs text-slate-500">{categoryPercent}% от общих расходов</div>
                            </div>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(Number(categoryPercent), 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {categoryServices.map(([serviceId, item]) => {
                            const isProductionOrPhoto = category === 'video' || item.serviceName.includes(' - Shooting') || item.serviceName.includes(' - Мобилография');
                            const countLabel = isProductionOrPhoto ? 'Часов' : 'Количество';
                            return (
                              <div key={serviceId} className="bg-white p-4 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="text-sm text-slate-700 font-medium">{item.serviceName}</span>
                                  <span className="text-lg font-bold text-slate-900">{item.cost.toLocaleString()} ₸</span>
                                </div>
                                {isEditing && canEdit && !isMonthFrozen ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs text-slate-600 w-20">{countLabel}:</label>
                                      <input
                                        type="number"
                                        value={item.count}
                                        onChange={(e) => updateDynamicExpense(serviceId, 'count', Number(e.target.value))}
                                        className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                                        min="0"
                                        step="1"
                                      />
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs text-slate-600 w-20">Ставка (₸):</label>
                                      <input
                                        type="number"
                                        value={item.rate}
                                        onChange={(e) => updateDynamicExpense(serviceId, 'rate', Number(e.target.value))}
                                        className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                                        min="0"
                                        step="1000"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex justify-between items-center text-xs text-slate-500">
                                    <span>{countLabel}: {item.count}</span>
                                    <span>Ставка: {item.rate.toLocaleString()} ₸</span>
                                  </div>
                                )}
                                <div className="mt-2 pt-2 border-t border-slate-100">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-600">Итого:</span>
                                    <span className="font-semibold text-slate-700">{item.count} × {item.rate.toLocaleString()} = {item.cost.toLocaleString()} ₸</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                }

                return sortedCategories.map(category => {
                  const categoryServices = Object.entries(enrichedDynamicExpenses).filter(
                    ([_, item]) => item.category === category.id
                  );
                  if (categoryServices.length === 0) return null;

                  const categoryTotal = categoryServices.reduce((sum, [_, item]) => sum + item.cost, 0);
                  const categoryPercent = totalExpenses > 0 ? (categoryTotal / totalExpenses * 100).toFixed(1) : '0.0';

                  return (
                    <div key={category.id} className="mb-6 last:mb-0">
                      <div className="bg-white rounded-lg p-4 mb-3 border border-blue-300">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{category.icon}</span>
                            <span className="text-lg font-bold text-slate-800">{category.name}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-blue-700">{categoryTotal.toLocaleString()} ₸</div>
                            <div className="text-xs text-slate-500">{categoryPercent}% от общих расходов</div>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(Number(categoryPercent), 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {categoryServices.map(([serviceId, item]) => {
                          const isProductionOrPhoto = ['video', 'Продакшн', 'Видеосъемка', 'Фотосъемка'].some(c =>
                            category.id.includes(c) || category.name.includes(c)
                          ) || item.serviceName.includes(' - Shooting') || item.serviceName.includes(' - Мобилография');
                          const countLabel = isProductionOrPhoto ? 'Часов' : 'Количество';
                          return (
                            <div key={serviceId} className="bg-white p-4 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-sm text-slate-700 font-medium">{item.serviceName}</span>
                                <span className="text-lg font-bold text-slate-900">{item.cost.toLocaleString()} ₸</span>
                              </div>
                              {isEditing && canEdit && !isMonthFrozen ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs text-slate-600 w-20">{countLabel}:</label>
                                    <input
                                      type="number"
                                      value={item.count}
                                      onChange={(e) => updateDynamicExpense(serviceId, 'count', Number(e.target.value))}
                                      className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                                      min="0"
                                      step="1"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs text-slate-600 w-20">Ставка (₸):</label>
                                    <input
                                      type="number"
                                      value={item.rate}
                                      onChange={(e) => updateDynamicExpense(serviceId, 'rate', Number(e.target.value))}
                                      className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                                      min="0"
                                      step="1000"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="flex justify-between items-center text-xs text-slate-500">
                                  <span>{countLabel}: {item.count}</span>
                                  <span>Ставка: {item.rate.toLocaleString()} ₸</span>
                                </div>
                              )}
                              <div className="mt-2 pt-2 border-t border-slate-100">
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-600">Итого:</span>
                                  <span className="font-semibold text-slate-700">{item.count} × {item.rate.toLocaleString()} = {item.cost.toLocaleString()} ₸</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : null}

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="text-2xl">💼</span>
                ФОТ (Фонд оплаты труда)
              </h3>
              {currentExpense?.lastSyncedAt && !isMonthFrozen && (
                <div className="text-xs text-green-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                  Синхронизировано автоматически
                </div>
              )}
            </div>

            <div className="mb-4 p-3 bg-white rounded-lg border border-green-200">
              <div className="text-sm text-slate-600 mb-1">Итого ФОТ</div>
              <div className="text-2xl font-bold text-green-700">{(currentExpense?.fotExpenses || 0).toLocaleString()} ₸</div>
            </div>

            {currentExpense?.fotCalculations && Object.keys(currentExpense.fotCalculations).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(currentExpense.fotCalculations).map(([userId, calc]) => (
                  <div key={userId} className="bg-white p-4 rounded-lg border border-slate-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-slate-800">{calc.userName}</div>
                        <div className="text-xs text-slate-500">{calc.jobTitle}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-700">{calc.shareForThisProject.toLocaleString()} ₸</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                      <div className="flex justify-between">
                        <span>Фиксированная ЗП:</span>
                        <span className="font-medium">{calc.baseSalary.toLocaleString()} ₸</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Активных проектов:</span>
                        <span className="font-medium">{calc.activeProjectsCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Доля на проект:</span>
                        <span className="font-medium">{calc.shareForThisProject.toLocaleString()} ₸</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">ℹ️</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-800 mb-2">Настройте зарплатные схемы</h4>
                    <p className="text-sm text-slate-600 mb-3">
                      ФОТ рассчитывается для сотрудников с фиксированной оплатой (без KPI).
                      Формула: Фикс / Количество активных проектов сотрудника.
                    </p>
                    <p className="text-sm text-slate-600">
                      Перейдите в <strong>Зарплатные схемы</strong> и настройте фиксированную оплату
                      (Base Salary) для нужных сотрудников. {!isMonthFrozen && 'Расчет произойдет автоматически.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {currentExpense?.salaryCalculations && Object.keys(currentExpense.salaryCalculations).length > 0 && (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="text-2xl">👥</span>
                Расчет зарплат команды
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(currentExpense.salaryCalculations).map(([userId, calc]) => (
                  <div key={userId} className="bg-white p-4 rounded-lg border border-slate-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-slate-800">{calc.userName}</div>
                        <div className="text-xs text-slate-500">{calc.jobTitle}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-purple-700">{calc.shareForThisProject.toLocaleString()} ₸</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                      <div className="flex justify-between">
                        <span>Базовый оклад:</span>
                        <span className="font-medium">{calc.baseSalary.toLocaleString()} ₸</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Активных проектов:</span>
                        <span className="font-medium">{calc.activeProjectsCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Доля на проект:</span>
                        <span className="font-medium">{calc.shareForThisProject.toLocaleString()} ₸</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-pink-50 to-rose-50 border-2 border-pink-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="text-2xl">👤</span>
                Модели
              </h3>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <span className="text-lg">💡</span>
                <div className="text-xs text-slate-600">
                  Разовые расходы на моделей, оплата наличными, работа с разными людьми
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-pink-300">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Расходы на моделей</span>
                {isEditing && canEdit ? (
                  <input
                    type="number"
                    value={currentExpense?.modelsExpenses || ''}
                    onChange={(e) => updateField('modelsExpenses', Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    className="w-48 px-3 py-2 border border-pink-300 rounded-lg text-sm font-semibold text-right"
                    placeholder="0"
                  />
                ) : (
                  <div className="text-xl font-bold text-pink-700">
                    {(currentExpense?.modelsExpenses || 0).toLocaleString()} ₸
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-gray-50 border-2 border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="text-2xl">📝</span>
                Прочие расходы
              </h3>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <span className="text-lg">💡</span>
                <div className="text-xs text-slate-600">
                  Дополнительные разовые расходы, не входящие в другие категории
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-white rounded-lg p-4 border border-slate-300">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Сумма</span>
                  {isEditing && canEdit ? (
                    <input
                      type="number"
                      value={currentExpense?.otherExpenses || ''}
                      onChange={(e) => updateField('otherExpenses', Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      className="w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-right"
                      placeholder="0"
                    />
                  ) : (
                    <div className="text-xl font-bold text-slate-700">
                      {(currentExpense?.otherExpenses || 0).toLocaleString()} ₸
                    </div>
                  )}
                </div>
                {isEditing && canEdit && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <label className="text-xs text-slate-600 mb-1 block">Описание расходов</label>
                    <textarea
                      value={currentExpense?.otherExpensesDescription || ''}
                      onChange={(e) => updateField('otherExpensesDescription', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none"
                      placeholder="Укажите на что были потрачены средства..."
                      rows={2}
                    />
                  </div>
                )}
                {!isEditing && currentExpense?.otherExpensesDescription && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="text-xs text-slate-600 mb-1">Описание:</div>
                    <div className="text-sm text-slate-700">{currentExpense.otherExpensesDescription}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {costAnalysis && currentExpense && (
            <CostBreakdown analysis={costAnalysis} />
          )}

          {currentExpense && currentExpense.id && (
            <PlanFactComparison project={project} expense={currentExpense as ProjectExpense} />
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">История расходов</h3>
            {expenses.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Месяц</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">СММ</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Продакшн</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Прочие</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Всего расходов</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Выручка</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Маржа</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr
                        key={exp.id}
                        className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${
                          exp.projectMonthNumber === selectedPeriodNumber ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => exp.projectMonthNumber && setSelectedPeriodNumber(exp.projectMonthNumber)}
                      >
                        <td className="py-3 px-4 text-sm font-medium">
                          {exp.projectMonthNumber ? (
                            <div>
                              <div className="font-semibold">
                                {exp.projectMonthNumber === 1 ? 'Первый' :
                                 exp.projectMonthNumber === 2 ? 'Второй' :
                                 exp.projectMonthNumber === 3 ? 'Третий' :
                                 exp.projectMonthNumber === 4 ? 'Четвертый' :
                                 exp.projectMonthNumber === 5 ? 'Пятый' :
                                 exp.projectMonthNumber === 6 ? 'Шестой' :
                                 `${exp.projectMonthNumber}-й`} месяц
                              </div>
                              {exp.periodStartDate && exp.periodEndDate && (
                                <div className="text-xs text-slate-500">
                                  {new Date(exp.periodStartDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} - {new Date(exp.periodEndDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                                </div>
                              )}
                            </div>
                          ) : (
                            exp.month
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">{exp.smmExpenses.toLocaleString()} ₸</td>
                        <td className="py-3 px-4 text-sm text-right">{exp.productionExpenses.toLocaleString()} ₸</td>
                        <td className="py-3 px-4 text-sm text-right">
                          {(exp.pmExpenses + exp.targetologistExpenses + exp.modelsExpenses + exp.otherExpenses).toLocaleString()} ₸
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-semibold">{exp.totalExpenses.toLocaleString()} ₸</td>
                        <td className="py-3 px-4 text-sm text-right">{exp.revenue.toLocaleString()} ₸</td>
                        <td className={`py-3 px-4 text-sm text-right font-semibold ${
                          exp.marginPercent >= 30 ? 'text-green-600' :
                          exp.marginPercent >= 15 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {exp.marginPercent.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                Нет данных по расходам. Начните с синхронизации данных проекта.
              </div>
            )}
          </div>
        </>
      )}

      <SyncPreviewModal
        isOpen={showSyncPreview}
        onClose={() => setShowSyncPreview(false)}
        changes={syncChanges}
        onConfirm={(mode, fields) => {
          setShowSyncPreview(false);
        }}
        syncType={syncType}
      />
    </div>
  );
};

export default ProjectExpenses;
