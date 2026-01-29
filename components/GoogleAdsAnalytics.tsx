import React, { useEffect, useState } from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getGoogleAdsAccountStats, getGoogleAdsAccounts, validateGoogleAdsToken, GoogleAdsAccountStats, GoogleAdsAccount } from '../services/googleAdsDirectService';
import { supabase } from '../lib/supabase';
import { TrendingUp, TrendingDown, DollarSign, MousePointerClick, Eye, Target, Settings } from 'lucide-react';

interface GoogleAdsAnalyticsProps {
    projectId: string;
    accessToken: string;
    customerId?: string;
    onCustomerIdChange?: (customerId: string) => void;
    dateRange?: string;
    readOnly?: boolean;
}

type MetricKey = 'cost' | 'conversions' | 'cpc' | 'ctr' | 'impressions' | 'clicks' | 'costPerConversion';

interface MetricConfig {
    key: MetricKey;
    label: string;
    description: string;
}

const AVAILABLE_METRICS: MetricConfig[] = [
    { key: 'cost', label: 'Расходы', description: 'Общая сумма расходов' },
    { key: 'impressions', label: 'Показы', description: 'Количество показов' },
    { key: 'clicks', label: 'Клики', description: 'Количество кликов' },
    { key: 'ctr', label: 'CTR', description: 'Click-Through Rate' },
    { key: 'cpc', label: 'CPC', description: 'Цена за клик' },
    { key: 'conversions', label: 'Конверсии', description: 'Количество конверсий' },
    { key: 'costPerConversion', label: 'Цена за конверсию', description: 'Средняя цена за конверсию' },
];

const DEFAULT_VISIBLE_METRICS: MetricKey[] = ['cost', 'conversions', 'cpc', 'ctr', 'impressions', 'clicks'];

