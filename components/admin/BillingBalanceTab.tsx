import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, DollarSign, ArrowUpCircle, ArrowDownCircle, Building2, Clock } from 'lucide-react';

interface OrgOption {
  id: string;
  name: string;
  plan_name: string;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  owner_balance: number;
}

interface Transaction {
  id: string;
  org_name: string;
  user_name: string;
  amount: number;
  type: string;
  description: string;
  balance_before: number;
  balance_after: number;
  created_at: string;
}

interface Props {
  adminUserId: string;
}

const TYPE_LABELS: Record<string, string> = {
  credit: 'Зачисление',
  debit: 'Списание',
  topup: 'Пополнение',
  plan_purchase: 'Покупка тарифа',
  module_purchase: 'Покупка модуля',
  user_purchase: 'Покупка пользователей',
};

const BillingBalanceTab: React.FC<Props> = ({ adminUserId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrgOption | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isCredit, setIsCredit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadRecentTransactions();
  }, []);

  const searchOrganizations = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, plan_name')
        .or(`name.ilike.%${searchQuery}%,slug.ilike.%${searchQuery}%`)
        .limit(10);

      const results: OrgOption[] = [];
      for (const org of orgs || []) {
        const { data: owner } = await supabase
          .from('users')
          .select('id, name, email, balance')
          .eq('organization_id', org.id)
          .eq('job_title', 'CEO')
          .maybeSingle();

        if (!owner) {
          const { data: anyUser } = await supabase
            .from('users')
            .select('id, name, email, balance')
            .eq('organization_id', org.id)
            .order('created_at')
            .limit(1)
            .maybeSingle();

          results.push({
            id: org.id,
            name: org.name,
            plan_name: org.plan_name || 'Free',
            owner_id: anyUser?.id || '',
            owner_name: anyUser?.name || '-',
            owner_email: anyUser?.email || '-',
            owner_balance: anyUser?.balance || 0,
          });
        } else {
          results.push({
            id: org.id,
            name: org.name,
            plan_name: org.plan_name || 'Free',
            owner_id: owner.id,
            owner_name: owner.name,
            owner_email: owner.email,
            owner_balance: owner.balance || 0,
          });
        }
      }
      setOrganizations(results);
    } catch (err) {
      console.error('Error searching orgs:', err);
    } finally {
      setSearching(false);
    }
  };

  const loadRecentTransactions = async () => {
    try {
      const { data } = await supabase
        .from('balance_transactions')
        .select('*, organizations(name), users!balance_transactions_user_id_fkey(name)')
        .order('created_at', { ascending: false })
        .limit(20);

      setTransactions(
        (data || []).map((t: any) => ({
          id: t.id,
          org_name: t.organizations?.name || '-',
          user_name: t.users?.name || '-',
          amount: t.amount,
          type: t.type,
          description: t.description,
          balance_before: t.balance_before,
          balance_after: t.balance_after,
          created_at: t.created_at,
        }))
      );
    } catch (err) {
      console.error('Error loading transactions:', err);
    }
  };

  const handleSubmit = async () => {
    if (!selectedOrg || !amount) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Введите корректную сумму');
      return;
    }

    setSaving(true);
    try {
      const balanceBefore = selectedOrg.owner_balance;
      const delta = isCredit ? numAmount : -numAmount;
      const balanceAfter = balanceBefore + delta;

      if (balanceAfter < 0) {
        alert('Недостаточно средств на балансе');
        setSaving(false);
        return;
      }

      const { error: userError } = await supabase
        .from('users')
        .update({ balance: balanceAfter })
        .eq('id', selectedOrg.owner_id);

      if (userError) throw userError;

      const { error: txError } = await supabase
        .from('balance_transactions')
        .insert({
          organization_id: selectedOrg.id,
          user_id: selectedOrg.owner_id,
          admin_id: adminUserId,
          amount: delta,
          type: isCredit ? 'credit' : 'debit',
          description: reason || (isCredit ? 'Зачисление от администратора' : 'Списание администратором'),
          balance_before: balanceBefore,
          balance_after: balanceAfter,
        });

      if (txError) throw txError;

      setSelectedOrg({ ...selectedOrg, owner_balance: balanceAfter });
      setAmount('');
      setReason('');
      loadRecentTransactions();
      alert(isCredit ? 'Средства зачислены!' : 'Средства списаны!');
    } catch (err) {
      console.error('Error processing balance:', err);
      alert('Ошибка операции');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-800">Управление балансом</h3>
        <p className="text-sm text-slate-500">Зачисляйте или списывайте средства с баланса организации</p>
      </div>

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
                    onClick={() => setSelectedOrg(org)}
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
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">{org.plan_name}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-700">{org.owner_balance.toLocaleString()} ₸</span>
                    </div>
                    <p className="text-xs text-slate-500 ml-6 mt-0.5">{org.owner_name} ({org.owner_email})</p>
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
                  <p className="text-xs text-slate-500">{selectedOrg.owner_name} -- {selectedOrg.owner_email}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Текущий баланс</p>
                  <p className="text-xl font-bold text-slate-800">{selectedOrg.owner_balance.toLocaleString()} ₸</p>
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Сумма (₸)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-lg font-bold focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-2 mt-2">
                    {[5000, 10000, 50000, 100000].map(v => (
                      <button
                        key={v}
                        onClick={() => setAmount(v.toString())}
                        className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        {v.toLocaleString()} ₸
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
                  onClick={handleSubmit}
                  disabled={saving || !amount}
                  className={`w-full py-3 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                    isCredit
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  } disabled:opacity-50`}
                >
                  <DollarSign className="w-4 h-4" />
                  {saving ? 'Обработка...' : isCredit ? 'Зачислить средства' : 'Списать средства'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-bold text-slate-800">История операций</h4>
          </div>
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">Операций пока нет</div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-[500px] overflow-auto">
              {transactions.map(tx => (
                <div key={tx.id} className="px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold ${tx.amount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {tx.amount > 0 ? <ArrowUpCircle className="w-3 h-3" /> : <ArrowDownCircle className="w-3 h-3" />}
                          {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} ₸
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                          {TYPE_LABELS[tx.type] || tx.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{tx.org_name} -- {tx.user_name}</p>
                      {tx.description && <p className="text-[11px] text-slate-400 mt-0.5">{tx.description}</p>}
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-[10px] text-slate-400">
                        {new Date(tx.created_at).toLocaleDateString('ru-RU')}{' '}
                        {new Date(tx.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-[10px] text-slate-400">{tx.balance_before.toLocaleString()} → {tx.balance_after.toLocaleString()} ₸</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillingBalanceTab;
