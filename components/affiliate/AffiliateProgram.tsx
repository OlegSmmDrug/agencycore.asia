import React, { useState, useEffect, useCallback } from 'react';
import { affiliateService, AffiliateStats, PromoCode, ReferralTransaction } from '../../services/affiliateService';
import { IncomeTab } from './IncomeTab';
import { LinksTab } from './LinksTab';
import { RulesTab } from './RulesTab';
import { PlatformTab } from './PlatformTab';

type TabId = 'income' | 'links' | 'rules' | 'platform';

interface AffiliateProgramProps {
  organizationId: string;
  userId: string;
}

export const AffiliateProgram: React.FC<AffiliateProgramProps> = ({ organizationId, userId }) => {
  const [activeTab, setActiveTab] = useState<TabId>('income');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AffiliateStats>({
    readyToPay: 0,
    pending: 0,
    totalPaid: 0,
    totalReferred: 0,
    activeClients: 0,
  });
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [transactions, setTransactions] = useState<ReferralTransaction[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, codesData, txData] = await Promise.all([
        affiliateService.getAffiliateStats(organizationId, userId),
        affiliateService.getPromoCodes(organizationId),
        affiliateService.getTransactions(userId),
      ]);
      setStats(statsData);
      setPromoCodes(codesData);
      setTransactions(txData);
    } catch (err) {
      console.error('Error loading affiliate data:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'income', label: 'Доход' },
    { id: 'links', label: 'Ссылки и промокоды' },
    { id: 'rules', label: 'Правила' },
    { id: 'platform', label: 'Платформа LP' },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Партнерская программа</h1>

      <div className="flex gap-1 border-b border-slate-200 mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'income' && (
        <IncomeTab stats={stats} transactions={transactions} loading={loading} />
      )}
      {activeTab === 'links' && (
        <LinksTab
          promoCodes={promoCodes}
          organizationId={organizationId}
          userId={userId}
          onRefresh={loadData}
        />
      )}
      {activeTab === 'rules' && <RulesTab />}
      {activeTab === 'platform' && <PlatformTab />}
    </div>
  );
};
