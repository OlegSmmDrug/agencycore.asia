
export enum SystemRole {
  ADMIN = 'Admin',
  MEMBER = 'Member',
  OBSERVER = 'Observer'
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  logoUrl?: string;
  industry: string;
  companySize: string;
  timezone: string;
  plan_name?: string;
  subscription_status?: string;
  trial_end_date?: string;
  subscription_end_date?: string;
  onboardingCompletedAt?: string;
  isBlocked: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  displayName: string;
  description: string;
  priceMonthly: number;
  priceAnnual: number;
  maxUsers: number | null;
  maxProjects: number | null;
  features: Record<string, boolean>;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface OrganizationSubscription {
  id: string;
  organizationId: string;
  planId: string;
  status: 'trial' | 'active' | 'past_due' | 'canceled' | 'trial_expired';
  billingCycle: 'monthly' | 'annual';
  mrr: number;
  seatsPurchased: number;
  trialEndsAt?: string;
  currentPeriodStart: string;
  currentPeriodEnd?: string;
  canceledAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
}

export type AddonType = 'contracts' | 'analytics_pro' | 'api_access' | 'whitelabel';

export interface AddonSubscription {
  id: string;
  organizationId: string;
  addonType: AddonType;
  price: number;
  status: 'active' | 'canceled';
  activatedAt: string;
  canceledAt?: string;
  stripeSubscriptionId?: string;
  createdAt: string;
}

export type UsageMetricType = 'active_users' | 'projects' | 'api_calls' | 'storage_mb';

export interface UsageMetric {
  id: string;
  organizationId: string;
  metricType: UsageMetricType;
  currentValue: number;
  limitValue: number | null;
  periodStart: string;
  periodEnd?: string;
  updatedAt: string;
}

// Deprecated Role enum kept for compatibility during refactor if needed, 
// but we will primarily use strings for Job Titles now.
export enum Role {
  DIRECTOR = 'Director',
  SALES_MANAGER = 'Sales Manager',
  TARGETOLOGIST = 'Targetologist',
  SMM = 'SMM Specialist',
  VIDEOGRAPHER = 'Videographer'
}

export enum ProjectStatus {
  KP = 'Strategy/KP',
  PRODUCTION = 'Production',
  ADS_START = 'Ads Start',
  IN_WORK = 'In Work',
  APPROVAL = 'Approval',
  COMPLETED = 'Completed',
  ARCHIVED = 'Archived'
}

export enum TaskStatus {
  TODO = 'To Do',
  IN_PROGRESS = 'In Progress',
  REVIEW = 'Review',
  PENDING_CLIENT = 'Pending Client',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  READY = 'Ready',
  DONE = 'Done'
}

export type TaskType = 'Task' | 'Meeting' | 'Shooting' | 'Call' | 'Post' | 'Reels' | 'Stories' | 'content_post' | 'content_reel' | 'content_story';

export type TaskPriority = 'Low' | 'Medium' | 'High';

export enum ClientStatus {
  NEW_LEAD = 'New Lead',
  CONTACTED = 'Contact Established',
  PRESENTATION = 'Presentation',
  CONTRACT = 'Contract Signing',
  IN_WORK = 'In Work', // Equivalent to Active/Paying
  WON = 'Won',
  LOST = 'Lost',
  ARCHIVED = 'Archived'
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  password?: string;

  systemRole: SystemRole;
  jobTitle: string;
  allowedModules: string[];
  teamLeadId?: string;

  role?: string;

