import { supabase } from '../lib/supabase';

export interface PromoCode {
  id: string;
  organizationId: string;
  userId: string;
  code: string;
  registrationsCount: number;
  paymentsCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface ReferralRegistration {
  id: string;
  referrerUserId: string;
  referrerOrgId: string;
  referredOrgId: string;
  promoCodeId: string | null;
  level: number;
  isActive: boolean;
  createdAt: string;
  referredOrgName?: string;
}

export interface ReferralTransaction {
  id: string;
  referrerUserId: string;
  referrerOrgId: string;
  referredOrgId: string;
  paymentAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  level: number;
  status: 'pending' | 'ready' | 'paid';
  readyAt: string | null;
  paidAt: string | null;
  createdAt: string;
  referredOrgName?: string;
}

export interface AffiliateStats {
  readyToPay: number;
  pending: number;
  totalPaid: number;
  totalReferred: number;
  activeClients: number;
}

const REWARD_TIERS = [
  { min: 0, max: 5, percent: 20 },
  { min: 6, max: 10, percent: 25 },
  { min: 11, max: 20, percent: 30 },
  { min: 21, max: 40, percent: 35 },
  { min: 41, max: 80, percent: 40 },
  { min: 81, max: Infinity, percent: 50 },
];

export function getRewardTier(activeClients: number): { percent: number; tierIndex: number } {
  for (let i = 0; i < REWARD_TIERS.length; i++) {
    if (activeClients <= REWARD_TIERS[i].max) {
      return { percent: REWARD_TIERS[i].percent, tierIndex: i };
    }
  }
  return { percent: 50, tierIndex: REWARD_TIERS.length - 1 };
}

export { REWARD_TIERS };

class AffiliateService {
  async getPromoCodes(organizationId: string): Promise<PromoCode[]> {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching promo codes:', error);
      return [];
    }

    return (data || []).map(this.mapPromoCode);
  }

  async createPromoCode(organizationId: string, userId: string, code: string): Promise<PromoCode | null> {
    const normalizedCode = code.toLowerCase().trim().replace(/\s+/g, '');

    const { data: existing } = await supabase
      .from('promo_codes')
      .select('id')
      .eq('code', normalizedCode)
      .maybeSingle();

    if (existing) {
      throw new Error('Промокод уже существует');
    }

    const { data, error } = await supabase
      .from('promo_codes')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        code: normalizedCode,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating promo code:', error);
      throw new Error('Не удалось создать промокод');
    }

