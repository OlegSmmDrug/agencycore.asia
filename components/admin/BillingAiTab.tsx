import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { aiCreditService, AiModelPricing, AiPlatformSettings, AiTransaction } from '../../services/aiCreditService';
import {
  Cpu, Settings, DollarSign, Search, Building2, ArrowUpCircle,
  ArrowDownCircle, Clock, Zap, Eye, EyeOff, Save, Plus, Trash2, ToggleLeft, ToggleRight
} from 'lucide-react';

interface OrgAiOption {
  id: string;
  name: string;
  plan_name: string;
  ai_credit_balance: number;
  is_ai_enabled: boolean;
  ai_daily_limit: number | null;
}

interface Props {
  adminUserId: string;
}

const BillingAiTab: React.FC<Props> = ({ adminUserId }) => {
  const [subView, setSubView] = useState<'settings' | 'pricing' | 'balance'>('settings');
  const [settings, setSettings] = useState<AiPlatformSettings | null>(null);
  const [models, setModels] = useState<AiModelPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [organizations, setOrganizations] = useState<OrgAiOption[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrgAiOption | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isCredit, setIsCredit] = useState(true);
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [orgTransactions, setOrgTransactions] = useState<AiTransaction[]>([]);

  const [newModelSlug, setNewModelSlug] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelInputPrice, setNewModelInputPrice] = useState('');
  const [newModelOutputPrice, setNewModelOutputPrice] = useState('');
  const [showAddModel, setShowAddModel] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [s, m] = await Promise.all([
      aiCreditService.getPlatformSettings(),
      aiCreditService.getModelPricing(),
    ]);
    setSettings(s);
    setModels(m);
    setLoading(false);
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    const ok = await aiCreditService.updatePlatformSettings({
      master_api_key: settings.master_api_key,
      default_daily_limit: settings.default_daily_limit,
      low_balance_threshold_percent: settings.low_balance_threshold_percent,
      global_ai_enabled: settings.global_ai_enabled,
      credit_price_kzt: settings.credit_price_kzt,
      min_topup_credits: settings.min_topup_credits,
      cache_ttl_minutes: settings.cache_ttl_minutes,
    });
    setSaving(false);
    if (ok) alert('Настройки сохранены');
    else alert('Ошибка сохранения');
  };

  const handleModelUpdate = async (id: string, field: string, value: any) => {
    setModels(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const saveModel = async (model: AiModelPricing) => {
    const ok = await aiCreditService.updateModelPricing(model.id, {
      display_name: model.display_name,
      input_price_per_1m: model.input_price_per_1m,
      output_price_per_1m: model.output_price_per_1m,
      markup_multiplier: model.markup_multiplier,
      is_active: model.is_active,
    });
    if (ok) alert('Модель обновлена');
    else alert('Ошибка обновления');
  };

  const addModel = async () => {
    if (!newModelSlug || !newModelName) return;
    const ok = await aiCreditService.createModelPricing({
      model_slug: newModelSlug,
      display_name: newModelName,
      input_price_per_1m: parseFloat(newModelInputPrice) || 0,
      output_price_per_1m: parseFloat(newModelOutputPrice) || 0,
      markup_multiplier: 1.3,
      is_active: true,
      sort_order: models.length + 1,
    });
    if (ok) {
      setNewModelSlug('');
      setNewModelName('');
      setNewModelInputPrice('');
      setNewModelOutputPrice('');
      setShowAddModel(false);
      loadData();
    }
  };

  const searchOrganizations = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, plan_name, ai_credit_balance, is_ai_enabled, ai_daily_limit')
        .or(`name.ilike.%${searchQuery}%,slug.ilike.%${searchQuery}%`)
        .limit(10);

      setOrganizations((orgs || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        plan_name: o.plan_name || 'Free',
        ai_credit_balance: o.ai_credit_balance || 0,
        is_ai_enabled: o.is_ai_enabled || false,
        ai_daily_limit: o.ai_daily_limit,
      })));
    } finally {
      setSearching(false);
    }
  };

  const selectOrg = async (org: OrgAiOption) => {
    setSelectedOrg(org);
    const txs = await aiCreditService.getOrgTransactions(org.id, 20);
    setOrgTransactions(txs);
  };

  const handleBalanceSubmit = async () => {
    if (!selectedOrg || !amount) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Введите корректную сумму');
      return;
    }
    setBalanceSaving(true);
    try {
      let result;
      if (isCredit) {
        result = await aiCreditService.adminTopupCredits(selectedOrg.id, numAmount, reason || 'Admin top-up');
      } else {
        result = await aiCreditService.adminDeductCredits(selectedOrg.id, numAmount, reason || 'Admin deduction');
      }
      if (result.success) {
        const { data: updated } = await supabase
          .from('organizations')
          .select('ai_credit_balance, is_ai_enabled, ai_daily_limit')
          .eq('id', selectedOrg.id)
          .maybeSingle();
        if (updated) {
          setSelectedOrg({ ...selectedOrg, ai_credit_balance: updated.ai_credit_balance || 0 });
        }
        setAmount('');
        setReason('');
        const txs = await aiCreditService.getOrgTransactions(selectedOrg.id, 20);
        setOrgTransactions(txs);
        alert(isCredit ? 'Кредиты зачислены!' : 'Кредиты списаны!');
      } else {
        alert(result.error || 'Ошибка');
      }
    } finally {
      setBalanceSaving(false);
    }
  };

  const toggleOrgAi = async (org: OrgAiOption) => {
    const newVal = !org.is_ai_enabled;
    await supabase.from('organizations').update({ is_ai_enabled: newVal }).eq('id', org.id);
    setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, is_ai_enabled: newVal } : o));
    if (selectedOrg?.id === org.id) {
      setSelectedOrg({ ...org, is_ai_enabled: newVal });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'settings' as const, label: 'Настройки', icon: <Settings className="w-4 h-4" /> },
          { key: 'pricing' as const, label: 'Тарифы моделей', icon: <Cpu className="w-4 h-4" /> },
          { key: 'balance' as const, label: 'Баланс AI', icon: <DollarSign className="w-4 h-4" /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setSubView(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              subView === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {subView === 'settings' && settings && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-500" />
              Настройки платформы AI
            </h3>
            <p className="text-sm text-slate-500 mt-1">Глобальные настройки для всех организаций</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Master API Key (Anthropic)</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={settings.master_api_key}
                  onChange={e => setSettings({ ...settings, master_api_key: e.target.value })}
                  placeholder="sk-ant-api..."
                  className="w-full pr-10 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Единый ключ Anthropic для всей платформы</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Глобальный AI</label>
                <p className="text-[11px] text-slate-400">Включение/выключение AI для всей платформы</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, global_ai_enabled: !settings.global_ai_enabled })}
                className={`p-2 rounded-lg transition-colors ${settings.global_ai_enabled ? 'text-emerald-600' : 'text-slate-400'}`}
              >
                {settings.global_ai_enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Дневной лимит (кредитов)</label>
              <input
                type="number"
                value={settings.default_daily_limit}
                onChange={e => setSettings({ ...settings, default_daily_limit: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Максимальный расход AI кредитов на 1 организацию в день</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Цена 1 кредита (KZT)</label>
              <input
                type="number"
                value={settings.credit_price_kzt}
                onChange={e => setSettings({ ...settings, credit_price_kzt: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Курс конвертации KZT баланса в AI кредиты</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Мин. пополнение (кредитов)</label>
              <input
                type="number"
                value={settings.min_topup_credits}
                onChange={e => setSettings({ ...settings, min_topup_credits: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Порог низкого баланса (%)</label>
              <input
                type="number"
                value={settings.low_balance_threshold_percent}
                onChange={e => setSettings({ ...settings, low_balance_threshold_percent: parseInt(e.target.value) || 10 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </div>
      )}

      {subView === 'pricing' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Тарифы AI моделей</h3>
              <p className="text-sm text-slate-500">Цены за 1 млн. токенов (в кредитах)</p>
            </div>
            <button
              onClick={() => setShowAddModel(!showAddModel)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Добавить модель
            </button>
          </div>

          {showAddModel && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <h4 className="text-sm font-bold text-blue-800 mb-3">Новая модель</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input
                  value={newModelSlug}
                  onChange={e => setNewModelSlug(e.target.value)}
                  placeholder="model-slug"
                  className="border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <input
                  value={newModelName}
                  onChange={e => setNewModelName(e.target.value)}
                  placeholder="Display Name"
                  className="border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  value={newModelInputPrice}
                  onChange={e => setNewModelInputPrice(e.target.value)}
                  placeholder="Input $/1M"
                  className="border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  value={newModelOutputPrice}
                  onChange={e => setNewModelOutputPrice(e.target.value)}
                  placeholder="Output $/1M"
                  className="border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={addModel}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Добавить
              </button>
            </div>
          )}

          <div className="space-y-3">
            {models.map(model => (
              <div key={model.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Cpu className={`w-5 h-5 ${model.is_active ? 'text-emerald-500' : 'text-slate-300'}`} />
                    <div>
                      <p className="text-sm font-bold text-slate-800">{model.display_name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{model.model_slug}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleModelUpdate(model.id, 'is_active', !model.is_active)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                      model.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {model.is_active ? 'Активна' : 'Неактивна'}
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Input / 1M</label>
                    <input
                      type="number"
                      step="0.01"
                      value={model.input_price_per_1m}
                      onChange={e => handleModelUpdate(model.id, 'input_price_per_1m', parseFloat(e.target.value) || 0)}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Output / 1M</label>
                    <input
                      type="number"
                      step="0.01"
                      value={model.output_price_per_1m}
                      onChange={e => handleModelUpdate(model.id, 'output_price_per_1m', parseFloat(e.target.value) || 0)}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Наценка (x)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={model.markup_multiplier}
                      onChange={e => handleModelUpdate(model.id, 'markup_multiplier', parseFloat(e.target.value) || 1)}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => saveModel(model)}
                      className="w-full px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      Сохранить
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  Итоговая цена: Input = {(model.input_price_per_1m * model.markup_multiplier).toFixed(2)}/1M,
                  Output = {(model.output_price_per_1m * model.markup_multiplier).toFixed(2)}/1M
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {subView === 'balance' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Поиск организации</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchOrganizations()}
                    placeholder="Название компании..."
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
                <button
                  onClick={searchOrganizations}
                  disabled={searching}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  {searching ? '...' : 'Найти'}
                </button>
              </div>

              {organizations.length > 0 && (
                <div className="mt-3 space-y-1.5 max-h-48 overflow-auto">
                  {organizations.map(org => (
                    <button
                      key={org.id}
                      onClick={() => selectOrg(org)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                        selectedOrg?.id === org.id
                          ? 'bg-blue-50 border border-blue-300'
                          : 'bg-slate-50 hover:bg-slate-100 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-800">{org.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${org.is_ai_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                            {org.is_ai_enabled ? 'AI Вкл' : 'AI Выкл'}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-slate-700">{org.ai_credit_balance.toFixed(2)} кр.</span>
                      </div>
                      <div className="flex items-center justify-between mt-1 ml-6">
                        <span className="text-xs text-slate-500">Тариф: {org.plan_name}</span>
                        <button
                          onClick={e => { e.stopPropagation(); toggleOrgAi(org); }}
                          className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                            org.is_ai_enabled ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                          }`}
                        >
                          {org.is_ai_enabled ? 'Выключить AI' : 'Включить AI'}
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedOrg && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-slate-800">{selectedOrg.name}</h4>
                    <p className="text-xs text-slate-500">
                      AI: {selectedOrg.is_ai_enabled ? 'Включено' : 'Выключено'}
                      {selectedOrg.ai_daily_limit && ` | Лимит: ${selectedOrg.ai_daily_limit} кр./день`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">AI Баланс</p>
                    <p className="text-xl font-bold text-slate-800">{selectedOrg.ai_credit_balance.toFixed(2)} <span className="text-sm font-normal text-slate-500">кр.</span></p>
                  </div>
                </div>

                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setIsCredit(true)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                      isCredit ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    Зачислить
                  </button>
                  <button
                    onClick={() => setIsCredit(false)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                      !isCredit ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <ArrowDownCircle className="w-4 h-4" />
                    Списать
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Сумма (кредитов)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-lg font-bold focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex gap-2 mt-2">
                      {[100, 500, 1000, 5000].map(v => (
                        <button
                          key={v}
                          onClick={() => setAmount(v.toString())}
                          className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          {v.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Причина</label>
                    <input
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="Например: Бонус за подключение"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleBalanceSubmit}
                    disabled={balanceSaving || !amount}
                    className={`w-full py-3 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                      isCredit ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                    } disabled:opacity-50`}
                  >
                    <DollarSign className="w-4 h-4" />
                    {balanceSaving ? 'Обработка...' : isCredit ? 'Зачислить кредиты' : 'Списать кредиты'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <h4 className="text-sm font-bold text-slate-800">
                {selectedOrg ? `AI операции: ${selectedOrg.name}` : 'Выберите организацию'}
              </h4>
            </div>
            {orgTransactions.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                {selectedOrg ? 'AI операций пока нет' : 'Выберите организацию для просмотра'}
              </div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-[500px] overflow-auto">
                {orgTransactions.map(tx => {
                  const isTopup = tx.model_slug === 'topup' || tx.model_slug === 'purchase' || tx.model_slug === 'admin_deduct';
                  return (
                    <div key={tx.id} className="px-5 py-3 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                              isTopup && tx.markup_cost < 0 ? 'text-emerald-600' : 'text-red-500'
                            }`}>
                              {isTopup && tx.markup_cost < 0 ? (
                                <><ArrowUpCircle className="w-3 h-3" />+{Math.abs(tx.markup_cost).toFixed(4)}</>
                              ) : (
                                <><ArrowDownCircle className="w-3 h-3" />-{tx.markup_cost.toFixed(4)}</>
                              )}
                              {' '}кр.
                            </span>
                            {!isTopup && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                                {tx.model_slug}
                              </span>
                            )}
                          </div>
                          {!isTopup && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              In: {tx.input_tokens.toLocaleString()} | Out: {tx.output_tokens.toLocaleString()}
                            </p>
                          )}
                          {tx.request_summary && (
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">{tx.request_summary}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="text-[10px] text-slate-400">
                            {new Date(tx.created_at).toLocaleDateString('ru-RU')}{' '}
                            {new Date(tx.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {tx.balance_before.toFixed(2)} {'\u2192'} {tx.balance_after.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingAiTab;
