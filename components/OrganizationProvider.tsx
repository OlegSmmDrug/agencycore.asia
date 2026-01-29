import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Organization, OrganizationSubscription, SubscriptionPlan, UsageMetric } from '../types';
import { organizationService } from '../services/organizationService';

interface OrganizationContextType {
  organization: Organization | null;
  subscription: OrganizationSubscription | null;
  plan: SubscriptionPlan | null;
  usageMetrics: UsageMetric[];
  loading: boolean;
  refreshOrganization: () => Promise<void>;
  checkFeature: (featureName: string) => boolean;
  checkLimit: (metricType: string) => boolean;
  getUsage: (metricType: string) => { current: number; limit: number | null } | null;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [subscription, setSubscription] = useState<OrganizationSubscription | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrganizationData = async () => {
    try {
      setLoading(true);

      const org = await organizationService.getCurrentOrganization();
      setOrganization(org);

      if (org) {
        const [sub, metrics] = await Promise.all([
          organizationService.getOrganizationSubscription(org.id),
          organizationService.getUsageMetrics(org.id)
        ]);

        setSubscription(sub);
        setUsageMetrics(metrics);

        if (sub) {
          const planData = await organizationService.getSubscriptionPlan(sub.planId);
          setPlan(planData);
        }
      }
    } catch (error) {
      console.error('Error loading organization data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizationData();
  }, []);

  const refreshOrganization = async () => {
    await loadOrganizationData();
  };

  const checkFeature = (featureName: string): boolean => {
    if (!plan) return false;
    return plan.features[featureName] === true;
  };

  const checkLimit = (metricType: string): boolean => {
    const metric = usageMetrics.find(m => m.metricType === metricType);
    if (!metric) return true;
    if (metric.limitValue === null) return true;
    return metric.currentValue < metric.limitValue;
  };

  const getUsage = (metricType: string): { current: number; limit: number | null } | null => {
    const metric = usageMetrics.find(m => m.metricType === metricType);
    if (!metric) return null;
    return {
      current: metric.currentValue,
      limit: metric.limitValue
    };
  };

  const value: OrganizationContextType = {
    organization,
    subscription,
    plan,
    usageMetrics,
    loading,
    refreshOrganization,
    checkFeature,
    checkLimit,
    getUsage
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = (): OrganizationContextType => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
