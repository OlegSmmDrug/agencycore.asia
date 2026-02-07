import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, Briefcase, HardDrive, ArrowLeftRight, RotateCcw, Check, AlertTriangle, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ResourceSwapProps {
  organizationId: string;
  planName: string;
  usageStats: {
    users: { current: number; limit: number | null; percentage: number };
    projects: { current: number; limit: number | null; percentage: number };
    storage: { currentMb: number; limitMb: number | null; percentage: number };
  };
  subscriptionEndDate: string | null;
  onApplied?: () => void;
}

const SELL_RATES = { users: 3.0, projects: 0.8, storage: 0.3 };
const BUY_RATES = { users: 7.0, projects: 2.5, storage: 1.0 };
const STEPS = { users: 1, projects: 5, storage: 1 };

const ResourceSwap: React.FC<ResourceSwapProps> = ({
  organizationId, planName, usageStats, subscriptionEndDate, onApplied,
}) => {
  const [usersDelta, setUsersDelta] = useState(0);
  const [projectsDelta, setProjectsDelta] = useState(0);
  const [storageDeltaGb, setStorageDeltaGb] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [existingOverride, setExistingOverride] = useState<any>(null);

  const baseUsers = usageStats.users.limit || 0;
  const baseProjects = usageStats.projects.limit || 0;
  const baseStorageGb = Math.round((usageStats.storage.limitMb || 0) / 1024);

  const actualUsers = usageStats.users.current;
  const actualProjects = usageStats.projects.current;
  const actualStorageGb = Math.ceil(usageStats.storage.currentMb / 1024);

  useEffect(() => {
    loadExistingOverride();
  }, [organizationId]);

  const loadExistingOverride = async () => {
    const { data } = await supabase
      .from('resource_overrides')
      .select('*')
      .eq('organization_id', organizationId)
      .gt('valid_until', new Date().toISOString())
      .maybeSingle();

    if (data) {
      setExistingOverride(data);
      setUsersDelta(data.users_delta);
      setProjectsDelta(data.projects_delta);
      setStorageDeltaGb(data.storage_delta_gb);
    }
  };

  const pointsEarned = useMemo(() => {
    let earned = 0;
    if (usersDelta < 0) earned += Math.abs(usersDelta) * SELL_RATES.users;
    if (projectsDelta < 0) earned += Math.abs(projectsDelta) * SELL_RATES.projects;
    if (storageDeltaGb < 0) earned += Math.abs(storageDeltaGb) * SELL_RATES.storage;
    return earned;
  }, [usersDelta, projectsDelta, storageDeltaGb]);

  const pointsSpent = useMemo(() => {
    let spent = 0;
    if (usersDelta > 0) spent += usersDelta * BUY_RATES.users;
    if (projectsDelta > 0) spent += projectsDelta * BUY_RATES.projects;
    if (storageDeltaGb > 0) spent += storageDeltaGb * BUY_RATES.storage;
    return spent;
  }, [usersDelta, projectsDelta, storageDeltaGb]);

  const pointsBalance = pointsEarned - pointsSpent;
  const isValid = pointsBalance >= 0;
  const hasChanges = usersDelta !== 0 || projectsDelta !== 0 || storageDeltaGb !== 0;

  const adjustedUsers = baseUsers + usersDelta;
  const adjustedProjects = baseProjects + projectsDelta;
  const adjustedStorageGb = baseStorageGb + storageDeltaGb;

  const minUsers = Math.max(1, actualUsers);
  const minProjects = Math.max(0, actualProjects);
  const minStorageGb = Math.max(0, actualStorageGb);

  const maxSellBudget = useMemo(() => {
    let budget = 0;
    budget += Math.max(0, baseUsers - minUsers) * SELL_RATES.users;
    budget += Math.max(0, baseProjects - minProjects) * SELL_RATES.projects;
    budget += Math.max(0, baseStorageGb - minStorageGb) * SELL_RATES.storage;
    return budget;
  }, [baseUsers, baseProjects, baseStorageGb, minUsers, minProjects, minStorageGb]);

  const maxUsers = baseUsers + Math.floor(maxSellBudget / BUY_RATES.users);
  const maxProjects = baseProjects + Math.floor(maxSellBudget / BUY_RATES.projects) * STEPS.projects;
  const maxStorageGb = baseStorageGb + Math.floor(maxSellBudget / BUY_RATES.storage);

  const handleReset = () => {
    setUsersDelta(0);
    setProjectsDelta(0);
    setStorageDeltaGb(0);
  };

  const handleApply = async () => {
    if (!isValid || !hasChanges) return;

    setIsLoading(true);
    try {
      const validUntil = subscriptionEndDate
        ? new Date(subscriptionEndDate).toISOString()
        : new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString();

      const payload = {
        organization_id: organizationId,
        users_delta: usersDelta,
        projects_delta: projectsDelta,
        storage_delta_gb: storageDeltaGb,
        points_earned: pointsEarned,
        points_spent: pointsSpent,
        valid_until: validUntil,
        updated_at: new Date().toISOString(),
      };

      if (existingOverride) {
        await supabase
          .from('resource_overrides')
          .update(payload)
          .eq('id', existingOverride.id);
      } else {
        await supabase
          .from('resource_overrides')
          .insert(payload);
      }

      setExistingOverride({ ...existingOverride, ...payload });
      onApplied?.();
    } catch (err) {
      console.error('Error applying resource swap:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveOverride = async () => {
    if (!existingOverride) return;
    if (!confirm('Сбросить обмен ресурсов? Лимиты вернутся к базовым значениям тарифа.')) return;

    setIsLoading(true);
    try {
      await supabase
        .from('resource_overrides')
        .delete()
        .eq('id', existingOverride.id);

      setExistingOverride(null);
      handleReset();
      onApplied?.();
    } catch (err) {
      console.error('Error removing override:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const SliderCard = useCallback(({
    icon: Icon, label, color, bgColor,
    baseValue, adjustedValue, minValue, maxValue, step, delta, unit,
    onChange,
  }: {
    icon: any; label: string; color: string; bgColor: string;
    baseValue: number; adjustedValue: number; minValue: number; maxValue: number; step: number; delta: number; unit: string;
    onChange: (val: number) => void;
  }) => {
    const percentage = baseValue > 0 ? Math.round((adjustedValue / baseValue - 1) * 100) : 0;
    const isBelow = delta < 0;
    const isAbove = delta > 0;

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgColor}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-slate-800 text-sm">{label}</h4>
            <p className="text-xs text-slate-400">Базовый: {baseValue} {unit}</p>
          </div>
        </div>

        <div className="text-center mb-3">
          <div className="flex items-center justify-center gap-2">
            <span className={`text-3xl font-bold transition-all duration-300 ${
              isBelow ? 'text-amber-600' : isAbove ? 'text-emerald-600' : 'text-slate-800'
            }`}>
              {adjustedValue}
            </span>
            <span className="text-sm text-slate-400">{unit}</span>
          </div>
          {delta !== 0 && (
            <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${
              isBelow
                ? 'bg-amber-50 text-amber-600'
                : 'bg-emerald-50 text-emerald-600'
            }`}>
              {delta > 0 ? '+' : ''}{delta} ({percentage > 0 ? '+' : ''}{percentage}%)
            </span>
          )}
        </div>

        <div className="relative px-1">
          <div className="relative h-8 flex items-center">
            <div className="absolute inset-x-0 h-2 bg-slate-100 rounded-full" />

            {baseValue > minValue && maxValue > minValue && (
              <div
                className="absolute h-2 bg-slate-300 rounded-full opacity-50"
                style={{
                  left: '0%',
                  width: `${Math.min(((baseValue - minValue) / (maxValue - minValue)) * 100, 100)}%`,
                }}
              />
            )}

            {adjustedValue > minValue && maxValue > minValue && (
              <div
                className={`absolute h-2 rounded-full transition-all duration-200 ${
                  isBelow ? 'bg-amber-400' : isAbove ? 'bg-emerald-400' : 'bg-blue-400'
                }`}
                style={{
                  left: '0%',
                  width: `${Math.min(((adjustedValue - minValue) / (maxValue - minValue)) * 100, 100)}%`,
                }}
              />
            )}

            <input
              type="range"
              min={minValue}
              max={maxValue}
              step={step}
              value={adjustedValue}
              onChange={(e) => onChange(Number(e.target.value) - baseValue)}
              className="absolute inset-x-0 h-8 w-full opacity-0 cursor-pointer z-10"
            />

            {maxValue > minValue && (
              <div
                className={`absolute w-6 h-6 rounded-full border-2 shadow-md bg-white transition-all duration-200 pointer-events-none z-20 ${
                  isBelow ? 'border-amber-400' : isAbove ? 'border-emerald-400' : 'border-blue-400'
                }`}
                style={{
                  left: `calc(${((adjustedValue - minValue) / (maxValue - minValue)) * 100}% - 12px)`,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <ArrowLeftRight className="w-3 h-3 text-slate-400" />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-medium">
            <span>{minValue}</span>
            <span>{maxValue} {unit}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px]">
          {isBelow && (
            <span className="text-amber-600 font-bold">
              Отдаете: +{(Math.abs(delta) * (label === 'Пользователи' ? SELL_RATES.users : label === 'Проекты' ? SELL_RATES.projects : SELL_RATES.storage)).toFixed(1)} баллов
            </span>
          )}
          {isAbove && (
            <span className="text-emerald-600 font-bold">
              Получаете: -{(delta * (label === 'Пользователи' ? BUY_RATES.users : label === 'Проекты' ? BUY_RATES.projects : BUY_RATES.storage)).toFixed(1)} баллов
            </span>
          )}
          {delta === 0 && <span className="text-slate-400">Без изменений</span>}
        </div>
      </div>
    );
  }, []);

  const isEligible = ['STARTER', 'PROFESSIONAL'].includes(planName.toUpperCase());

  if (!isEligible) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <ArrowLeftRight className="w-5 h-5 text-slate-400" />
          <div>
            <h3 className="font-semibold text-slate-700">Обмен ресурсов</h3>
            <p className="text-sm text-slate-500 mt-1">
              {planName.toUpperCase() === 'FREE'
                ? 'Обмен ресурсов доступен начиная с тарифа Starter'
                : 'На тарифе Enterprise все ресурсы безлимитны'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-blue-600" />
            Обмен ресурсов
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Увеличивайте то, чем пользуетесь чаще
          </p>
        </div>
        {existingOverride && (
          <button
            onClick={handleRemoveOverride}
            disabled={isLoading}
            className="text-xs font-medium text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Сбросить обмен
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
        <SliderCard
          icon={Users}
          label="Пользователи"
          color="text-blue-600"
          bgColor="bg-blue-100"
          baseValue={baseUsers}
          adjustedValue={adjustedUsers}
          minValue={minUsers}
          maxValue={maxUsers}
          step={STEPS.users}
          delta={usersDelta}
          unit=""
          onChange={setUsersDelta}
        />
        <SliderCard
          icon={Briefcase}
          label="Проекты"
          color="text-teal-600"
          bgColor="bg-teal-100"
          baseValue={baseProjects}
          adjustedValue={adjustedProjects}
          minValue={minProjects}
          maxValue={maxProjects}
          step={STEPS.projects}
          delta={projectsDelta}
          unit=""
          onChange={setProjectsDelta}
        />
        <SliderCard
          icon={HardDrive}
          label="Хранилище"
          color="text-amber-600"
          bgColor="bg-amber-100"
          baseValue={baseStorageGb}
          adjustedValue={adjustedStorageGb}
          minValue={minStorageGb}
          maxValue={maxStorageGb}
          step={STEPS.storage}
          delta={storageDeltaGb}
          unit="ГБ"
          onChange={setStorageDeltaGb}
        />
      </div>

      {hasChanges && (
        <div className={`rounded-xl p-4 mb-4 transition-all ${
          isValid ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isValid ? 'bg-blue-100' : 'bg-red-100'
              }`}>
                {isValid ? (
                  <Check className="w-5 h-5 text-blue-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  Баланс баллов: {pointsBalance.toFixed(1)}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Заработано: +{pointsEarned.toFixed(1)} / Потрачено: -{pointsSpent.toFixed(1)}
                </div>
              </div>
            </div>

            {!isValid && (
              <span className="text-xs font-medium text-red-600">
                Недостаточно баллов. Уменьшите потребление или отдайте больше ресурсов.
              </span>
            )}
          </div>
        </div>
      )}

      {hasChanges && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleApply}
            disabled={!isValid || isLoading}
            className="flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <ArrowLeftRight className="w-4 h-4" />
                Обменять
              </>
            )}
          </button>
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="flex-1 py-3 rounded-xl font-bold text-sm transition-all bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            Отмена
          </button>
        </div>
      )}

      {subscriptionEndDate && existingOverride && (
        <p className="text-[10px] text-slate-400 mt-3 text-center">
          Обменная конфигурация действует до {new Date(subscriptionEndDate).toLocaleDateString('ru-RU')}.
          В новом периоде лимиты сбросятся к базовым значениям тарифа.
        </p>
      )}
    </div>
  );
};

export default ResourceSwap;