  salary: number;
  iin?: string;
  birthday?: string;
  phone?: string;
  balance?: number;
  isSuperAdmin?: boolean;
  employmentType?: 'staff' | 'ip' | 'sz' | 'nal';
}

export interface CalculatorData {
  total: number;
  description: string;
  items: Array<{ name: string; price: number; quantity?: number; serviceId?: string }>;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  status: ClientStatus;
  email: string;
  phone: string;
  budget: number;
  prepayment: number;
  source: 'Website' | 'Referral' | 'Cold Call' | 'Socials' | 'Creatium' | 'Other' | 'Manual' | 'WhatsApp' | 'Bank Import' | 'Repeat';
  managerId: string;
  description?: string;
  technicalDescription?: string;
  clientBrief?: string;
  filesLink: string;
  service: string;
  services?: string[];
  createdAt: string;
  inn?: string;
  address?: string;
  legalName?: string;
  director?: string;
  isArchived?: boolean;
  statusChangedAt?: string;
  projectLaunched?: boolean;
  progressLevel?: number;
  contractNumber?: string;
  contractStatus?: 'draft' | 'ready' | 'signed';
  calculatorData?: CalculatorData;
  bankName?: string;
  bankBik?: string;
  accountNumber?: string;
  signatoryBasis?: string;
  contractFileUrl?: string;
  contractGeneratedAt?: string;
  bin?: string;
  bank?: string;
  iban?: string;
  bik?: string;
  leadSourcePage?: string;
  leadSourceForm?: string;
  leadSourceWebsite?: string;
  leadSourceUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  ymclidMetrika?: string;
  yclidDirect?: string;
  gclid?: string;
  clientIdGoogle?: string;
  clientIdYandex?: string;
  logoUrl?: string;
  parentClientId?: string;
}

export interface ProjectScope {
  contentFreq?: string;
  targetAudience?: string;
  platforms?: string[];
}

export interface ScopeOfWorkItem {
  id: string;
  label: string;
  quantity: string;
}

export interface ProjectKpi {
  id: string;
  name: string;
  plan: number;
  fact: number;
  unit?: string;
  source?: 'manual' | 'livedune' | 'facebook';
  autoUpdate?: boolean;
  metricKey?: string;
  lastSyncedAt?: string;
}

export interface KpiPreset {
  id: string;
  name: string;
  description: string;
  category: 'smm' | 'ads';
  metric_key: string;
  source: 'livedune' | 'facebook' | 'manual';
  default_plan: number;
  unit: string;
  display_order: number;
}

export interface ProjectQuickLink {
  id: string;
  name: string;
  url: string;
  icon?: string;
  color?: string;
}

export type QuickLinksData = ProjectQuickLink[];

export interface ProjectRisk {
  id: string;
  text: string;
  severity: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface ProjectFocus {
  id: string;
  text: string;
  createdAt: string;
}

export type ProjectHealthStatus = 'excellent' | 'good' | 'warning' | 'critical';

export interface Project {
  id: string;
  clientId: string;
  organizationId?: string;
  name: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  duration: number;
  budget: number;
  totalLTV: number;
  mediaBudget?: number;
  description: string;
  teamIds: string[];
  services: string[];
  adAccountId?: string;
  facebookAccessToken?: string;
  fbAdsVisibleMetrics?: string[];
  googleAdsAccessToken?: string;
  googleAdsRefreshToken?: string;
  googleAdsCustomerId?: string;
  googleAdsVisibleMetrics?: string[];
  tiktokAdsAccessToken?: string;
  tiktokAdsAdvertiserId?: string;
  tiktokAdsVisibleMetrics?: string[];
  liveduneAccountId?: number;
  liveduneAccessToken?: string;
  isArchived?: boolean;
  scope?: ProjectScope;
  imageUrl?: string;
  kpis?: ProjectKpi[];
  quickLinks?: ProjectQuickLink[];
  quickLinksData?: QuickLinksData;
  focusWeek?: string;
  focuses?: ProjectFocus[];
  risks?: ProjectRisk[];
  workScope?: string;
  healthStatus?: ProjectHealthStatus;
  contractNumber?: string;
  contractDate?: string;
  contractScanUrl?: string;
  postsPlan?: number;
  postsFact?: number;
  reelsPlan?: number;
  reelsFact?: number;
  storiesPlan?: number;
  storiesFact?: number;
  kpiLastSyncedAt?: string;
  contentAutoCalculate?: boolean;
  contentLastCalculatedAt?: string;
  contentMetrics?: { [key: string]: { plan: number; fact: number } };
  contentMetricsVisible?: string[];
  lastContentSyncAt?: string;