    return this.mapPromoCode(data);
  }

  async deletePromoCode(promoCodeId: string): Promise<boolean> {
    const { error } = await supabase
      .from('promo_codes')
      .delete()
      .eq('id', promoCodeId);

    if (error) {
      console.error('Error deleting promo code:', error);
      return false;
    }
    return true;
  }

  async validatePromoCode(code: string): Promise<{ valid: boolean; promoCode?: any }> {
    const normalizedCode = code.toLowerCase().trim();

    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', normalizedCode)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      return { valid: false };
    }

    return { valid: true, promoCode: data };
  }

  async registerReferral(
    promoCode: string,
    referredOrgId: string
  ): Promise<boolean> {
    const { data: pc } = await supabase
      .from('promo_codes')
      .select('id, user_id, organization_id')
      .eq('code', promoCode.toLowerCase().trim())
      .eq('is_active', true)
      .maybeSingle();

    if (!pc) return false;

    if (pc.organization_id === referredOrgId) return false;

    const { error: regError } = await supabase
      .from('referral_registrations')
      .insert({
        referrer_user_id: pc.user_id,
        referrer_org_id: pc.organization_id,
        referred_org_id: referredOrgId,
        promo_code_id: pc.id,
        level: 1,
      });

    if (regError) {
      console.error('Error registering referral:', regError);
      return false;
    }

    await supabase
      .from('promo_codes')
      .update({ registrations_count: (await this.getPromoCodeStats(pc.id)).registrations + 1 })
      .eq('id', pc.id);

    const { data: referrerReg } = await supabase
      .from('referral_registrations')
      .select('referrer_user_id, referrer_org_id')
      .eq('referred_org_id', pc.organization_id)
      .eq('level', 1)
      .maybeSingle();

    if (referrerReg) {
      await supabase
        .from('referral_registrations')
        .insert({
          referrer_user_id: referrerReg.referrer_user_id,
          referrer_org_id: referrerReg.referrer_org_id,
          referred_org_id: referredOrgId,
          promo_code_id: pc.id,
          level: 2,
        });

      const { data: level2Reg } = await supabase
        .from('referral_registrations')
        .select('referrer_user_id, referrer_org_id')
        .eq('referred_org_id', referrerReg.referrer_org_id)
        .eq('level', 1)
        .maybeSingle();

      if (level2Reg) {
        await supabase
          .from('referral_registrations')
          .insert({
            referrer_user_id: level2Reg.referrer_user_id,
            referrer_org_id: level2Reg.referrer_org_id,
            referred_org_id: referredOrgId,
            promo_code_id: pc.id,
            level: 3,
          });
      }
    }

    return true;
  }

  async getAffiliateStats(organizationId: string, userId: string): Promise<AffiliateStats> {
    const { data: readyData } = await supabase
      .from('referral_transactions')
      .select('commission_amount')
      .eq('referrer_user_id', userId)
      .eq('status', 'ready');

    const readyToPay = (readyData || []).reduce((sum, t) => sum + Number(t.commission_amount), 0);

    const { data: pendingData } = await supabase
      .from('referral_transactions')
      .select('commission_amount')
      .eq('referrer_user_id', userId)
      .eq('status', 'pending');

    const pending = (pendingData || []).reduce((sum, t) => sum + Number(t.commission_amount), 0);

    const { data: paidData } = await supabase
      .from('referral_transactions')
      .select('commission_amount')
      .eq('referrer_user_id', userId)
      .eq('status', 'paid');

    const totalPaid = (paidData || []).reduce((sum, t) => sum + Number(t.commission_amount), 0);

    const { count: totalReferred } = await supabase
      .from('referral_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_org_id', organizationId)
      .eq('level', 1);

    const { count: activeClients } = await supabase
      .from('referral_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_org_id', organizationId)
      .eq('level', 1)
      .eq('is_active', true);

    return {
      readyToPay,
      pending,
      totalPaid,
      totalReferred: totalReferred || 0,
      activeClients: activeClients || 0,
    };
  }

  async getTransactions(userId: string): Promise<ReferralTransaction[]> {
    const { data, error } = await supabase
      .from('referral_transactions')
      .select('*')
      .eq('referrer_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }

    const orgIds = [...new Set((data || []).map((t: any) => t.referred_org_id))];
    const orgNames: Record<string, string> = {};
    if (orgIds.length > 0) {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', orgIds);
      (orgs || []).forEach((o: any) => { orgNames[o.id] = o.name; });
    }

    return (data || []).map((t: any) => ({
      id: t.id,
      referrerUserId: t.referrer_user_id,
      referrerOrgId: t.referrer_org_id,
      referredOrgId: t.referred_org_id,
      paymentAmount: Number(t.payment_amount),
      commissionPercent: Number(t.commission_percent),
      commissionAmount: Number(t.commission_amount),
      level: t.level,
      status: t.status,
      readyAt: t.ready_at,
      paidAt: t.paid_at,
      createdAt: t.created_at,
      referredOrgName: orgNames[t.referred_org_id] || 'N/A',
    }));
  }

  async getReferrals(organizationId: string): Promise<ReferralRegistration[]> {
    const { data, error } = await supabase
      .from('referral_registrations')
      .select('*')
      .eq('referrer_org_id', organizationId)
      .eq('level', 1)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching referrals:', error);
      return [];
    }

    const orgIds = [...new Set((data || []).map((r: any) => r.referred_org_id))];
    const orgNames: Record<string, string> = {};
    if (orgIds.length > 0) {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', orgIds);
      (orgs || []).forEach((o: any) => { orgNames[o.id] = o.name; });
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      referrerUserId: r.referrer_user_id,
      referrerOrgId: r.referrer_org_id,
      referredOrgId: r.referred_org_id,
      promoCodeId: r.promo_code_id,
      level: r.level,
      isActive: r.is_active,
      createdAt: r.created_at,
      referredOrgName: orgNames[r.referred_org_id] || 'N/A',
    }));
  }

  async extendTrialForPromo(organizationId: string): Promise<boolean> {
    const { data: org } = await supabase
      .from('organizations')
      .select('trial_end_date')
      .eq('id', organizationId)
      .maybeSingle();

    const baseDate = org?.trial_end_date ? new Date(org.trial_end_date) : new Date();
    baseDate.setDate(baseDate.getDate() + 14);

    const { error } = await supabase
      .from('organizations')
      .update({
        plan_name: 'Professional',
        subscription_status: 'trial',
        trial_end_date: baseDate.toISOString(),
        trial_extended_until: baseDate.toISOString(),
        subscription_end_date: baseDate.toISOString(),
      })
      .eq('id', organizationId);

    if (error) {
      console.error('Error extending trial:', error);
      return false;
    }
    return true;
  }

  private async getPromoCodeStats(promoCodeId: string) {
    const { count } = await supabase
      .from('referral_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('promo_code_id', promoCodeId)
      .eq('level', 1);

    return { registrations: count || 0 };
  }

  private mapPromoCode(row: any): PromoCode {
    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      code: row.code,
      registrationsCount: row.registrations_count || 0,
      paymentsCount: row.payments_count || 0,
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  }
}

export const affiliateService = new AffiliateService();
