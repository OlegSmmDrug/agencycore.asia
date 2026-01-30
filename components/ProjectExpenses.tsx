import React, { useState, useEffect, useMemo } from 'react';
import { ProjectExpense, User, Project } from '../types';
import { projectExpensesService, calculateSmmExpenses, calculateProductionExpenses, calculateTotalExpenses, calculateMargin } from '../services/projectExpensesService';
import { GLOBAL_RATES } from '../services/projectAnalytics';
import { projectService } from '../services/projectService';
import { costAnalysisService } from '../services/costAnalysisService';
import CostBreakdown from './CostBreakdown';
import PlanFactComparison from './PlanFactComparison';
import ExpenseTrends from './ExpenseTrends';
import ProjectFinancialSummary from './ProjectFinancialSummary';
import { ExpenseCategoryCard } from './ExpenseCategoryCard';
import { SyncPreviewModal } from './SyncPreviewModal';
import { ExpenseValidation } from './ExpenseValidation';
import { ChevronLeft, ChevronRight, Lock, Unlock, Search, Filter, Copy } from 'lucide-react';

interface ProjectExpensesProps {
  projectId: string;
  projectBudget: number;
  currentUser: User;
  project: Project;
  onUpdateProject: (project: Project) => void;
}

const ProjectExpenses: React.FC<ProjectExpensesProps> = ({ projectId, projectBudget, currentUser, project, onUpdateProject }) => {
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
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
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'filled' | 'deviations'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const canEdit = currentUser.jobTitle.toLowerCase().includes('pm') ||
                  currentUser.jobTitle.toLowerCase().includes('project manager') ||
                  currentUser.jobTitle.toLowerCase().includes('бухгалтер') ||
                  currentUser.jobTitle.toLowerCase().includes('accountant') ||
                  currentUser.systemRole === 'Admin';

  const margin = project.budget - (project.mediaBudget || 0);
  const marginPercent = project.budget > 0 ? Math.round((margin / project.budget) * 100) : 0;
  const mediaPercent = project.budget > 0 ? Math.round(((project.mediaBudget || 0) / project.budget) * 100) : 0;

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

  const navigateMonth = (direction: 'prev' | 'next') => {
    const date = new Date(selectedMonth + '-01');
    if (direction === 'prev') {
      date.setMonth(date.getMonth() - 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const copyFromPreviousMonth = async () => {
    const date = new Date(selectedMonth + '-01');
    date.setMonth(date.getMonth() - 1);
    const prevMonth = date.toISOString().slice(0, 7);

    try {
      const prevExpense = await projectExpensesService.getExpenseByProjectAndMonth(projectId, prevMonth);
      if (prevExpense) {
        setCurrentExpense({
          ...prevExpense,
          id: currentExpense?.id,
          month: selectedMonth,
          revenue: 0
        });
      }
    } catch (error) {
      console.error('Error copying from previous month:', error);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [projectId]);

  useEffect(() => {
    loadExpenseForMonth(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    if (isMonthFrozen) return;

    const autoSync = async () => {
      if (!saving && canEdit) {
        try {
          const synced = await projectExpensesService.syncDynamicExpenses(projectId, selectedMonth, currentUser.id);
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
  }, [projectId, selectedMonth, canEdit, isMonthFrozen]);

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

  const loadExpenseForMonth = async (month: string) => {
    try {
      setLoading(true);
      const expense = await projectExpensesService.getExpenseByProjectAndMonth(projectId, month);
      if (expense) {
        setCurrentExpense(expense);
      } else {
        setCurrentExpense({
          projectId,
          month,
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
      const synced = await projectExpensesService.syncFromProjectContent(projectId, selectedMonth, currentUser.id);
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
      const synced = await projectExpensesService.syncDynamicExpenses(projectId, selectedMonth, currentUser.id);
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

  if (loading && !currentExpense) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">Загрузка...</div>
      </div>
    );
  }

  const totalExpenses = currentExpense?.totalExpenses || 0;
  const revenue = currentExpense?.revenue || 0;
  const expenseMargin = currentExpense?.marginPercent || 0;
  const netProfit = revenue - totalExpenses;

  const previousMonthExpense = expenses.find(e => {
    const date = new Date(selectedMonth + '-01');
    date.setMonth(date.getMonth() - 1);
    return e.month === date.toISOString().slice(0, 7);
  });

  const categories = [
    {
      name: 'SMM',
      total: currentExpense?.smmExpenses || 0,
      percentage: totalExpenses > 0 ? ((currentExpense?.smmExpenses || 0) / totalExpenses * 100) : 0,
      trend: previousMonthExpense ? ((currentExpense?.smmExpenses || 0) - previousMonthExpense.smmExpenses) / Math.max(previousMonthExpense.smmExpenses, 1) * 100 : undefined,
      icon: '📱',
      color: 'bg-blue-100',
      fields: [
        { label: 'Посты', value: currentExpense?.smmPostsCount || 0, key: 'smmPostsCount', unit: 'шт', rate: GLOBAL_RATES.SMM.post },
        { label: 'Reels', value: currentExpense?.smmReelsCount || 0, key: 'smmReelsCount', unit: 'шт', rate: GLOBAL_RATES.SMM.reel },
        { label: 'Stories', value: currentExpense?.smmStoriesCount || 0, key: 'smmStoriesCount', unit: 'шт', rate: GLOBAL_RATES.SMM.story },
        { label: 'Спец. дизайн', value: currentExpense?.smmSpecDesignCount || 0, key: 'smmSpecDesignCount', unit: 'шт' },
      ]
    },
    {
      name: 'Production',
      total: currentExpense?.productionExpenses || 0,
      percentage: totalExpenses > 0 ? ((currentExpense?.productionExpenses || 0) / totalExpenses * 100) : 0,
      trend: previousMonthExpense ? ((currentExpense?.productionExpenses || 0) - previousMonthExpense.productionExpenses) / Math.max(previousMonthExpense.productionExpenses, 1) * 100 : undefined,
      icon: '🎬',
      color: 'bg-orange-100',
      fields: [
        { label: 'Мобилограф', value: currentExpense?.productionMobilographHours || 0, key: 'productionMobilographHours', unit: 'часов' },
        { label: 'Фотограф', value: currentExpense?.productionPhotographerHours || 0, key: 'productionPhotographerHours', unit: 'часов' },
        { label: 'Видеограф', value: currentExpense?.productionVideographerHours || 0, key: 'productionVideographerHours', unit: 'часов' },
        { label: 'Стоимость видео', value: currentExpense?.productionVideoCost || 0, key: 'productionVideoCost', unit: '₸' },
      ]
    },
    {
      name: 'Salaries',
      total: (currentExpense?.pmExpenses || 0) + (currentExpense?.targetologistExpenses || 0),
      percentage: totalExpenses > 0 ? (((currentExpense?.pmExpenses || 0) + (currentExpense?.targetologistExpenses || 0)) / totalExpenses * 100) : 0,
      trend: previousMonthExpense ? (((currentExpense?.pmExpenses || 0) + (currentExpense?.targetologistExpenses || 0)) - (previousMonthExpense.pmExpenses + previousMonthExpense.targetologistExpenses)) / Math.max((previousMonthExpense.pmExpenses + previousMonthExpense.targetologistExpenses), 1) * 100 : undefined,
      icon: '💼',
      color: 'bg-purple-100',
      fields: [
        { label: 'Проджект (ЗП)', value: currentExpense?.pmExpenses || 0, key: 'pmExpenses', unit: '₸' },
        { label: 'Таргетолог (ЗП)', value: currentExpense?.targetologistExpenses || 0, key: 'targetologistExpenses', unit: '₸' },
      ]
    },
    {
      name: 'Models & Other',
      total: (currentExpense?.modelsExpenses || 0) + (currentExpense?.otherExpenses || 0),
      percentage: totalExpenses > 0 ? (((currentExpense?.modelsExpenses || 0) + (currentExpense?.otherExpenses || 0)) / totalExpenses * 100) : 0,
      trend: previousMonthExpense ? (((currentExpense?.modelsExpenses || 0) + (currentExpense?.otherExpenses || 0)) - (previousMonthExpense.modelsExpenses + previousMonthExpense.otherExpenses)) / Math.max((previousMonthExpense.modelsExpenses + previousMonthExpense.otherExpenses), 1) * 100 : undefined,
      icon: '📸',
      color: 'bg-pink-100',
      fields: [
        { label: 'Модели', value: currentExpense?.modelsExpenses || 0, key: 'modelsExpenses', unit: '₸' },
        { label: 'Прочее', value: currentExpense?.otherExpenses || 0, key: 'otherExpenses', unit: '₸' },
      ]
    },
  ];

  const filteredCategories = categories.filter(cat => {
    if (categoryFilter === 'filled' && cat.total === 0) return false;
    if (categoryFilter === 'deviations' && (!cat.trend || Math.abs(cat.trend) < 10)) return false;
    if (searchQuery && !cat.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
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
                  onClick={() => navigateMonth('prev')}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>

                <div>
                  <h2 className="text-2xl font-bold text-slate-800">
                    {new Date(selectedMonth + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                  </h2>
                  <p className="text-sm text-slate-500">Управление расходами проекта</p>
                </div>

                <button
                  onClick={() => navigateMonth('next')}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
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

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                <div className="text-sm font-medium text-blue-700 mb-1">Выручка</div>
                <div className="text-3xl font-bold text-blue-900">{revenue.toLocaleString()} ₸</div>
                {isEditing && canEdit && (
                  <input
                    type="number"
                    value={revenue || ''}
                    onChange={(e) => updateField('revenue', Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    className="mt-2 w-full px-3 py-2 border border-blue-300 rounded-lg text-sm"
                    placeholder="Введите выручку"
                  />
                )}
              </div>

              <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200">
                <div className="text-sm font-medium text-red-700 mb-1">Расходы</div>
                <div className="text-3xl font-bold text-red-900">{totalExpenses.toLocaleString()} ₸</div>
                <div className="text-xs text-red-600 mt-1">
                  {((totalExpenses / projectBudget) * 100).toFixed(1)}% от бюджета
                </div>
              </div>

              <div className={`bg-gradient-to-br p-6 rounded-xl border ${
                expenseMargin >= 30 ? 'from-green-50 to-green-100 border-green-200' :
                expenseMargin >= 15 ? 'from-yellow-50 to-yellow-100 border-yellow-200' :
                'from-red-50 to-red-100 border-red-200'
              }`}>
                <div className={`text-sm font-medium mb-1 ${
                  expenseMargin >= 30 ? 'text-green-700' :
                  expenseMargin >= 15 ? 'text-yellow-700' :
                  'text-red-700'
                }`}>Прибыль / Маржа</div>
                <div className={`text-3xl font-bold ${
                  expenseMargin >= 30 ? 'text-green-900' :
                  expenseMargin >= 15 ? 'text-yellow-900' :
                  'text-red-900'
                }`}>{netProfit.toLocaleString()} ₸</div>
                <div className={`text-xs mt-1 ${
                  expenseMargin >= 30 ? 'text-green-600' :
                  expenseMargin >= 15 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>{expenseMargin.toFixed(1)}% маржа</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    categoryFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Все
                </button>
                <button
                  onClick={() => setCategoryFilter('filled')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    categoryFilter === 'filled' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Заполненные
                </button>
                <button
                  onClick={() => setCategoryFilter('deviations')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    categoryFilter === 'deviations' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  С отклонениями
                </button>
              </div>

              {canEdit && (
                <div className="flex gap-2">
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
                          loadExpenseForMonth(selectedMonth);
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
          </div>

          <ExpenseValidation
            revenue={revenue}
            totalExpenses={totalExpenses}
            projectBudget={projectBudget}
            marginPercent={expenseMargin}
            previousMonthExpenses={previousMonthExpense?.totalExpenses}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCategories.map((category) => (
              <ExpenseCategoryCard
                key={category.name}
                category={category}
                isEditing={isEditing}
                onFieldChange={(key, value) => updateField(key as keyof ProjectExpense, value)}
                previousMonthData={previousMonthExpense ?
                  (category.name === 'SMM' ? previousMonthExpense.smmExpenses :
                   category.name === 'Production' ? previousMonthExpense.productionExpenses :
                   category.name === 'Salaries' ? previousMonthExpense.pmExpenses + previousMonthExpense.targetologistExpenses :
                   previousMonthExpense.modelsExpenses + previousMonthExpense.otherExpenses) : undefined
                }
              />
            ))}
          </div>

          {currentExpense?.dynamicExpenses && Object.keys(currentExpense.dynamicExpenses).length > 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-sky-50 border-2 border-blue-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="text-2xl">✨</span>
                  Динамические расходы из калькулятора
                </h3>
                {currentExpense.lastSyncedAt && (
                  <div className="text-xs text-slate-500">
                    Синхронизировано: {new Date(currentExpense.lastSyncedAt).toLocaleString('ru-RU')}
                  </div>
                )}
              </div>

              {['smm', 'video', 'target', 'sites'].map(category => {
                const categoryServices = Object.entries(currentExpense.dynamicExpenses || {}).filter(
                  ([_, item]) => item.category === category
                );

                if (categoryServices.length === 0) return null;

                const categoryNames: Record<string, string> = {
                  smm: 'SMM',
                  video: 'Production',
                  target: 'Таргет',
                  sites: 'Сайты'
                };

                const categoryIcons: Record<string, string> = {
                  smm: '📱',
                  video: '🎬',
                  target: '🎯',
                  sites: '🌐'
                };

                return (
                  <div key={category} className="mb-4 last:mb-0">
                    <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <span>{categoryIcons[category]}</span>
                      {categoryNames[category]}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {categoryServices.map(([serviceId, item]) => (
                        <div key={serviceId} className="bg-white p-3 rounded-lg border border-slate-200">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-sm text-slate-700 font-medium">{item.serviceName}</span>
                            <span className="text-sm font-bold text-slate-800">{item.cost.toLocaleString()} ₸</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.count} × {item.rate.toLocaleString()} ₸
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
                          exp.month === selectedMonth ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedMonth(exp.month)}
                      >
                        <td className="py-3 px-4 text-sm font-medium">{exp.month}</td>
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
