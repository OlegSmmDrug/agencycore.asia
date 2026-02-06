import { supabase } from '../lib/supabase';
import type { Organization, OrganizationSubscription, SubscriptionPlan, UsageMetric } from '../types';

export const organizationService = {
  async getCurrentOrganization(): Promise<Organization | null> {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return null;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', authData.user.id)
        .maybeSingle();

      if (!userData?.organization_id) return null;

      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', userData.organization_id)
        .maybeSingle();

      if (error) throw error;
      return data ? this.mapOrganization(data) : null;
    }

    const user = JSON.parse(storedUser);
    if (!user.organizationId) return null;

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', user.organizationId)
      .maybeSingle();

    if (error) throw error;
    return data ? this.mapOrganization(data) : null;
  },

  mapOrganization(data: any): Organization {
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      ownerId: data.owner_id,
      logoUrl: data.logo_url,
      industry: data.industry,
      companySize: data.company_size,
      timezone: data.timezone,
      onboardingCompletedAt: data.onboarding_completed_at,
      isBlocked: data.is_blocked,
      isDeleted: data.is_deleted,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  },

  async getOrganizationSubscription(organizationId: string): Promise<OrganizationSubscription | null> {
    const { data, error } = await supabase
      .from('organization_subscriptions')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      organizationId: data.organization_id,
      planId: data.plan_id,
      status: data.status,
      billingCycle: data.billing_cycle,
      mrr: data.mrr,
      seatsPurchased: data.seats_purchased,
      trialEndsAt: data.trial_ends_at,
      currentPeriodStart: data.current_period_start,
      currentPeriodEnd: data.current_period_end,
      canceledAt: data.canceled_at,
      stripeCustomerId: data.stripe_customer_id,
      stripeSubscriptionId: data.stripe_subscription_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  },

  async getSubscriptionPlan(planId: string): Promise<SubscriptionPlan | null> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      displayName: data.display_name,
      description: data.description,
      priceMonthly: data.price_monthly,
      priceAnnual: data.price_annual,
      maxUsers: data.max_users,
      maxProjects: data.max_projects,
      features: data.features,
      isActive: data.is_active,
      sortOrder: data.sort_order,
      createdAt: data.created_at
    };
  },

  async getAllPlans(): Promise<SubscriptionPlan[]> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return (data || []).map(plan => ({
      id: plan.id,
      name: plan.name,
      displayName: plan.display_name,
      description: plan.description,
      priceMonthly: plan.price_monthly,
      priceAnnual: plan.price_annual,
      maxUsers: plan.max_users,
      maxProjects: plan.max_projects,
      features: plan.features,
      isActive: plan.is_active,
      sortOrder: plan.sort_order,
      createdAt: plan.created_at
    }));
  },

  async getUsageMetrics(organizationId: string): Promise<UsageMetric[]> {
    const { data, error } = await supabase
      .from('usage_metrics')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;

    return (data || []).map(metric => ({
      id: metric.id,
      organizationId: metric.organization_id,
      metricType: metric.metric_type,
      currentValue: metric.current_value,
      limitValue: metric.limit_value,
      periodStart: metric.period_start,
      periodEnd: metric.period_end,
      updatedAt: metric.updated_at
    }));
  },

  async checkFeatureAccess(organizationId: string, featureName: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_feature_access', {
      org_id: organizationId,
      feature_name: featureName
    });

    if (error) {
      console.error('Error checking feature access:', error);
      return false;
    }

    return data || false;
  },

  async checkUsageLimit(organizationId: string, metricType: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_usage_limit', {
      org_id: organizationId,
      metric_type: metricType
    });

    if (error) {
      console.error('Error checking usage limit:', error);
      return false;
    }

    return data || false;
  },

  async createOrganization(data: {
    name: string;
    slug: string;
    ownerId: string;
    industry?: string;
    companySize?: string;
    timezone?: string;
  }): Promise<Organization> {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    const { data: org, error } = await supabase
      .from('organizations')
      .insert({
        name: data.name,
        slug: data.slug,
        owner_id: data.ownerId,
        industry: data.industry || 'marketing_agency',
        company_size: data.companySize || '1-10',
        timezone: data.timezone || 'Asia/Almaty',
        onboarding_completed_at: new Date().toISOString(),
        plan_name: 'Professional',
        subscription_status: 'trial',
        trial_end_date: trialEnd.toISOString(),
        subscription_end_date: trialEnd.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapOrganization(org);
  }
};