const GoogleAdsAnalytics: React.FC<GoogleAdsAnalyticsProps> = ({
    projectId,
    accessToken,
    customerId,
    onCustomerIdChange,
    dateRange = '30d',
    readOnly = false
}) => {
    const [stats, setStats] = useState<GoogleAdsAccountStats | null>(null);
    const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customerId || '');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showMetricsSettings, setShowMetricsSettings] = useState(false);
    const [visibleMetrics, setVisibleMetrics] = useState<MetricKey[]>(DEFAULT_VISIBLE_METRICS);

    useEffect(() => {
        const loadProjectSettings = async () => {
            try {
                const { data } = await supabase
                    .from('projects')
                    .select('google_ads_visible_metrics')
                    .eq('id', projectId)
                    .single();

                if (data?.google_ads_visible_metrics) {
                    setVisibleMetrics(data.google_ads_visible_metrics as MetricKey[]);
                }
            } catch (err) {
                console.error('Failed to load metrics settings:', err);
            }
        };

        loadProjectSettings();
    }, [projectId]);

    useEffect(() => {
        const loadAccounts = async () => {
            if (!accessToken) return;
            try {
                const accountsData = await getGoogleAdsAccounts(accessToken);
                setAccounts(accountsData);
                if (accountsData.length > 0 && !selectedCustomerId) {
                    const defaultCustomerId = customerId || accountsData[0].customerId;
                    setSelectedCustomerId(defaultCustomerId);
                }
            } catch (err) {
                console.error('Error loading accounts:', err);
            }
        };
        loadAccounts();
    }, [accessToken, customerId]);

    useEffect(() => {
        const fetchStats = async () => {
            if (!accessToken || !selectedCustomerId) return;

            setLoading(true);
            setError(null);

            try {
                const data = await getGoogleAdsAccountStats(accessToken, selectedCustomerId, dateRange);
                setStats(data);
            } catch (err) {
                setError('Ошибка загрузки данных из Google Ads');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [accessToken, selectedCustomerId, dateRange]);

    const toggleMetric = async (metricKey: MetricKey) => {
        const newMetrics = visibleMetrics.includes(metricKey)
            ? visibleMetrics.filter(m => m !== metricKey)
            : [...visibleMetrics, metricKey];

        setVisibleMetrics(newMetrics);

        try {
            await supabase
                .from('projects')
                .update({ google_ads_visible_metrics: newMetrics })
                .eq('id', projectId);
        } catch (err) {
            console.error('Failed to save metrics settings:', err);
        }
    };

    const handleCustomerIdChange = (newCustomerId: string) => {
        setSelectedCustomerId(newCustomerId);
        if (onCustomerIdChange) {
            onCustomerIdChange(newCustomerId);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
    };

    const formatNumber = (value: number) => {
        return new Intl.NumberFormat('ru-RU').format(Math.round(value));
    };

    if (loading && !stats) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                {error}
            </div>
        );
    }

    if (!stats) return null;

    return (
        <div className="space-y-6">
            {!readOnly && accounts.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Аккаунт Google Ads
                    </label>
                    <select
                        value={selectedCustomerId}
                        onChange={(e) => handleCustomerIdChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        {accounts.map((account) => (
                            <option key={account.customerId} value={account.customerId}>
                                {account.descriptiveName} ({account.customerId})
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Обзор Google Ads</h3>
                {!readOnly && (
                    <button
                        onClick={() => setShowMetricsSettings(!showMetricsSettings)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                        <Settings className="w-4 h-4" />
                        Настроить метрики
                    </button>
                )}
            </div>

            {showMetricsSettings && (
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <h4 className="font-medium mb-3">Выберите отображаемые метрики</h4>
                    <div className="grid grid-cols-2 gap-3">
                        {AVAILABLE_METRICS.map((metric) => (
                            <label key={metric.key} className="flex items-start gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={visibleMetrics.includes(metric.key)}
                                    onChange={() => toggleMetric(metric.key)}
                                    className="mt-1"
                                />
                                <div>
                                    <div className="font-medium text-sm">{metric.label}</div>
                                    <div className="text-xs text-gray-500">{metric.description}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {visibleMetrics.includes('cost') && (
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Расходы</span>
                            <DollarSign className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalCost)}</div>
                    </div>
                )}

                {visibleMetrics.includes('clicks') && (
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Клики</span>
                            <MousePointerClick className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="text-2xl font-bold">{formatNumber(stats.totalClicks)}</div>
                    </div>
                )}

                {visibleMetrics.includes('impressions') && (
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Показы</span>
                            <Eye className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="text-2xl font-bold">{formatNumber(stats.totalImpressions)}</div>
                    </div>
                )}

                {visibleMetrics.includes('conversions') && (
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Конверсии</span>
                            <Target className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="text-2xl font-bold">{formatNumber(stats.totalConversions)}</div>
                    </div>
                )}

                {visibleMetrics.includes('cpc') && (
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Средний CPC</span>
                            <DollarSign className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="text-2xl font-bold">{formatCurrency(stats.avgCpc)}</div>
                    </div>
                )}

                {visibleMetrics.includes('ctr') && (
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">CTR</span>
                            <TrendingUp className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="text-2xl font-bold">{stats.avgCtr.toFixed(2)}%</div>
                    </div>
                )}

                {visibleMetrics.includes('costPerConversion') && (
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Цена за конверсию</span>
                            <Target className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="text-2xl font-bold">{formatCurrency(stats.costPerConversion)}</div>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h4 className="font-semibold mb-4">Динамика расходов</h4>
                <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={stats.dailyStats}>
                        <defs>
                            <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                            formatter={(value: number) => formatCurrency(value)}
                            labelFormatter={(label) => new Date(label).toLocaleDateString('ru-RU')}
                        />
                        <Area type="monotone" dataKey="cost" stroke="#3b82f6" fill="url(#colorCost)" />
                        <Line type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h4 className="font-semibold mb-4">Кампании</h4>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Название</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Статус</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Расходы</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Клики</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Конверсии</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">CPC</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">CTR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.campaigns.map((campaign) => (
                                <tr key={campaign.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="py-3 px-4 text-sm">{campaign.name}</td>
                                    <td className="py-3 px-4">
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                            campaign.status === 'ENABLED'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-700'
                                        }`}>
                                            {campaign.status === 'ENABLED' ? 'Активна' : 'Приостановлена'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-right font-medium">{formatCurrency(campaign.metrics.cost)}</td>
                                    <td className="py-3 px-4 text-sm text-right">{formatNumber(campaign.metrics.clicks)}</td>
                                    <td className="py-3 px-4 text-sm text-right">{formatNumber(campaign.metrics.conversions)}</td>
                                    <td className="py-3 px-4 text-sm text-right">{formatCurrency(campaign.metrics.cpc)}</td>
                                    <td className="py-3 px-4 text-sm text-right">{campaign.metrics.ctr.toFixed(2)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default GoogleAdsAnalytics;
