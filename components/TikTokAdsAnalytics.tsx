import React, { useEffect, useState } from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getTikTokAdsStats, getTikTokAdvertisers, validateTikTokToken, TikTokAdsStats, TikTokAdvertiser } from '../services/tiktokAdsService';
import { supabase } from '../lib/supabase';
import { TrendingUp, DollarSign, MousePointerClick, Eye, Target, Play, Settings } from 'lucide-react';

interface TikTokAdsAnalyticsProps {
    projectId: string;
    accessToken: string;
    advertiserId?: string;
    onAdvertiserIdChange?: (advertiserId: string) => void;
    dateRange?: string;
    readOnly?: boolean;
}

type MetricKey = 'spend' | 'conversions' | 'cpc' | 'ctr' | 'impressions' | 'clicks' | 'videoViews' | 'costPerConversion';

interface MetricConfig {
    key: MetricKey;
    label: string;
    description: string;
}

const AVAILABLE_METRICS: MetricConfig[] = [
    { key: 'spend', label: 'Расходы', description: 'Общая сумма расходов' },
    { key: 'impressions', label: 'Показы', description: 'Количество показов' },
    { key: 'clicks', label: 'Клики', description: 'Количество кликов' },
    { key: 'ctr', label: 'CTR', description: 'Click-Through Rate' },
    { key: 'cpc', label: 'CPC', description: 'Цена за клик' },
    { key: 'conversions', label: 'Конверсии', description: 'Количество конверсий' },
    { key: 'videoViews', label: 'Просмотры видео', description: 'Количество просмотров видео' },
    { key: 'costPerConversion', label: 'Цена за конверсию', description: 'Средняя цена за конверсию' },
];

const DEFAULT_VISIBLE_METRICS: MetricKey[] = ['spend', 'conversions', 'cpc', 'ctr', 'impressions', 'clicks'];

const TikTokAdsAnalytics: React.FC<TikTokAdsAnalyticsProps> = ({
    projectId,
    accessToken,
    advertiserId,
    onAdvertiserIdChange,
    dateRange = '30d',
    readOnly = false
}) => {
    const [stats, setStats] = useState<TikTokAdsStats | null>(null);
    const [advertisers, setAdvertisers] = useState<TikTokAdvertiser[]>([]);
    const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string>(advertiserId || '');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showMetricsSettings, setShowMetricsSettings] = useState(false);
    const [visibleMetrics, setVisibleMetrics] = useState<MetricKey[]>(DEFAULT_VISIBLE_METRICS);

    useEffect(() => {
        const loadProjectSettings = async () => {
            try {
                const { data } = await supabase
                    .from('projects')
                    .select('tiktok_ads_visible_metrics')
                    .eq('id', projectId)
                    .single();

                if (data?.tiktok_ads_visible_metrics) {
                    setVisibleMetrics(data.tiktok_ads_visible_metrics as MetricKey[]);
                }
            } catch (err) {
                console.error('Failed to load metrics settings:', err);
            }
        };

        loadProjectSettings();
    }, [projectId]);

    useEffect(() => {
        const loadAdvertisers = async () => {
            if (!accessToken) return;
            try {
                const advertisersData = await getTikTokAdvertisers(accessToken);
                setAdvertisers(advertisersData);
                if (advertisersData.length > 0 && !selectedAdvertiserId) {
                    const defaultAdvertiserId = advertiserId || advertisersData[0].advertiserId;
                    setSelectedAdvertiserId(defaultAdvertiserId);
                }
            } catch (err) {
                console.error('Error loading advertisers:', err);
            }
        };
        loadAdvertisers();
    }, [accessToken, advertiserId]);

    useEffect(() => {
        const fetchStats = async () => {
            if (!accessToken || !selectedAdvertiserId) return;

            setLoading(true);
            setError(null);

            try {
                const data = await getTikTokAdsStats(accessToken, selectedAdvertiserId, dateRange);
                setStats(data);
            } catch (err) {
                setError('Ошибка загрузки данных из TikTok Ads');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [accessToken, selectedAdvertiserId, dateRange]);

    const toggleMetric = async (metricKey: MetricKey) => {
        const newMetrics = visibleMetrics.includes(metricKey)
            ? visibleMetrics.filter(m => m !== metricKey)
            : [...visibleMetrics, metricKey];

        setVisibleMetrics(newMetrics);

        try {
            await supabase
                .from('projects')
                .update({ tiktok_ads_visible_metrics: newMetrics })
                .eq('id', projectId);
        } catch (err) {
            console.error('Failed to save metrics settings:', err);
        }
    };

    const handleAdvertiserIdChange = (newAdvertiserId: string) => {
        setSelectedAdvertiserId(newAdvertiserId);
        if (onAdvertiserIdChange) {
            onAdvertiserIdChange(newAdvertiserId);
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
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
            {!readOnly && advertisers.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Рекламный аккаунт TikTok
                    </label>
                    <select
                        value={selectedAdvertiserId}
                        onChange={(e) => handleAdvertiserIdChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                    >
                        {advertisers.map((advertiser) => (
                            <option key={advertiser.advertiserId} value={advertiser.advertiserId}>
                                {advertiser.name} ({advertiser.advertiserId})
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Обзор TikTok Ads</h3>
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
                {visibleMetrics.includes('spend') && (
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Расходы</span>
                            <DollarSign className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalSpend)}</div>
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

                {visibleMetrics.includes('videoViews') && (
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Просмотры видео</span>
                            <Play className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="text-2xl font-bold">{formatNumber(stats.totalVideoViews)}</div>
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
                            <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ec4899" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
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
                        <Area type="monotone" dataKey="spend" stroke="#ec4899" fill="url(#colorSpend)" />
                        <Line type="monotone" dataKey="spend" stroke="#ec4899" strokeWidth={2} dot={false} />
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
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Цель</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Расходы</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Клики</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Конверсии</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Просмотры</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">CTR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.campaigns.map((campaign) => (
                                <tr key={campaign.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="py-3 px-4 text-sm">{campaign.name}</td>
                                    <td className="py-3 px-4">
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                            campaign.status === 'ACTIVE'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-700'
                                        }`}>
                                            {campaign.status === 'ACTIVE' ? 'Активна' : 'Приостановлена'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-sm">
                                        {campaign.objective === 'REACH' && 'Охват'}
                                        {campaign.objective === 'CONVERSIONS' && 'Конверсии'}
                                        {campaign.objective === 'TRAFFIC' && 'Трафик'}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-right font-medium">{formatCurrency(campaign.metrics.spend)}</td>
                                    <td className="py-3 px-4 text-sm text-right">{formatNumber(campaign.metrics.clicks)}</td>
                                    <td className="py-3 px-4 text-sm text-right">{formatNumber(campaign.metrics.conversions)}</td>
                                    <td className="py-3 px-4 text-sm text-right">{formatNumber(campaign.metrics.videoViews)}</td>
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

export default TikTokAdsAnalytics;
