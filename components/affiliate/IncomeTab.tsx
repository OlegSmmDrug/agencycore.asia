import React from 'react';
import { DollarSign, Clock, CheckCircle, Users, UserCheck, TrendingUp } from 'lucide-react';
import { AffiliateStats, ReferralTransaction, REWARD_TIERS, getRewardTier } from '../../services/affiliateService';

interface IncomeTabProps {
  stats: AffiliateStats;
  transactions: ReferralTransaction[];
  loading: boolean;
}

export const IncomeTab: React.FC<IncomeTabProps> = ({ stats, transactions, loading }) => {
  const { tierIndex } = getRewardTier(stats.activeClients);

  const statCards = [
    {
      icon: DollarSign,
      label: 'Готово к выплате',
      value: `${stats.readyToPay.toLocaleString('ru-RU')} руб.`,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      icon: Clock,
      label: 'В ожидании',
      value: `${stats.pending.toLocaleString('ru-RU')} руб.`,
      description: 'Сумма, которая будет готова к выплате в течение 14 дней',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      icon: CheckCircle,
      label: 'Выплачено',
      value: `${stats.totalPaid.toLocaleString('ru-RU')} руб.`,
      description: 'Средства, которые были выведены с партнерского баланса',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      icon: Users,
      label: 'Привлечено клиентов',
      value: String(stats.totalReferred),
      description: 'Общее количество клиентов, которое было приглашено',
      color: 'text-slate-600',
      bgColor: 'bg-slate-100',
    },
    {
      icon: UserCheck,
      label: 'Активных клиентов',
      value: String(stats.activeClients),
      description: 'Количество платных клиентов с плюсовым балансом',
      color: 'text-slate-600',
      bgColor: 'bg-slate-100',
    },
  ];

  const tierLabels = [
    { range: 'до 5', label: 'активных\nклиентов' },
    { range: '6-10', label: 'активных\nклиентов' },
    { range: '11-20', label: 'активных\nклиентов' },
    { range: '21-40', label: 'активных\nклиентов' },
    { range: '41-80', label: 'активных\nклиентов' },
    { range: 'от 81', label: 'активных\nклиентов' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
            <div className={`w-10 h-10 ${card.bgColor} rounded-xl flex items-center justify-center mb-3`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-sm text-slate-500 mb-1">{card.label}</p>
            <p className="text-xl font-bold text-slate-900">{card.value}</p>
            {card.description && (
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">{card.description}</p>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Уровень вознаграждения</h3>

        <div className="mb-6">
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-3xl font-bold text-slate-900">50%</span>
            <span className="text-sm text-slate-500">с любой суммы первого<br />платежа клиента</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          {REWARD_TIERS.map((tier, i) => {
            const isActive = i === tierIndex;
            return (
              <div key={i} className="relative">
                {isActive && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-teal-500 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
                    ваш уровень
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-teal-500"></div>
                  </div>
                )}
                <div
                  className={`w-[100px] rounded-xl p-3 text-center transition-all ${
                    isActive
                      ? 'bg-gradient-to-b from-blue-400 to-blue-500 text-white shadow-lg shadow-blue-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <p className={`text-xs mb-1 ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                    {tierLabels[i].range}
                  </p>
                  <p className={`text-[10px] leading-tight mb-2 ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                    активных<br />клиентов
                  </p>
                  <p className={`text-xl font-bold ${isActive ? 'text-white' : 'text-slate-700'}`}>
                    {tier.percent}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-sm text-slate-500 mt-4">
          Вознаграждение с каждой последующей оплаты в течение года. Активным считается клиент с положительным балансом, совершивший оплату.
        </p>

        <div className="flex items-center gap-3 mt-6 p-4 bg-slate-50 rounded-xl">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-sm text-slate-600">
            Повысьте ваш статус партнера и получайте еще больше денег
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">История операций</h3>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Дата</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Операция</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Пополнение</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">
                  Ваш процент<br /><span className="text-xs text-slate-400">(с вычетом НДС 5%)</span>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Статус</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-slate-400 bg-slate-50 rounded-lg">
                    Пока еще нет данных.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {new Date(tx.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-900">
                      {tx.referredOrgName}
                      {tx.level > 1 && (
                        <span className="ml-2 text-xs text-slate-400">(уровень {tx.level})</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {tx.paymentAmount.toLocaleString('ru-RU')} руб.
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-slate-900">
                      {tx.commissionAmount.toLocaleString('ru-RU')} руб.
                      <span className="text-xs text-slate-400 ml-1">({tx.commissionPercent}%)</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        tx.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        tx.status === 'ready' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {tx.status === 'paid' ? 'Выплачено' :
                         tx.status === 'ready' ? 'Готово' :
                         'Ожидание'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
