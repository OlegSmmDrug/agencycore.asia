import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, MousePointer, Eye, Target } from 'lucide-react';
import { googleAdsService, GoogleAdsMetrics } from '../../services/googleAdsService';

interface GoogleAdsAnalyticsProps {
  integrationId: string;
}

export const GoogleAdsAnalytics: React.FC<GoogleAdsAnalyticsProps> = ({ integrationId }) => {
  const [metrics, setMetrics] = useState<GoogleAdsMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('last_30_days');

  useEffect(() => {
    loadMetrics();
  }, [integrationId, dateRange]);

  const loadMetrics = async () => {
    try {
      setIsLoading(true);
      const data = await googleAdsService.getMetrics(integrationId);
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load Google Ads metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-4 text-gray-500">Loading Google Ads data...</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Google Ads Analytics</h2>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="today">Today</option>
          <option value="last_7_days">Last 7 Days</option>
          <option value="last_30_days">Last 30 Days</option>
          <option value="last_90_days">Last 90 Days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Spend</span>
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${(metrics.totalSpend / 100).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">Campaign budget usage</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Clicks</span>
            <MousePointer className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {metrics.totalClicks.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.avgCtr.toFixed(2)}% CTR
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Impressions</span>
            <Eye className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {metrics.totalImpressions.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">Ad views</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Conversions</span>
            <Target className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {metrics.totalConversions}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            ${(metrics.avgCpa / 100).toFixed(2)} CPA
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Performance</h3>
        <div className="space-y-3">
          {metrics.campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">{campaign.name}</h4>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${
                      campaign.status === 'ENABLED'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {campaign.status}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Budget</p>
                  <p className="font-semibold text-gray-900">
                    ${(campaign.budget / 100).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Clicks</p>
                  <p className="font-semibold text-gray-900">{campaign.clicks}</p>
                </div>
                <div>
                  <p className="text-gray-500">Impressions</p>
                  <p className="font-semibold text-gray-900">
                    {campaign.impressions.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">CTR</p>
                  <p className="font-semibold text-gray-900">{campaign.ctr.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-gray-500">CPC</p>
                  <p className="font-semibold text-gray-900">
                    ${(campaign.cpc / 100).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-200 text-sm">
                <div>
                  <p className="text-gray-500">Conversions</p>
                  <p className="font-semibold text-gray-900">{campaign.conversions}</p>
                </div>
                <div>
                  <p className="text-gray-500">Cost per Conversion</p>
                  <p className="font-semibold text-gray-900">
                    ${(campaign.cpa / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
