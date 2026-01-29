import React, { useEffect, useState } from 'react';
import {
    ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { getAdAccountStats, getAdCampaigns, getAdAccounts, getAdSets, getAds } from '../services/facebookAdsService';
import { AdAccountStats, AdCampaign, AdAccount, AdSet, Ad } from '../types';
import { supabase } from '../lib/supabase';

interface AdsAnalyticsProps {
    projectId: string;
    accessToken: string;
    adAccountId?: string;
    onAdAccountChange?: (accountId: string) => void;
    dateRange?: string;
    readOnly?: boolean;
}

type ViewLevel = 'account' | 'campaign' | 'adset' | 'ad';

type MetricKey = 'spend' | 'leads' | 'cpl' | 'messages' | 'roas' | 'impressions' | 'clicks' | 'ctr' | 'cpm' | 'frequency';

interface MetricConfig {
    key: MetricKey;
    label: string;
    description: string;
    requiresData?: (stats: AdAccountStats) => boolean;
}

const AVAILABLE_METRICS: MetricConfig[] = [
    { key: 'spend', label: 'Расходы', description: 'Общая сумма потраченных средств' },
    { key: 'impressions', label: 'Показы', description: 'Количество показов рекламы' },
    { key: 'clicks', label: 'Клики', description: 'Количество кликов по рекламе' },
    { key: 'ctr', label: 'CTR', description: 'Click-Through Rate (Кликабельность)' },
    { key: 'cpm', label: 'CPM', description: 'Цена за 1000 показов' },
    { key: 'leads', label: 'Лиды', description: 'Количество полученных лидов', requiresData: (stats) => stats.totalLeads > 0 },
    { key: 'cpl', label: 'CPL', description: 'Цена за лид', requiresData: (stats) => stats.totalLeads > 0 },
    { key: 'messages', label: 'Сообщения', description: 'Количество сообщений в мессенджерах', requiresData: (stats) => (stats.totalMessagingConversations || 0) > 0 },
    { key: 'roas', label: 'ROAS', description: 'Return on Ad Spend', requiresData: (stats) => stats.totalLeads > 0 },
    { key: 'frequency', label: 'Частота', description: 'Среднее количество показов на пользователя' },
];

const DEFAULT_VISIBLE_METRICS: MetricKey[] = ['spend', 'leads', 'cpl', 'messages', 'roas'];

const AdsAnalytics: React.FC<AdsAnalyticsProps> = ({
    projectId,
    accessToken,
    adAccountId,
    onAdAccountChange,
    dateRange = '30d',
    readOnly = false
}) => {
    const [stats, setStats] = useState<AdAccountStats | null>(null);
    const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
    const [adSets, setAdSets] = useState<AdSet[]>([]);
    const [ads, setAds] = useState<Ad[]>([]);
    const [accounts, setAccounts] = useState<AdAccount[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>(adAccountId || '');
    const [selectedCampaign, setSelectedCampaign] = useState<string>('');
    const [selectedAdSet, setSelectedAdSet] = useState<string>('');
    const [selectedAd, setSelectedAd] = useState<string>('');
    const [viewLevel, setViewLevel] = useState<ViewLevel>('account');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDateRange, setSelectedDateRange] = useState(dateRange);
    const [showCustomDate, setShowCustomDate] = useState(false);
    const [customDateFrom, setCustomDateFrom] = useState('');
    const [customDateTo, setCustomDateTo] = useState('');
    const [showMetricsSettings, setShowMetricsSettings] = useState(false);
    const [visibleMetrics, setVisibleMetrics] = useState<MetricKey[]>(DEFAULT_VISIBLE_METRICS);
    const [metricsLoaded, setMetricsLoaded] = useState(false);

    useEffect(() => {
        const loadProjectSettings = async () => {
            try {
                const { data, error } = await supabase
                    .from('projects')
                    .select('fb_ads_visible_metrics')
                    .eq('id', projectId)
                    .single();

                if (data && data.fb_ads_visible_metrics) {
                    setVisibleMetrics(data.fb_ads_visible_metrics as MetricKey[]);
                }
            } catch (err) {
                console.error('Failed to load metrics settings:', err);
            } finally {
                setMetricsLoaded(true);
            }
        };

        loadProjectSettings();
    }, [projectId]);

    useEffect(() => {
        const loadAccounts = async () => {
            if (!accessToken) return;
            const accountsData = await getAdAccounts(accessToken);
            setAccounts(accountsData);
            if (accountsData.length > 0 && !selectedAccount) {
                const defaultAccount = adAccountId || accountsData[0].id;
                setSelectedAccount(defaultAccount);
            }
        };
        loadAccounts();
    }, [accessToken, adAccountId]);

    const toggleMetric = async (metricKey: MetricKey) => {
        const newMetrics = visibleMetrics.includes(metricKey)
            ? visibleMetrics.filter(m => m !== metricKey)
            : [...visibleMetrics, metricKey];

        setVisibleMetrics(newMetrics);

        try {
            await supabase
                .from('projects')
                .update({ fb_ads_visible_metrics: newMetrics })
                .eq('id', projectId);
        } catch (err) {
            console.error('Failed to save metrics settings:', err);
        }
    };

    const isMetricVisible = (metricKey: MetricKey): boolean => {
        return visibleMetrics.includes(metricKey);
    };

    const getAvailableMetrics = (): MetricConfig[] => {
        if (!stats) return AVAILABLE_METRICS;
        return AVAILABLE_METRICS.filter(metric => {
            if (!metric.requiresData) return true;
            return metric.requiresData(stats);
        });
    };

    useEffect(() => {
        const loadData = async () => {
            if (!accessToken || !selectedAccount) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const config = { accessToken, adAccountId: selectedAccount };
                const [statsData, campaignsData] = await Promise.all([
                    getAdAccountStats(config, selectedDateRange),
                    getAdCampaigns(config, selectedDateRange)
                ]);

                if (statsData) {
                    setStats(statsData);
                    setCampaigns(campaignsData);
                } else {
                    setError('Не удалось загрузить данные. Проверьте токен доступа.');
                }
            } catch (err) {
                console.error("Failed to load ads data", err);
                setError('Ошибка при загрузке данных рекламного кабинета');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [accessToken, selectedAccount, selectedDateRange]);

    useEffect(() => {
        const loadAdSets = async () => {
            if (!selectedCampaign || !accessToken || !selectedAccount) {
                setAdSets([]);
                return;
            }

            try {
                const config = { accessToken, adAccountId: selectedAccount };
                const adSetsData = await getAdSets(config, selectedCampaign, selectedDateRange);
                setAdSets(adSetsData);
            } catch (err) {
                console.error("Failed to load ad sets", err);
            }
        };
        loadAdSets();
    }, [selectedCampaign, accessToken, selectedAccount, selectedDateRange]);

    useEffect(() => {
        const loadAds = async () => {
            if (!selectedAdSet || !accessToken || !selectedAccount) {
                setAds([]);
                return;
            }

            try {
                const config = { accessToken, adAccountId: selectedAccount };
                const adsData = await getAds(config, selectedAdSet, selectedDateRange);
                setAds(adsData);
            } catch (err) {
                console.error("Failed to load ads", err);
            }
        };
        loadAds();
    }, [selectedAdSet, accessToken, selectedAccount, selectedDateRange]);

    const handleAccountChange = (accountId: string) => {
        setSelectedAccount(accountId);
        setSelectedCampaign('');
        setSelectedAdSet('');
        setSelectedAd('');
        setViewLevel('account');
        if (onAdAccountChange) {
            onAdAccountChange(accountId);
        }
    };

    const handleCampaignSelect = (campaignId: string) => {
        setSelectedCampaign(campaignId);
        setSelectedAdSet('');
        setSelectedAd('');
        setViewLevel('campaign');
    };

    const handleAdSetSelect = (adSetId: string) => {
        setSelectedAdSet(adSetId);
        setSelectedAd('');
        setViewLevel('adset');
    };

    const handleAdSelect = (adId: string) => {
        setSelectedAd(adId);
        setViewLevel('ad');
    };

    const resetToAccount = () => {
        setSelectedCampaign('');
        setSelectedAdSet('');
        setSelectedAd('');
        setViewLevel('account');
    };

    const getSelectedCampaignData = () => campaigns.find(c => c.id === selectedCampaign);
    const getSelectedAdSetData = () => adSets.find(a => a.id === selectedAdSet);
    const getSelectedAdData = () => ads.find(a => a.id === selectedAd);

    const hasMessagingObjective = () => {
        const campaign = getSelectedCampaignData();
        return campaign?.objective?.includes('MESSAGES') || false;
    };

    const hasLeadObjective = () => {
        const campaign = getSelectedCampaignData();
        return campaign?.objective?.includes('LEAD') || false;
    };

    const hasTrafficObjective = () => {
        const campaign = getSelectedCampaignData();
        return campaign?.objective?.includes('TRAFFIC') || campaign?.objective?.includes('LINK_CLICKS') || false;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium">Синхронизация с Ads Manager...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h3 className="font-bold text-red-800 mb-1">Ошибка загрузки</h3>
                <p className="text-red-600 text-sm">{error}</p>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
                <p className="text-slate-500">Нет данных для отображения</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header with breadcrumbs */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center space-x-3 flex-1">
                        <div className="w-10 h-10 bg-[#1877F2] rounded-lg flex items-center justify-center text-white font-bold text-xl">
                            f
                        </div>
                        <div className="flex-1">
                            {!readOnly && accounts.length > 1 ? (
                                <select
                                    value={selectedAccount}
                                    onChange={(e) => handleAccountChange(e.target.value)}
                                    className="font-bold text-slate-800 bg-transparent border-none focus:ring-0 cursor-pointer"
                                >
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <h3 className="font-bold text-slate-800">
                                    {accounts.find(acc => acc.id === selectedAccount)?.name || accounts[0]?.name || selectedAccount}
                                </h3>
                            )}

                            {/* Breadcrumbs */}
                            <div className="flex items-center space-x-1 text-xs mt-1">
                                <button
                                    onClick={resetToAccount}
                                    className="text-blue-600 hover:underline font-medium"
                                >
                                    Аккаунт
                                </button>
                                {selectedCampaign && (
                                    <>
                                        <span className="text-slate-400">/</span>
                                        <button
                                            onClick={() => {
                                                setSelectedAdSet('');
                                                setSelectedAd('');
                                                setViewLevel('campaign');
                                            }}
                                            className="text-blue-600 hover:underline font-medium truncate max-w-[150px]"
                                        >
                                            {getSelectedCampaignData()?.name}
                                        </button>
                                    </>
                                )}
                                {selectedAdSet && (
                                    <>
                                        <span className="text-slate-400">/</span>
                                        <button
                                            onClick={() => {
                                                setSelectedAd('');
                                                setViewLevel('adset');
                                            }}
                                            className="text-blue-600 hover:underline font-medium truncate max-w-[150px]"
                                        >
                                            {getSelectedAdSetData()?.name}
                                        </button>
                                    </>
                                )}
                                {selectedAd && (
                                    <>
                                        <span className="text-slate-400">/</span>
                                        <span className="text-slate-600 font-medium truncate max-w-[150px]">
                                            {getSelectedAdData()?.name}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Date Range Selector */}
                    <div className="flex flex-wrap items-center gap-2">
                        {['7d', '14d', '30d'].map((range) => (
                            <button
                                key={range}
                                onClick={() => {
                                    setSelectedDateRange(range);
                                    setShowCustomDate(false);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                    selectedDateRange === range && !showCustomDate
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {range === '7d' ? '7 дней' : range === '14d' ? '14 дней' : '30 дней'}
                            </button>
                        ))}
                        <button
                            onClick={() => setShowCustomDate(!showCustomDate)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                showCustomDate
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Свой период
                        </button>
                        <button
                            onClick={() => setShowMetricsSettings(!showMetricsSettings)}
                            className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            title="Настроить отображаемые метрики"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                        </button>
                    </div>
                </div>

                {showCustomDate && (
                    <div className="mt-4 p-3 bg-slate-50 rounded-lg flex gap-3 items-end">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Дата начала</label>
                            <input
                                type="date"
                                value={customDateFrom}
                                onChange={(e) => setCustomDateFrom(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Дата окончания</label>
                            <input
                                type="date"
                                value={customDateTo}
                                onChange={(e) => setCustomDateTo(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm"
                            />
                        </div>
                        <button
                            onClick={() => {
                                if (customDateFrom && customDateTo) {
                                    setSelectedDateRange('custom');
                                }
                            }}
                            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all"
                        >
                            Применить
                        </button>
                    </div>
                )}

                {showMetricsSettings && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg border-2 border-blue-200">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-slate-800">Отображаемые метрики</h4>
                            <button
                                onClick={() => setShowMetricsSettings(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">Выберите, какие показатели вы хотите видеть в статистике</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {getAvailableMetrics().map((metric) => (
                                <label
                                    key={metric.key}
                                    className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                        isMetricVisible(metric.key)
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isMetricVisible(metric.key)}
                                        onChange={() => toggleMetric(metric.key)}
                                        className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <div className="flex-1">
                                        <div className="font-bold text-sm text-slate-800">{metric.label}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">{metric.description}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Account Level Stats */}
            {viewLevel === 'account' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {isMetricVisible('spend') && (
                            <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Расходы</p>
                                    <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{selectedDateRange}</span>
                                </div>
                                <p className="text-2xl font-bold text-slate-800">${stats.totalSpend.toLocaleString()}</p>
                                <p className="text-xs text-slate-400 mt-1">Всего потрачено</p>
                            </div>
                        )}

                        {isMetricVisible('impressions') && (
                            <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Показы</p>
                                </div>
                                <p className="text-2xl font-bold text-slate-800">{(stats.totalImpressions || 0).toLocaleString()}</p>
                                <p className="text-xs text-slate-400 mt-1">Охват рекламы</p>
                            </div>
                        )}

                        {isMetricVisible('clicks') && (
                            <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Клики</p>
                                </div>
                                <p className="text-2xl font-bold text-slate-800">{(stats.totalClicks || 0).toLocaleString()}</p>
                                <p className="text-xs text-slate-400 mt-1">Переходов по ссылкам</p>
                            </div>
                        )}

                        {isMetricVisible('ctr') && (
                            <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">CTR</p>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${stats.ctr > 2 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {stats.ctr > 2 ? 'Хорошо' : 'Норма'}
                                    </span>
                                </div>
                                <p className="text-2xl font-bold text-slate-800">{stats.ctr.toFixed(2)}%</p>
                                <p className="text-xs text-slate-400 mt-1">Кликабельность</p>
                            </div>
                        )}

                        {isMetricVisible('cpm') && (
                            <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">CPM</p>
                                </div>
                                <p className="text-2xl font-bold text-slate-800">${stats.cpm.toFixed(2)}</p>
                                <p className="text-xs text-slate-400 mt-1">Цена за 1000 показов</p>
                            </div>
                        )}

                        {isMetricVisible('leads') && stats.totalLeads > 0 && (
                            <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Лиды</p>
                                    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                </div>
                                <p className="text-2xl font-bold text-slate-800">{stats.totalLeads}</p>
                                <p className="text-xs text-slate-400 mt-1">Полученных лидов</p>
                            </div>
                        )}

                        {isMetricVisible('cpl') && stats.totalLeads > 0 && (
                            <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">CPL</p>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${stats.averageCpl < 20 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {stats.averageCpl < 20 ? 'Отлично' : 'Норма'}
                                    </span>
                                </div>
                                <p className="text-2xl font-bold text-slate-800">${stats.averageCpl.toFixed(2)}</p>
                                <p className="text-xs text-slate-400 mt-1">Цена за лид</p>
                            </div>
                        )}

                        {isMetricVisible('messages') && (stats.totalMessagingConversations || 0) > 0 && (
                            <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Сообщения</p>
                                    <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">WhatsApp</span>
                                </div>
                                <p className="text-2xl font-bold text-slate-800">{stats.totalMessagingConversations}</p>
                                <p className="text-xs text-slate-400 mt-1">Цена: ${(stats.costPerMessagingConversation || 0).toFixed(2)}</p>
                            </div>
                        )}

                        {isMetricVisible('roas') && stats.totalLeads > 0 && (
                            <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">ROAS</p>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${stats.averageRoas > 3 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {stats.averageRoas > 3 ? 'Отлично' : 'Норма'}
                                    </span>
                                </div>
                                <p className={`text-2xl font-bold ${stats.averageRoas > 3 ? 'text-green-600' : 'text-slate-800'}`}>
                                    {stats.averageRoas.toFixed(2)}x
                                </p>
                                <p className="text-xs text-slate-400 mt-1">Цель: 3.0x</p>
                            </div>
                        )}

                        {isMetricVisible('frequency') && (stats.totalImpressions || 0) > 0 && (
                            <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Частота</p>
                                </div>
                                <p className="text-2xl font-bold text-slate-800">
                                    {((stats.totalImpressions || 0) / Math.max((stats.totalClicks || 1), 1)).toFixed(2)}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">Показов на клик</p>
                            </div>
                        )}
                    </div>

                    {/* Chart */}
                    <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 mb-6">Динамика расходов и результатов</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={stats.dailyStats}>
                                    <defs>
                                        <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'white',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                        }}
                                    />
                                    <Area
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="spend"
                                        fill="url(#colorSpend)"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        name="Расходы ($)"
                                    />
                                    {stats.totalLeads > 0 && (
                                        <Line
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="leads"
                                            stroke="#10b981"
                                            strokeWidth={3}
                                            dot={{ fill: '#10b981', r: 4 }}
                                            name="Лиды"
                                        />
                                    )}
                                    {(stats.totalMessagingConversations || 0) > 0 && (
                                        <Line
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="messaging_conversations"
                                            stroke="#8b5cf6"
                                            strokeWidth={3}
                                            dot={{ fill: '#8b5cf6', r: 4 }}
                                            name="Сообщения"
                                        />
                                    )}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Campaigns List */}
                    <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Кампании</h3>
                            <span className="text-sm text-slate-500">{campaigns.length} активных</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Название</th>
                                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Цель</th>
                                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Расходы</th>
                                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Показы</th>
                                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Клики</th>
                                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">CTR</th>
                                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Результаты</th>
                                        <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Статус</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {campaigns.map((campaign) => (
                                        <tr
                                            key={campaign.id}
                                            className="hover:bg-slate-50 cursor-pointer transition-colors"
                                            onClick={() => handleCampaignSelect(campaign.id)}
                                        >
                                            <td className="py-4 px-4">
                                                <p className="font-semibold text-slate-800 text-sm">{campaign.name}</p>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                                                    {campaign.objective || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-right font-bold text-slate-800">${campaign.spend.toFixed(2)}</td>
                                            <td className="py-4 px-4 text-right text-slate-600">{campaign.impressions.toLocaleString()}</td>
                                            <td className="py-4 px-4 text-right text-slate-600">{campaign.clicks.toLocaleString()}</td>
                                            <td className="py-4 px-4 text-right text-slate-600">{campaign.ctr.toFixed(2)}%</td>
                                            <td className="py-4 px-4 text-right">
                                                {campaign.messaging_conversations_started && campaign.messaging_conversations_started > 0 ? (
                                                    <span className="font-bold text-purple-600">
                                                        {campaign.messaging_conversations_started} сообщ.
                                                    </span>
                                                ) : campaign.leads > 0 ? (
                                                    <span className="font-bold text-green-600">
                                                        {campaign.leads} лидов
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <span className={`inline-block px-2 py-1 text-xs font-bold rounded ${
                                                    campaign.status === 'ACTIVE'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {campaign.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Campaign Level - AdSets */}
            {viewLevel === 'campaign' && selectedCampaign && (
                <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Группы объявлений</h3>
                            <p className="text-sm text-slate-500">{getSelectedCampaignData()?.name}</p>
                        </div>
                        <span className="text-sm text-slate-500">{adSets.length} групп</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Название</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Расходы</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Показы</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Клики</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">CTR</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Результаты</th>
                                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Статус</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {adSets.map((adset) => (
                                    <tr
                                        key={adset.id}
                                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                                        onClick={() => handleAdSetSelect(adset.id)}
                                    >
                                        <td className="py-4 px-4">
                                            <p className="font-semibold text-slate-800 text-sm">{adset.name}</p>
                                        </td>
                                        <td className="py-4 px-4 text-right font-bold text-slate-800">${adset.spend.toFixed(2)}</td>
                                        <td className="py-4 px-4 text-right text-slate-600">{adset.impressions.toLocaleString()}</td>
                                        <td className="py-4 px-4 text-right text-slate-600">{adset.clicks.toLocaleString()}</td>
                                        <td className="py-4 px-4 text-right text-slate-600">{adset.ctr.toFixed(2)}%</td>
                                        <td className="py-4 px-4 text-right">
                                            {adset.messaging_conversations_started && adset.messaging_conversations_started > 0 ? (
                                                <span className="font-bold text-purple-600">
                                                    {adset.messaging_conversations_started} сообщ.
                                                </span>
                                            ) : adset.leads && adset.leads > 0 ? (
                                                <span className="font-bold text-green-600">
                                                    {adset.leads} лидов
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className={`inline-block px-2 py-1 text-xs font-bold rounded ${
                                                adset.status === 'ACTIVE'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {adset.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* AdSet Level - Ads */}
            {viewLevel === 'adset' && selectedAdSet && (
                <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Объявления</h3>
                            <p className="text-sm text-slate-500">{getSelectedAdSetData()?.name}</p>
                        </div>
                        <span className="text-sm text-slate-500">{ads.length} объявлений</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Название</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Расходы</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Показы</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Клики</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">CTR</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Результаты</th>
                                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Статус</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {ads.map((ad) => (
                                    <tr
                                        key={ad.id}
                                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                                        onClick={() => handleAdSelect(ad.id)}
                                    >
                                        <td className="py-4 px-4">
                                            <p className="font-semibold text-slate-800 text-sm">{ad.name}</p>
                                        </td>
                                        <td className="py-4 px-4 text-right font-bold text-slate-800">${ad.spend.toFixed(2)}</td>
                                        <td className="py-4 px-4 text-right text-slate-600">{ad.impressions.toLocaleString()}</td>
                                        <td className="py-4 px-4 text-right text-slate-600">{ad.clicks.toLocaleString()}</td>
                                        <td className="py-4 px-4 text-right text-slate-600">{ad.ctr.toFixed(2)}%</td>
                                        <td className="py-4 px-4 text-right">
                                            {ad.messaging_conversations_started && ad.messaging_conversations_started > 0 ? (
                                                <span className="font-bold text-purple-600">
                                                    {ad.messaging_conversations_started} сообщ.
                                                </span>
                                            ) : ad.leads && ad.leads > 0 ? (
                                                <span className="font-bold text-green-600">
                                                    {ad.leads} лидов
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className={`inline-block px-2 py-1 text-xs font-bold rounded ${
                                                ad.status === 'ACTIVE'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {ad.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdsAnalytics;