  scopeOfWork?: ScopeOfWorkItem[];

  publicShareToken?: string;
  publicShareEnabled?: boolean;
  allowGuestApproval?: boolean;
  guestViewSettings?: GuestViewSettings;
}

export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
  assigneeId?: string;
  deadline?: string;
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: string; // e.g. "24.48 KB"
  type: 'image' | 'file';
  uploadedBy: string;
  uploadedAt: string;
}

export interface MediaFile {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video';
  size: number;
  duration?: number;
  thumbnailUrl?: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Task {
  id: string;
  projectId?: string;
  clientId?: string;
  assigneeId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: 'Low' | 'Medium' | 'High';
  deadline?: string;
  kpiValue?: number;

  type: TaskType;
  startTime?: string;
  endTime?: string;
  startedAt?: string;
  duration?: number;
  estimatedHours?: number;
  durationDays?: number;

  acceptanceStatus?: 'Pending' | 'Accepted' | 'Rejected';
  assignmentHistory?: AssignmentHistoryEntry[];

  address?: string;
  addressLink?: string;
  participants?: string[];
  externalParticipants?: string;
  equipment?: string;
  scenario?: string;
  callLink?: string;
  meetingWith?: string;

  tags?: string[];
  subtasks?: Subtask[];
  comments?: Comment[];
  files?: Attachment[];
  customFields?: {
    contractNumber?: string;
    prepayment?: number;
    isPaid?: boolean;
    customField1?: string;
  };
  createdAt?: string;
  completedAt?: string;
  creatorId?: string;

  mediaUrls?: string[];
  postText?: string;
  proofLink?: string;
  mediaFiles?: MediaFile[];

  clientComment?: string;
  internalComments?: InternalComment[];
  revisionHistory?: RevisionHistoryEntry[];
  approvedBy?: string;
  approvedAt?: string;
  rejectedCount?: number;

  stage_level2_id?: string;

  serviceId?: string;
  isDeprecated?: boolean;
}

// Knowledge Base Document
export interface Document {
  id: string;
  parentId: string | null; // For nesting
  title: string;
  icon?: string; // Emoji or URL
  content: string; // HTML or Markdown
  authorId: string;
  createdAt: string;
  updatedAt: string;
  allowedUserIds: string[]; // Access Control
  isPublic: boolean; // External sharing
  publicLink?: string;
  isArchived?: boolean;
  isFolder?: boolean; // If true, acts primarily as a container
}

// Financials
export enum PaymentType {
    PREPAYMENT = 'Prepayment', // Предоплата
    FULL = 'Full Payment', // Полная оплата
    POSTPAYMENT = 'Postpayment', // Постоплата
    RETAINER = 'Monthly Retainer', // Абонплата
    REFUND = 'Refund' // Возврат
}

export type TransactionCategory = 'Salary' | 'Marketing' | 'Office' | 'Other' | 'Income';

export type ReconciliationStatus = 'manual' | 'verified' | 'discrepancy' | 'bank_import';

export interface Transaction {
    id: string;
    clientId: string;
    projectId?: string;
    userId?: string;
    payrollRecordId?: string;
    amount: number;
    date: string;
    type: PaymentType;
    category?: TransactionCategory;
    description?: string;
    isVerified: boolean;
    createdBy?: string;
    createdAt?: string;
    reconciliationStatus?: ReconciliationStatus;
    bankDocumentNumber?: string;
    bankAmount?: number;
    bankClientName?: string;
    bankBin?: string;
    bankImportedAt?: string;
    linkedTransactionId?: string;
    amountDiscrepancy?: boolean;
}

export interface BankCounterpartyAlias {
    id: string;
    organizationId: string;
    bankName: string;
    bankBin: string;
    clientId: string;
    createdAt: string;
    updatedAt: string;
}

export interface IntegrationStats {
  platform: 'Facebook' | 'Livedune';
  metric: string;
  value: number;
  trend: number; // percentage
}

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
  timestamp: Date;
}

export interface SystemNotification {
  id: string;
  userId: string;
  type: 'task_assigned' | 'task_reassigned' | 'deadline_approaching' | 'task_overdue' | 'task_rejected' | 'task_completed';
  title: string;
  message: string;
  entityType?: 'task' | 'project' | 'client';
  entityId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface AssignmentHistoryEntry {
  fromUserId?: string;
  toUserId?: string;
  reason?: string;
  timestamp: string;
  changedBy?: string;
}

// Advertising Interfaces
export interface AdAccount {
  id: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED';
}

export interface AdCampaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  objective?: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  cpl: number;
  roas: number;
  reach?: number;
  frequency?: number;
  messaging_conversations_started?: number;
  cost_per_messaging_conversation_started?: number;
}

export interface AdSet {
  id: string;
  name: string;
  campaignId: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads?: number;
  cpl?: number;
  roas?: number;
  reach?: number;
  messaging_conversations_started?: number;
  cost_per_messaging_conversation_started?: number;
}

export interface Ad {
  id: string;
  name: string;
  adsetId: string;
  campaignId: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads?: number;
  cpl?: number;
  roas?: number;
  reach?: number;
  messaging_conversations_started?: number;
  cost_per_messaging_conversation_started?: number;
}

export interface AdAccountStats {
  currency: string;
  totalSpend: number;
  totalLeads: number;
  averageCpl: number;
  averageRoas: number;
  ctr: number;
  cpm: number;
  totalMessagingConversations?: number;
  costPerMessagingConversation?: number;
  totalImpressions?: number;
  totalClicks?: number;
  averageCtr?: number;
  dailyStats: {
    date: string;
    spend: number;
    leads: number;
    roas: number;
    messaging_conversations?: number;
  }[];
}

// Livedune Interfaces
export interface LiveduneAccount {
  id: number;
  social_id: string;
  type: string; // instagram_new, vk_group, etc
  short_name: string; // username
  name: string;
  img: string;
  url: string;
  project: string;
}

export interface LiveduneAnalyticsResponse {
  followers: number;
  followers_diff: number;
  posts: number;
  likes: number;
  likes_avg: number;
  comments: number;
  comments_avg: number;
  views: number;
  views_avg: number;
  reposts: number;
  er: number;
  er_views: number;
}

export interface LivedunePost {
  id: number;
  post_id: string;
  type: string;
  text: string;
  created: string;
  url: string;
  reactions: {
    likes: number;
    comments: number;
    shares?: number;
    saved?: number;
  };
  reach: {
    total: number;
    organic?: number;
    ads?: number;
  };
  engagement_rate?: number;
}

export interface LiveduneAudience {
  gender: { [key: string]: number }; // F, M, U
  age: { [key: string]: number }; // 13-17, 18-24, etc
}

export interface LiveduneStory {
  id: number;
  story_id: string;
  created: string;
  url: string;
  views: number;
  replies: number;
  interactions: number;
  exits: number;
  reach: number;
  impressions: number;
  engagement_rate?: number;
}

export interface LiveduneReels {
  id: number;
  reel_id: string;
  created: string;
  url: string;
  text: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  plays: number;
  engagement_rate?: number;
}

export interface LiveduneDetailedAnalytics extends LiveduneAnalyticsResponse {
  stories_count?: number;
  stories_views?: number;
  stories_views_avg?: number;
  stories_reach?: number;
  stories_reach_avg?: number;
  stories_replies?: number;
  stories_engagement?: number;
  reels_count?: number;
  reels_views?: number;
  reels_likes?: number;
  reels_shares?: number;
  profile_views?: number;
  website_clicks?: number;
  saves?: number;
  saves_avg?: number;
  impressions?: number;
  reach?: number;
  posts_reach?: number;
  monthly_reach?: number;
  ad_reach?: number;
  followers_change_percent?: number;
  likes_change?: number;
  likes_change_percent?: number;
  comments_change?: number;
  comments_change_percent?: number;
  saves_change?: number;
  saves_change_percent?: number;
}

// Roadmap Templates
export interface RoadmapStage {
  name: string;
  tasks: string[];
}

export interface RoadmapTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  stages: RoadmapStage[];
  totalTasks: number;
  totalStages: number;
}

