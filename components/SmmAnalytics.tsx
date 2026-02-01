import React, { useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import {
    getLiveduneAccounts,
    getLiveduneDetailedAnalytics,
    getLiveduneAudience,
    getLivedunePosts,
    getLiveduneHistory,
    getLiveduneStories,
    getLiveduneReels
} from '../services/liveduneService';
import { LiveduneAccount, LiveduneDetailedAnalytics, LivedunePost, LiveduneAudience, LiveduneStory, LiveduneReels } from '../types';
import { LiveduneSyncButton } from './LiveduneSyncButton';

interface SmmAnalyticsProps {
    accessToken: string;
    projectAccountId?: number;
    onAccountChange?: (accountId: number) => void;
    dateRange?: string;
    projectId?: string;
}

const SmmAnalytics: React.FC<SmmAnalyticsProps> = ({
    accessToken,
    projectAccountId,
    onAccountChange,
    dateRange = '30d',
    projectId
}) => {
    const [accounts, setAccounts] = useState<LiveduneAccount[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(projectAccountId || null);
    const [stats, setStats] = useState<LiveduneDetailedAnalytics | null>(null);
    const [audience, setAudience] = useState<LiveduneAudience | null>(null);
    const [posts, setPosts] = useState<LivedunePost[]>([]);
    const [stories, setStories] = useState<LiveduneStory[]>([]);
    const [reels, setReels] = useState<LiveduneReels[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDateRange, setSelectedDateRange] = useState(dateRange);
    const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'stories' | 'reels' | 'reach'>('overview');
    const [customDateFrom, setCustomDateFrom] = useState('');
    const [customDateTo, setCustomDateTo] = useState('');
    const [showCustomDate, setShowCustomDate] = useState(false);
    const [storiesPage, setStoriesPage] = useState(1);
    const [reelsPage, setReelsPage] = useState(1);
    const [postsPage, setPostsPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        const fetchAccounts = async () => {
            if (!accessToken) return;
            const data = await getLiveduneAccounts(accessToken);
            setAccounts(data);
            if (!selectedAccountId && data.length > 0) {
                const defaultAccount = projectAccountId || data[0].id;
                setSelectedAccountId(defaultAccount);
            }
        };
        fetchAccounts();
    }, [accessToken, projectAccountId]);

    useEffect(() => {
        if (projectAccountId) {
            setSelectedAccountId(projectAccountId);
        }
    }, [projectAccountId]);

    useEffect(() => {
        const loadData = async () => {
            if (!accessToken || !selectedAccountId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const config = { accessToken, accountId: selectedAccountId };

                const [detailedData, audienceData, postsData, storiesData, reelsData, historyData] = await Promise.all([
                    getLiveduneDetailedAnalytics(config, selectedDateRange),
                    getLiveduneAudience(config),
                    getLivedunePosts(config, selectedDateRange),
                    getLiveduneStories(config, selectedDateRange),
                    getLiveduneReels(config, selectedDateRange),
                    getLiveduneHistory(config, selectedDateRange)
                ]);

                if (detailedData) {
                    setStats(detailedData);
                    setAudience(audienceData);
                    setPosts(postsData);
                    setStories(storiesData);
                    setReels(reelsData);
                    setHistory(historyData);
                    setStoriesPage(1);
                    setReelsPage(1);
                    setPostsPage(1);
                } else {
                    setError('Не удалось загрузить данные. Проверьте токен доступа.');
                }
            } catch (err) {
                console.error('Error loading Livedune data:', err);
                setError('Ошибка при загрузке данных');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [accessToken, selectedAccountId, selectedDateRange]);

    const handleAccountChange = (accountId: number) => {
        setSelectedAccountId(accountId);
        if (onAccountChange) {
            onAccountChange(accountId);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-slate-200">
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium">Загрузка статистики из Livedune...</p>
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

    const ageData = audience ? Object.entries(audience.age).map(([key, value]) => ({ name: key, value })) : [];
    const genderData = audience ? [
        { name: 'Женщины', value: audience.gender.F, color: '#ec4899' },
        { name: 'Мужчины', value: audience.gender.M, color: '#3b82f6' },
        { name: 'Не указан', value: audience.gender.U, color: '#94a3b8' }
    ] : [];

    const contentTypeData = [
        { name: 'Посты', value: stats.posts || 0, color: '#3b82f6' },
        { name: 'Stories', value: stats.stories_count || 0, color: '#f59e0b' },
        { name: 'Reels', value: stats.reels_count || 0, color: '#ec4899' }
    ];

    const MetricCard = ({ title, value, change, changePercent, isPositive, prefix = '', suffix = '' }: any) => {
        const changeColor = isPositive === undefined
            ? 'text-slate-500'
            : isPositive
                ? 'text-green-600'
                : 'text-red-600';

        return (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                    <p className="text-xs text-slate-500 font-medium">{title}</p>
                    <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                    {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
                </p>
                {change !== undefined && (
                    <div className={`flex items-center mt-2 text-xs font-medium ${changeColor}`}>
                        {isPositive ? (
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                        ) : isPositive === false ? (
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        ) : null}
                        <span>
                            {changePercent !== undefined
                                ? `${changePercent.toFixed(2)}% за период`
                                : `${change > 0 ? '+' : ''}${change} за период`
                            }
                        </span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-tr from-yellow-400 via-red-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">
                            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                        </div>
                        <div>
                            {accounts.length > 1 ? (
                                <select
                                    className="font-bold text-lg text-slate-800 bg-transparent border-none focus:ring-0 cursor-pointer"
                                    value={selectedAccountId || ''}
                                    onChange={(e) => handleAccountChange(Number(e.target.value))}
                                >
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name} (@{acc.short_name})</option>
                                    ))}
                                </select>
                            ) : (
                                <h3 className="font-bold text-lg text-slate-800">
                                    {accounts[0]?.name || 'Livedune SMM Analytics'}
                                </h3>
                            )}
                            <p className="text-xs text-slate-500 font-medium">
                                Период: {selectedDateRange.includes('|')
                                    ? `${new Date(selectedDateRange.split('|')[0]).toLocaleDateString('ru-RU')} - ${new Date(selectedDateRange.split('|')[1]).toLocaleDateString('ru-RU')}`
                                    : selectedDateRange === '7d' ? '7 дней' : selectedDateRange === '30d' ? '30 дней' : selectedDateRange === '90d' ? '90 дней' : selectedDateRange
                                }
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {['7d', '30d', '90d'].map((range) => (
                            <button
                                key={range}
                                onClick={() => {
                                    setSelectedDateRange(range);
                                    setShowCustomDate(false);
                                    setCustomDateFrom('');
                                    setCustomDateTo('');
                                }}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                    selectedDateRange === range && !selectedDateRange.includes('|')
                                        ? 'bg-pink-600 text-white shadow-lg'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {range === '7d' ? '7 дней' : range === '30d' ? '30 дней' : '90 дней'}
                            </button>
                        ))}
                        <button
                            onClick={() => {
                                if (!showCustomDate) {
                                    const today = new Date();
                                    const thirtyDaysAgo = new Date();
                                    thirtyDaysAgo.setDate(today.getDate() - 30);
                                    setCustomDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
                                    setCustomDateTo(today.toISOString().split('T')[0]);
                                }
                                setShowCustomDate(!showCustomDate);
                            }}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                selectedDateRange.includes('|')
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Свой период
                        </button>
                        {projectId && (
                            <LiveduneSyncButton
                                projectId={projectId}
                                onSyncComplete={() => {
                                    window.location.reload();
                                }}
                            />
                        )}
                    </div>
                </div>

                {showCustomDate && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg flex gap-3 items-end">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Дата начала</label>
                            <input
                                type="date"
                                value={customDateFrom}
                                onChange={(e) => setCustomDateFrom(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Дата окончания</label>
                            <input
                                type="date"
                                value={customDateTo}
                                onChange={(e) => setCustomDateTo(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                            />
                        </div>
                        <button
                            onClick={() => {
                                if (customDateFrom && customDateTo) {
                                    setSelectedDateRange(`${customDateFrom}|${customDateTo}`);
                                }
                            }}
                            className="px-6 py-2 bg-pink-600 text-white rounded-lg text-sm font-bold hover:bg-pink-700 transition-all"
                        >
                            Применить
                        </button>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex border-b border-slate-200 overflow-x-auto">
                    {[
                        { id: 'overview', label: 'Сводная', icon: '📊' },
                        { id: 'reach', label: 'Охват', icon: '📈' },
                        { id: 'posts', label: 'Посты', icon: '📷', count: posts.length },
                        { id: 'stories', label: 'Stories', icon: '📱', count: stories.length },
                        { id: 'reels', label: 'Reels', icon: '🎬', count: reels.length }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 min-w-fit px-6 py-4 text-sm font-bold transition-all relative ${
                                activeTab === tab.id
                                    ? 'text-pink-600 bg-pink-50'
                                    : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            <span className="mr-2">{tab.icon}</span>
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className="ml-2 px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full text-xs">
                                    {tab.count}
                                </span>
                            )}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-pink-600"></div>
                            )}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Main Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <MetricCard
                                    title="Подписчики"
                                    value={stats.followers}
                                    change={stats.followers_diff}
                                    changePercent={stats.followers_change_percent}
                                    isPositive={stats.followers_diff >= 0}
                                />
                                <MetricCard
                                    title="Лайки"
                                    value={stats.likes_avg}
                                    change={stats.likes_change}
                                    changePercent={stats.likes_change_percent}
                                    isPositive={false}
                                />
                                <MetricCard
                                    title="Комментарии"
                                    value={stats.comments_avg}
                                    change={stats.comments_change}
                                    changePercent={stats.comments_change_percent}
                                    isPositive={true}
                                />
                                <MetricCard
                                    title="Сохранения"
                                    value={stats.saves}
                                    change={stats.saves_change}
                                    changePercent={stats.saves_change_percent}
                                    isPositive={true}
                                />
                            </div>

                            {/* Engagement Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-5 rounded-xl border border-pink-200">
                                    <p className="text-xs text-pink-600 font-bold uppercase">Engagement Rate</p>
                                    <p className="text-3xl font-black text-pink-900 mt-2">{stats.er}%</p>
                                    <p className="text-xs text-pink-500 mt-2 font-medium">Вовлеченность</p>
                                </div>
                                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-xl border border-purple-200">
                                    <p className="text-xs text-purple-600 font-bold uppercase">ER Views</p>
                                    <p className="text-3xl font-black text-purple-900 mt-2">{stats.er_views}%</p>
                                    <p className="text-xs text-purple-500 mt-2 font-medium">По просмотрам</p>
                                </div>
                                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border border-blue-200">
                                    <p className="text-xs text-blue-600 font-bold uppercase">Avg. Likes</p>
                                    <p className="text-3xl font-black text-blue-900 mt-2">{stats.likes_avg.toLocaleString()}</p>
                                    <p className="text-xs text-blue-500 mt-2 font-medium">На пост</p>
                                </div>
                                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-5 rounded-xl border border-orange-200">
                                    <p className="text-xs text-orange-600 font-bold uppercase">Avg. Views</p>
                                    <p className="text-3xl font-black text-orange-900 mt-2">{stats.views_avg.toLocaleString()}</p>
                                    <p className="text-xs text-orange-500 mt-2 font-medium">На пост</p>
                                </div>
                            </div>

                            {/* Content Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-5 rounded-xl border border-slate-200">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Посты</p>
                                        <span className="text-2xl">📷</span>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-800">{stats.posts}</p>
                                    <div className="mt-3 space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Ср. лайков</span>
                                            <span className="font-bold text-slate-700">{stats.likes_avg.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Ср. комментариев</span>
                                            <span className="font-bold text-slate-700">{stats.comments_avg.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-xl border border-slate-200">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Stories</p>
                                        <span className="text-2xl">📱</span>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-800">{stats.stories_count || 0}</p>
                                    <div className="mt-3 space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Просмотры</span>
                                            <span className="font-bold text-slate-700">{(stats.stories_views || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Ср. просмотров</span>
                                            <span className="font-bold text-slate-700">{(stats.stories_views_avg || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-xl border border-slate-200">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Reels</p>
                                        <span className="text-2xl">🎬</span>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-800">{stats.reels_count || 0}</p>
                                    <div className="mt-3 space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Просмотры</span>
                                            <span className="font-bold text-slate-700">{(stats.reels_views || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Лайки</span>
                                            <span className="font-bold text-slate-700">{(stats.reels_likes || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-6">Динамика подписчиков</h3>
                                    <div className="h-72 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={history} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4}/>
                                                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                                                <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                                <Tooltip
                                                    formatter={(value: number) => value.toLocaleString()}
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                />
                                                <Area type="monotone" dataKey="followers" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#colorFollowers)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                                    <div>
                                        <h3 className="font-bold text-slate-800 mb-4 text-sm">Распределение контента</h3>
                                        <div className="h-48 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={contentTypeData}
                                                        cx="50%"
                                                        cy="50%"
                                                        outerRadius={60}
                                                        dataKey="value"
                                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                        labelLine={false}
                                                    >
                                                        {contentTypeData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-slate-800 mb-3 text-sm">Пол аудитории</h3>
                                        <div className="space-y-2">
                                            {genderData.map((item) => (
                                                <div key={item.name}>
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="text-slate-600 font-medium">{item.name}</span>
                                                        <span className="font-bold text-slate-800">{item.value}%</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                                        <div
                                                            className="h-2 rounded-full transition-all"
                                                            style={{ width: `${item.value}%`, backgroundColor: item.color }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Audience Age */}
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="font-bold text-slate-800 mb-4">Возраст аудитории</h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={ageData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                                            <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                                            <Bar dataKey="value" fill="#f97316" radius={[8, 8, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'reach' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Охват постов</p>
                                        <span className="text-xl">📷</span>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900">{(stats.posts_reach || 0).toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 mt-2">Уникальные просмотры постов</p>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Охват Stories</p>
                                        <span className="text-xl">📱</span>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900">{(stats.stories_reach || 0).toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 mt-2">Stories за период: {stats.stories_count || 0}</p>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Охват за месяц</p>
                                        <span className="text-xl">📈</span>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900">{(stats.monthly_reach || 0).toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 mt-2">Посты + Stories</p>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Impressions</p>
                                        <span className="text-xl">👁️</span>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900">{(stats.impressions || 0).toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 mt-2">Всего показов</p>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-xl border border-blue-200">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                    Статистика по охвату
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white/80 backdrop-blur p-4 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">Средний охват поста</p>
                                                <p className="text-xs text-slate-500 mt-1">На один пост</p>
                                            </div>
                                            <p className="text-2xl font-bold text-blue-600">
                                                {stats.posts && stats.posts > 0
                                                    ? Math.floor((stats.posts_reach || 0) / stats.posts).toLocaleString()
                                                    : '0'
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-white/80 backdrop-blur p-4 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">Средний охват Stories</p>
                                                <p className="text-xs text-slate-500 mt-1">На одну Stories</p>
                                            </div>
                                            <p className="text-2xl font-bold text-purple-600">
                                                {(stats.stories_reach_avg || 0).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'posts' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Всего постов</p>
                                        <span className="text-xl">📷</span>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900">{posts.length}</p>
                                    <p className="text-xs text-slate-500 mt-2">За период</p>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Средний охват</p>
                                        <span className="text-xl">📈</span>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900">
                                        {posts.length > 0
                                            ? Math.floor(posts.reduce((sum, p) => sum + p.reach.total, 0) / posts.length).toLocaleString()
                                            : '0'
                                        }
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">На один пост</p>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Средние лайки</p>
                                        <span className="text-xl">❤️</span>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900">
                                        {posts.length > 0
                                            ? Math.floor(posts.reduce((sum, p) => sum + p.reactions.likes, 0) / posts.length).toLocaleString()
                                            : '0'
                                        }
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">На один пост</p>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Средние комментарии</p>
                                        <span className="text-xl">💬</span>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900">
                                        {posts.length > 0
                                            ? Math.floor(posts.reduce((sum, p) => sum + p.reactions.comments, 0) / posts.length).toLocaleString()
                                            : '0'
                                        }
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">На один пост</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                                <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-purple-50">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-slate-800 flex items-center">
                                            <span className="text-2xl mr-3">📷</span>
                                            Последние посты
                                        </h3>
                                        <span className="px-4 py-1 bg-blue-600 text-white text-sm font-bold rounded-full">
                                            {posts.length}
                                        </span>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="text-xs text-slate-500 font-bold uppercase bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3">Пост</th>
                                            <th className="px-4 py-3 text-right">Likes</th>
                                            <th className="px-4 py-3 text-right">Comments</th>
                                            <th className="px-4 py-3 text-right">Saved</th>
                                            <th className="px-4 py-3 text-right">Reach</th>
                                            <th className="px-4 py-3 text-right">ER</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {posts.slice((postsPage - 1) * itemsPerPage, postsPage * itemsPerPage).map((post) => (
                                            <tr key={post.post_id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-10 h-10 bg-slate-200 rounded-lg flex-shrink-0 flex items-center justify-center text-lg">
                                                            {post.type === 'video' ? '🎥' : '📷'}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-slate-800 font-medium line-clamp-1">{post.text || 'Без текста'}</p>
                                                            <p className="text-xs text-slate-400">{new Date(post.created).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium">{post.reactions.likes.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right font-medium">{post.reactions.comments.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right font-medium">{(post.reactions.saved || 0).toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right font-medium">{post.reach.total.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right font-bold text-pink-600">{post.engagement_rate || 0}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                                {posts.length > itemsPerPage && (
                                    <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                                        <p className="text-sm text-slate-600">
                                            Показано {Math.min(postsPage * itemsPerPage, posts.length)} из {posts.length}
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setPostsPage(p => Math.max(1, p - 1))}
                                                disabled={postsPage === 1}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                                    postsPage === 1
                                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                                }`}
                                            >
                                                Назад
                                            </button>
                                            <span className="px-4 py-2 text-sm font-bold text-slate-700">
                                                Страница {postsPage} из {Math.ceil(posts.length / itemsPerPage)}
                                            </span>
                                            <button
                                                onClick={() => setPostsPage(p => Math.min(Math.ceil(posts.length / itemsPerPage), p + 1))}
                                                disabled={postsPage >= Math.ceil(posts.length / itemsPerPage)}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                                    postsPage >= Math.ceil(posts.length / itemsPerPage)
                                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                                }`}
                                            >
                                                Вперед
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'stories' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Всего просмотров</p>
                                        <span className="text-xl">👁️</span>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900">{(stats.stories_views || 0).toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 mt-2">За весь период</p>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Среднее просмотров</p>
                                        <span className="text-xl">📊</span>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900">{(stats.stories_views_avg || 0).toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 mt-2">На одну Stories</p>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Охват Stories</p>
                                        <span className="text-xl">📱</span>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900">{(stats.stories_reach || 0).toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 mt-2">Уникальные пользователи</p>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Средний охват</p>
                                        <span className="text-xl">📈</span>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900">{(stats.stories_reach_avg || 0).toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 mt-2">На одну Stories</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                                <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-pink-50 to-purple-50">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-slate-800 flex items-center">
                                            <span className="text-2xl mr-3">📱</span>
                                            Stories за период
                                        </h3>
                                        <span className="px-4 py-1 bg-pink-600 text-white text-sm font-bold rounded-full">
                                            {stories.length}
                                        </span>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="text-xs text-slate-500 font-bold uppercase bg-slate-50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3">Дата</th>
                                                <th className="px-4 py-3 text-right">Просмотры</th>
                                                <th className="px-4 py-3 text-right">Охват</th>
                                                <th className="px-4 py-3 text-right">Ответы</th>
                                                <th className="px-4 py-3 text-right">Взаимодействия</th>
                                                <th className="px-4 py-3 text-right">Выходы</th>
                                                <th className="px-4 py-3 text-right">ER</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {stories.slice((storiesPage - 1) * itemsPerPage, storiesPage * itemsPerPage).map((story, index) => (
                                                <tr key={`${story.story_id}-${index}`} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center space-x-2">
                                                            <span className="text-lg">📱</span>
                                                            <span className="text-slate-700 font-medium">
                                                                {new Date(story.created).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium">{story.views.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right font-medium">{story.reach.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right font-medium">{story.replies.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right font-medium">{story.interactions.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right font-medium text-red-500">{story.exits.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-orange-600">{story.engagement_rate || 0}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {stories.length > itemsPerPage && (
                                    <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                                        <p className="text-sm text-slate-600">
                                            Показано {Math.min(storiesPage * itemsPerPage, stories.length)} из {stories.length}
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setStoriesPage(p => Math.max(1, p - 1))}
                                                disabled={storiesPage === 1}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                                    storiesPage === 1
                                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                        : 'bg-pink-600 text-white hover:bg-pink-700'
                                                }`}
                                            >
                                                Назад
                                            </button>
                                            <span className="px-4 py-2 text-sm font-bold text-slate-700">
                                                Страница {storiesPage} из {Math.ceil(stories.length / itemsPerPage)}
                                            </span>
                                            <button
                                                onClick={() => setStoriesPage(p => Math.min(Math.ceil(stories.length / itemsPerPage), p + 1))}
                                                disabled={storiesPage >= Math.ceil(stories.length / itemsPerPage)}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                                    storiesPage >= Math.ceil(stories.length / itemsPerPage)
                                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                        : 'bg-pink-600 text-white hover:bg-pink-700'
                                                }`}
                                            >
                                                Вперед
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'reels' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Всего просмотров</p>
                                        <span className="text-xl">👁️</span>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900">{reels.reduce((sum, r) => sum + r.views, 0).toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 mt-2">Reels: {reels.length}</p>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Всего лайков</p>
                                        <span className="text-xl">❤️</span>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900">{reels.reduce((sum, r) => sum + r.likes, 0).toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Сред: {reels.length > 0 ? Math.floor(reels.reduce((sum, r) => sum + r.likes, 0) / reels.length).toLocaleString() : '0'}
                                    </p>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Всего комментариев</p>
                                        <span className="text-xl">💬</span>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900">{reels.reduce((sum, r) => sum + r.comments, 0).toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Сред: {reels.length > 0 ? Math.floor(reels.reduce((sum, r) => sum + r.comments, 0) / reels.length).toLocaleString() : '0'}
                                    </p>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-slate-500 font-bold uppercase">Всего сохранений</p>
                                        <span className="text-xl">🔖</span>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900">{reels.reduce((sum, r) => sum + r.saves, 0).toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Сред: {reels.length > 0 ? Math.floor(reels.reduce((sum, r) => sum + r.saves, 0) / reels.length).toLocaleString() : '0'}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                                <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-pink-50 to-red-50">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-slate-800 flex items-center">
                                            <span className="text-2xl mr-3">🎬</span>
                                            Reels за период
                                        </h3>
                                        <span className="px-4 py-1 bg-pink-600 text-white text-sm font-bold rounded-full">
                                            {reels.length}
                                        </span>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="text-xs text-slate-500 font-bold uppercase bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3">Reels</th>
                                            <th className="px-4 py-3 text-right">Просмотры</th>
                                            <th className="px-4 py-3 text-right">Likes</th>
                                            <th className="px-4 py-3 text-right">Comments</th>
                                            <th className="px-4 py-3 text-right">Shares</th>
                                            <th className="px-4 py-3 text-right">Saves</th>
                                            <th className="px-4 py-3 text-right">ER</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {reels.slice((reelsPage - 1) * itemsPerPage, reelsPage * itemsPerPage).map((reel) => (
                                            <tr key={reel.reel_id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-10 h-10 bg-pink-100 rounded-lg flex-shrink-0 flex items-center justify-center text-lg">
                                                            🎬
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-slate-800 font-medium line-clamp-1">{reel.text || 'Без текста'}</p>
                                                            <p className="text-xs text-slate-400">{new Date(reel.created).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium">{reel.views.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right font-medium">{reel.likes.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right font-medium">{reel.comments.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right font-medium">{reel.shares.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right font-medium">{reel.saves.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right font-bold text-pink-600">{reel.engagement_rate || 0}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                                {reels.length > itemsPerPage && (
                                    <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                                        <p className="text-sm text-slate-600">
                                            Показано {Math.min(reelsPage * itemsPerPage, reels.length)} из {reels.length}
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setReelsPage(p => Math.max(1, p - 1))}
                                                disabled={reelsPage === 1}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                                    reelsPage === 1
                                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                        : 'bg-pink-600 text-white hover:bg-pink-700'
                                                }`}
                                            >
                                                Назад
                                            </button>
                                            <span className="px-4 py-2 text-sm font-bold text-slate-700">
                                                Страница {reelsPage} из {Math.ceil(reels.length / itemsPerPage)}
                                            </span>
                                            <button
                                                onClick={() => setReelsPage(p => Math.min(Math.ceil(reels.length / itemsPerPage), p + 1))}
                                                disabled={reelsPage >= Math.ceil(reels.length / itemsPerPage)}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                                    reelsPage >= Math.ceil(reels.length / itemsPerPage)
                                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                        : 'bg-pink-600 text-white hover:bg-pink-700'
                                                }`}
                                            >
                                                Вперед
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SmmAnalytics;