export interface Level1Stage {
  id: string;
  name: string;
  orderIndex: number;
  color?: string;
  icon?: string;
  createdAt: string;
}

export interface Level1StageStatus {
  id: string;
  projectId: string;
  level1StageId: string;
  status: 'locked' | 'active' | 'completed';
  startedAt?: string;
  completedAt?: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

// WhatsApp Integration Types
export interface WazzupChannel {
  id: string;
  channelId: string;
  channelName: string;
  phoneNumber: string;
  status: 'active' | 'disconnected' | 'pending';
  qrCode?: string;
  transport: string;
  lastSync: string;
}

export interface WhatsAppMessage {
  id: string;
  clientId: string;
  messageId?: string;
  direction: 'incoming' | 'outgoing';
  content: string;
  senderName?: string;
  userId?: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  mediaFilename?: string;
  channelId?: string;
  chatId?: string;
  chatName?: string;
  chatType?: string;
  isRead: boolean;
}

export interface WhatsAppChat {
  id: string;
  chatId: string;
  chatName: string;
  chatType: 'individual' | 'group';
  clientId?: string;
  phone?: string;
  lastMessageAt?: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessage?: WhatsAppMessage;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  createdBy?: string;
}

export interface ProjectFinancials {
  projectId: string;
  revenue: number;
  expenses: number;
  margin: number;
  smmType: 'piece' | 'project';
  smmFixedSalary: number;
  cntPosts: number;
  cntReels: number;
  cntStories: number;
  cntSpecDesign: number;
  cntMonitoring: boolean;
  cntDubbing: number;
  cntScenarios: number;
  prodMobilographyHours: number;
  prodPhotographerHours: number;
  prodVideoCost: number;
  prodModelsCost: number;
  mediaSpend: number;
  unforeseenCost: number;
}

export interface KpiRule {
  taskType: TaskType;
  value: number;
}

export interface SalaryScheme {
  id: string;
  targetId: string;
  targetType: 'jobTitle' | 'user';
  baseSalary: number;
  kpiRules: KpiRule[];
  pmBonusPercent?: number;
}

export interface PayrollRecord {
  id: string;
  userId: string;
  month: string;
  fixSalary: number;
  calculatedKpi: number;
  manualBonus: number;
  manualPenalty: number;
  advance: number;
  status: 'DRAFT' | 'FROZEN' | 'PAID';
  balanceAtStart: number;
  paidAt?: string;
  netAmount?: number;
  taskPayments?: Array<{
    task_id: string;
    task_title: string;
    task_type: string;
    hours: number;
    rate: number;
    amount: number;
    completed_at: string;
  }>;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  authorId: string;
  projectId?: string;
  clientId?: string;
  tags: string[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DynamicExpenseItem {
  serviceName: string;
  count: number;
  rate: number;
  cost: number;
  category: string;
  syncedAt: string;
}

export interface DynamicExpenses {
  [serviceId: string]: DynamicExpenseItem;
}

export interface SalaryCalculationItem {
  userName: string;
  jobTitle: string;
  baseSalary: number;
  activeProjectsCount: number;
  shareForThisProject: number;
  calculatedAt: string;
}

export interface SalaryCalculations {
  [userId: string]: SalaryCalculationItem;
}

export type SyncSource = 'auto' | 'manual' | 'mixed';

export interface CategoryCostBreakdown {
  category: 'smm' | 'video' | 'target' | 'sites' | 'salaries' | 'fot' | 'models' | 'other';
  categoryName: string;
  totalCost: number;
  percentage: number;
  items: {
    name: string;
    count?: number;
    rate?: number;
    cost: number;
  }[];
}

export interface CostAnalysis {
  totalCost: number;
  totalRevenue: number;
  netProfit: number;
  marginPercent: number;
  categories: CategoryCostBreakdown[];
  topExpenseCategories: {
    category: string;
    amount: number;
    percentage: number;
  }[];
}

export interface FotCalculationItem {
  userName: string;
  jobTitle: string;
  baseSalary: number;
  activeProjectsCount: number;
  shareForThisProject: number;
  calculatedAt: string;
}

export interface FotCalculations {
  [userId: string]: FotCalculationItem;
}

export interface ProjectExpense {
  id: string;
  projectId: string;
  month: string;

  smmExpenses: number;
  smmPostsCount: number;
  smmReelsCount: number;
  smmStoriesCount: number;
  smmSpecDesignCount: number;
  smmMonitoring: boolean;
  smmDubbingCount: number;
  smmScenariosCount: number;
  smmManualAdjustment: number;

  pmExpenses: number;
  pmSalaryShare: number;
  pmProjectCount: number;

  productionExpenses: number;
  productionMobilographHours: number;
  productionPhotographerHours: number;
  productionVideographerHours: number;
  productionVideoCost: number;
  productionManualAdjustment: number;

  modelsExpenses: number;

  targetologistExpenses: number;
  targetologistSalaryShare: number;
  targetologistProjectCount: number;

  fotExpenses: number;
  fotCalculations?: FotCalculations;

  otherExpenses: number;
  otherExpensesDescription: string;

  totalExpenses: number;
  revenue: number;
  marginPercent: number;

  notes: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;

  dynamicExpenses?: DynamicExpenses;
  lastSyncedAt?: string;
  syncSource?: SyncSource;
  salaryCalculations?: SalaryCalculations;
  contentMetricsSnapshot?: Record<string, { plan: number; fact: number }>;
}

export interface ProjectExpenseHistory {
  id: string;
  expenseId: string;
  changedBy?: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changeReason: string;
  createdAt: string;
}

export interface InternalComment {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  isInternal: true;
}

export interface RevisionHistoryEntry {
  id: string;
  status: TaskStatus;
  comment?: string;
  changedBy: string;
  changedByType: 'user' | 'guest';
  timestamp: string;
}

export interface GuestViewSettings {
  hideInternalNotes: boolean;
  hideFinances: boolean;
  hidePricing: boolean;
}

export interface GuestUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  preferences: {
    emailNotifications: boolean;
    smsNotifications: boolean;
  };
  createdAt: string;
  lastAccessAt: string;
}

export type GuestPermission =
  | 'viewTasks'
  | 'approveContent'
  | 'addComments'
  | 'viewOverview'
  | 'viewRoadmap'
  | 'viewNotes'
  | 'viewCalendar'
  | 'viewFacebook'
  | 'viewGoogle'
  | 'viewTikTok'
  | 'viewLivedune';

export interface GuestAccess {
  id: string;
  projectId: string;
  token: string;
  permissions: GuestPermission[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  lastUsedAt: string;
  managerName?: string;
  managerPhone?: string;
  managerEmail?: string;
}

export interface GuestProjectAccess {
  id: string;
  guestId: string;
  projectId: string;
  accessTokenId: string;
  registeredAt: string;
}

export interface GuestTaskView {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  deadline?: string;
  type: TaskType;
  mediaUrls?: string[];
  mediaFiles?: MediaFile[];
  postText?: string;
  proofLink?: string;
  clientComment?: string;
  revisionHistory?: RevisionHistoryEntry[];
  rejectedCount?: number;
  creatorId?: string;
  createdAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  creatorName?: string;
  approvedByName?: string;
}

export interface ApprovalStats {
  totalTasks: number;
  pendingApproval: number;
  approved: number;
  rejected: number;
  approvalRate: number;
  averageApprovalTimeHours: number;
  averageRevisionsPerTask: number;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export type MetricSource =
  | 'sales_revenue'
  | 'project_retention'
  | 'manual_kpi'
  | 'tasks_completed'
  | 'cpl_efficiency'
  | 'custom_metric';

export type ConditionType = 'always' | 'threshold' | 'tiered';
export type RewardType = 'percent' | 'fixed_amount';
export type CalculationPeriod = 'monthly' | 'quarterly' | 'per_transaction';

export interface TieredConfigItem {
  min: number;
  max: number;
  reward: number;
}

export interface BonusRule {
  id: string;
  ownerType: 'jobTitle' | 'user';
  ownerId: string;
  name: string;
  metricSource: MetricSource;
  conditionType: ConditionType;
  thresholdValue?: number;
  thresholdOperator?: '>=' | '<=' | '=' | '>' | '<';
  tieredConfig?: TieredConfigItem[];
  rewardType: RewardType;
  rewardValue: number;
  applyToBase: boolean;
  isActive: boolean;
  calculationPeriod: CalculationPeriod;
  description?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AgentRole = 'seller' | 'project_writer' | 'tz_writer' | 'executor_controller' | 'finalizer' | 'review_collector';

export type CommunicationStyle = 'business' | 'scientific' | 'conversational' | 'custom';

export type AgentStatus = 'active' | 'inactive';

export type TriggerType = 'creatium_webhook' | 'whatsapp_incoming' | 'task_created' | 'project_finished' | 'payment_received' | 'cron_daily';

export type ActionType = 'create_lead' | 'create_task' | 'create_project' | 'update_client' | 'send_whatsapp' | 'create_proposal';

export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed';

export interface AgentPermissions {
  createTasks: boolean;
  updateClient: boolean;
  sendWhatsApp: boolean;
  readDocs: boolean;
  createProposal: boolean;
}

export interface AgentSettings {
  communicationStyle: CommunicationStyle;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  useKnowledgeBase: boolean;
  dailyCostLimit: number;
  autoMode: boolean;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  priority?: number;
}

export interface DocumentItem {
  id: string;
  title: string;
  fileUrl: string;
  fileType: string;
  uploadedAt: string;
}

export interface KnowledgeBase {
  faqs: FAQItem[];
  documents: DocumentItem[];
}

export interface AIAgent {
  id: string;
  organizationId?: string;
  name: string;
  model: string;
  role: AgentRole;
  status: AgentStatus;
  triggers: TriggerType[];
  settings: AgentSettings;
  permissions: AgentPermissions;
  knowledgeBase: KnowledgeBase;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    leadScore?: number;
    extractedInfo?: Record<string, any>;
    triggers?: string[];
  };
}

export interface Lead {
  id: string;
  organizationId?: string;
  agentId?: string;
  name: string;
  phone?: string;
  email?: string;
  budget?: number;
  status: 'qualified' | 'proposal' | 'contract';
  score: number;
  extractedData?: Record<string, any>;
  source?: string;
  lastContact: number;
  createdAt?: number;
}

export interface AIAction {
  id: string;
  agentId: string;
  agentName: string;
  organizationId?: string;
  actionType: ActionType;
  description: string;
  reasoning: string;
  data: Record<string, any>;
  status: ActionStatus;
  reviewedBy?: string;
  reviewedAt?: number;
  createdAt: number;
  proposedAction?: any;
}

export interface UsageStats {
  requestsToday: number;
  tokensUsed: number;
  costSpent: number;
  successRate: number;
}
