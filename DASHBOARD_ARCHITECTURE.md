# Dashboard Architecture Documentation

## Overview

The AgencyOS dashboard system is designed with a **role-based architecture** that dynamically displays personalized dashboards based on the user's job title. Each role sees only the metrics and data that are relevant to their daily work, improving focus and productivity.

## Architecture Components

### 1. Role Detection System

**Location:** `utils/dashboardConfig.ts`

```typescript
export type DashboardType = 'director' | 'sales' | 'targetologist' | 'pm' | 'creative' | 'intern';

export const getDashboardType = (user: User): DashboardType
```

The system analyzes the user's `jobTitle` field and maps it to one of six dashboard types:

- **Director** - CEO, Director
- **Sales** - Sales Manager
- **Targetologist** - Media Buyer, Targetologist
- **PM** - Project Manager
- **Creative** - SMM, Designer, Videographer, Copywriter, Mobilograph
- **Intern** - Trainees

### 2. Dashboard Components

All specialized dashboards are located in `components/dashboard/`:

#### Director Dashboard (`DirectorDashboard.tsx`)
**Purpose:** Operational health check, cash flow monitoring, risk assessment

**Key Widgets:**
- **Cash Gap Indicator** - Critical 7-day liquidity forecast
  - Compares incoming payments vs mandatory expenses
  - Visual alert if gap is negative
  - Actionable recommendations
- **Top Debtors Table** - Overdue receivables with color-coded aging
- **Sales Pulse Metrics** - New leads and contracts in signing stage
- **Stalled Projects Alert** - Projects inactive for >5 days

**Data Requirements:**
```typescript
interface DirectorDashboardProps {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  transactions: Transaction[];
}
```

**Example Mock Data for Cash Gap:**
```json
{
  "transactions": [
    {
      "id": "tx1",
      "clientId": "client1",
      "amount": 5000000,
      "date": "2026-01-15",
      "type": "incoming"
    },
    {
      "id": "tx2",
      "amount": -3000000,
      "date": "2026-01-16",
      "type": "payroll"
    }
  ]
}
```

---

#### Targetologist Dashboard (`TargetologistDashboard.tsx`)
**Purpose:** Multi-project ad campaign monitoring, budget control, KPI tracking

**Layout:** Grid of Project Cards (not table-based)

**Project Card Structure:**
```typescript
interface ProjectCardData {
  project: Project;
  client: Client;
  dailySpend: number;      // Current daily spend
  dailyLimit: number;      // Daily budget limit
  currentCPL: number;      // Cost Per Lead (actual)
  targetCPL: number;       // Target CPL
  leadsToday: number;      // Leads generated today
  status: 'active' | 'learning' | 'paused' | 'rejected';
  platform: 'facebook' | 'instagram' | 'tiktok' | 'google';
}
```

**Visual Features:**
- **Budget Bar** - Visual progress bar (red if overspent)
- **CPL Indicator** - Large display with green/red status
- **Platform Icon** - Emoji-based platform identification
- **Status Badge** - Campaign status with color coding

**Global Metrics:**
- Total spend today (all projects)
- Total leads today
- Active campaigns count
- Budget overrun alerts

**Example Mock Data:**
```json
{
  "project": {
    "id": "proj1",
    "name": "Instagram Ads",
    "mediaBudget": 900000
  },
  "currentCPL": 4200,
  "targetCPL": 5000,
  "leadsToday": 15,
  "dailySpend": 63000,
  "status": "active",
  "platform": "instagram"
}
```

---

#### Sales Manager Dashboard (`SalesManagerDashboard.tsx`)
**Purpose:** Personal quota achievement, daily activity velocity, pipeline management

**Key Features:**

**1. Quota Progress (Hero Section)**
- Large thermometer-style progress bar
- Monthly revenue vs goal
- Personal income calculation (salary + 10% commission)
- Days remaining to goal

**2. Daily Activity Tracker**
- Circular progress rings for:
  - Calls made vs daily goal (20)
  - Meetings booked vs daily goal (3)

**3. Sales Funnel Visualization**
- Bar chart showing client count by stage:
  - New Lead → Contacted → Presentation → Contract → In Work
  - Color-coded conversion rates

**4. Focus Zone (Actionable Items)**
- **New Leads (Unclaimed)** - Requires immediate contact
- **Stalled Deals (>24h)** - No status update in 24+ hours

**5. Today's Task Feed**
- Chronological list of calls and meetings
- Time-based sorting

**Example Mock Data:**
```json
{
  "monthlyGoal": 10000000,
  "monthRevenue": 6500000,
  "currentUserSalary": 500000,
  "dailyCallsGoal": 20,
  "callsToday": 14,
  "dailyMeetingsGoal": 3,
  "meetingsToday": 2,
  "funnelData": [
    { "name": "Новый лид", "count": 12 },
    { "name": "Контакт", "count": 8 },
    { "name": "Презентация", "count": 5 },
    { "name": "Договор", "count": 3 },
    { "name": "В работе", "count": 2 }
  ]
}
```

---

#### Project Manager Dashboard (`ProjectManagerDashboard.tsx`)
**Purpose:** Flow management, deadline tracking, content approval bottlenecks

**Key Features:**

**1. Operational Stats**
- Projects in work (count)
- Awaiting client approval (critical bottleneck)
- Upcoming deadlines (<48h)
- Ready for payment trigger

**2. Project Pipeline (Kanban-style)**
Grouped by stages:
- **Briefing** - New projects in discovery
- **Production** - Active content creation
- **Review** - Internal quality check
- **Active** - Live and running

Each card shows:
- Project name and client
- Task completion progress bar
- Budget and end date

**3. Content Calendar Widget**
Mini-calendar showing scheduled content:
- **Today** - Posts, Reels, Stories due today
- **Tomorrow** - Upcoming content pipeline

Content types with color coding:
- Post (purple)
- Reels (pink)
- Stories (orange)

**4. Urgent Deadlines Panel**
Tasks due in <48 hours with:
- Hours remaining countdown
- Project context
- Alert badge

**5. Awaiting Client Panel**
Tasks stuck in "Pending Client" status

**Example Mock Data:**
```json
{
  "activeProjects": 8,
  "awaitingApproval": 5,
  "upcomingDeadlines": 3,
  "readyForPayment": 7,
  "contentToday": [
    {
      "id": "task1",
      "title": "Instagram Post - New Product Launch",
      "type": "Post",
      "projectId": "proj1",
      "deadline": "2026-01-13T14:00:00Z"
    }
  ]
}
```

---

### 3. Reusable Widget Library

**Location:** `components/dashboard/DashboardWidgets.tsx`

**Available Components:**

1. **MetricCard** - Standard KPI card with icon
   - Props: title, value, subtitle, icon, trend, alert level
   - Use for single metrics

2. **ProgressCard** - Progress bar with current/target
   - Props: title, current, target, unit, color
   - Use for goals and quotas

3. **AlertBadge** - Status badge with color coding
   - Props: level (info/warning/danger), children
   - Use for status indicators

4. **DataTable** - Clean data table component
   - Props: headers, rows, onRowClick
   - Use for lists of items

5. **EmptyState** - Placeholder for empty lists
   - Props: icon, title, description
   - Use when no data is available

---

## Data Flow Architecture

```
App.tsx
  └─> Dashboard.tsx (Router)
      ├─> getDashboardType(user) → DashboardType
      └─> Switch on DashboardType
          ├─> DirectorDashboard
          ├─> SalesManagerDashboard
          ├─> TargetologistDashboard
          ├─> ProjectManagerDashboard
          └─> Default (Creative/Intern placeholder)
```

Each dashboard:
1. Receives full datasets (clients, projects, tasks, transactions)
2. Filters data based on currentUserId
3. Calculates role-specific metrics
4. Renders specialized widgets

---

## Adding New Dashboards

To add a new dashboard type:

1. **Update `dashboardConfig.ts`:**
   ```typescript
   export type DashboardType = ... | 'newRole';

   // Add mapping in getDashboardType()
   if (jobTitle.includes('newrole')) {
     return 'newRole';
   }
   ```

2. **Create component:**
   ```typescript
   // components/dashboard/NewRoleDashboard.tsx
   const NewRoleDashboard: React.FC<Props> = ({ ... }) => {
     // Filter data
     // Calculate metrics
     // Render UI
   };
   ```

3. **Add to router in Dashboard.tsx:**
   ```typescript
   case 'newRole':
     return <NewRoleDashboard {...props} />;
   ```

---

## Design Principles

1. **Data Density with Readability**
   - Show maximum relevant information
   - Use white space intentionally
   - Clear visual hierarchy

2. **Actionability First**
   - Highlight items requiring immediate attention
   - Use color-coded alerts (red/yellow/green)
   - Provide context for every metric

3. **Performance Focus**
   - Filter data early in the pipeline
   - Memoize expensive calculations
   - Lazy load heavy components

4. **Responsive Design**
   - Mobile-first approach
   - Grid layouts adapt to screen size
   - Touch-friendly interactions

5. **Consistent Visual Language**
   - Use widget library for common patterns
   - Maintain color scheme across roles
   - Icons from Lucide React only

---

## Current Implementation Status

✅ **Implemented:**
- Director Dashboard with Cash Gap Widget
- Targetologist Dashboard with Project Cards
- Sales Manager Dashboard with Quota Tracking
- Project Manager Dashboard with Pipeline View
- Role detection system
- Reusable widget library
- Dashboard routing

⏳ **Placeholder (Future Implementation):**
- Creative Dashboard (SMM, Designer, Videographer)
- Intern Dashboard

---

## Testing Guidelines

To test each dashboard:

1. **Create test users** with different job titles:
   - "CEO" → Director Dashboard
   - "Sales Manager" → Sales Dashboard
   - "Targetologist" → Targetologist Dashboard
   - "PM / Project Manager" → PM Dashboard

2. **Populate test data:**
   - Add clients assigned to sales manager
   - Create projects with media budgets
   - Add transactions for cash gap calculation
   - Create tasks assigned to different roles

3. **Verify filtering:**
   - Each role sees only their data
   - Admin sees everything
   - Calculations are correct for filtered data

---

## Mock Data Examples

### Complete Dashboard Test Dataset

```typescript
// Test User (Sales Manager)
const testUser: User = {
  id: 'user1',
  name: 'Иван Иванов',
  email: 'ivan@agency.com',
  jobTitle: 'Sales Manager',
  systemRole: SystemRole.MEMBER,
  salary: 500000,
  allowedModules: ['dashboard', 'crm', 'tasks']
};

// Test Clients
const testClients: Client[] = [
  {
    id: 'client1',
    name: 'Алексей Петров',
    company: 'TechCorp',
    status: ClientStatus.NEW_LEAD,
    managerId: 'user1',
    budget: 3000000,
    createdAt: '2026-01-10',
    // ... other fields
  },
  {
    id: 'client2',
    name: 'Мария Сидорова',
    company: 'BeautyBrand',
    status: ClientStatus.IN_WORK,
    managerId: 'user1',
    budget: 5000000,
    createdAt: '2025-12-15',
    // ... other fields
  }
];

// Test Transactions
const testTransactions: Transaction[] = [
  {
    id: 'tx1',
    clientId: 'client2',
    amount: 1500000,
    date: '2026-01-05',
    type: PaymentType.INCOME,
    description: 'Предоплата'
  },
  {
    id: 'tx2',
    amount: -800000,
    date: '2026-01-15',
    type: PaymentType.EXPENSE,
    description: 'Зарплата команды'
  }
];

// Test Projects
const testProjects: Project[] = [
  {
    id: 'proj1',
    clientId: 'client2',
    name: 'Instagram SMM',
    status: ProjectStatus.IN_WORK,
    budget: 500000,
    mediaBudget: 900000,
    startDate: '2026-01-01',
    endDate: '2026-02-01',
    teamIds: ['user1'],
    // ... other fields
  }
];

// Test Tasks
const testTasks: Task[] = [
  {
    id: 'task1',
    projectId: 'proj1',
    assigneeId: 'user1',
    title: 'Звонок клиенту',
    status: TaskStatus.TODO,
    type: 'Call',
    priority: 'High',
    deadline: '2026-01-13T16:00:00Z'
  },
  {
    id: 'task2',
    projectId: 'proj1',
    assigneeId: 'user1',
    title: 'Встреча по стратегии',
    status: TaskStatus.TODO,
    type: 'Meeting',
    priority: 'High',
    deadline: '2026-01-14T10:00:00Z'
  }
];
```

---

## Performance Considerations

1. **Data Filtering:**
   - Filter at the top level in each dashboard
   - Avoid filtering inside render loops
   - Use useMemo for expensive calculations

2. **Lazy Loading:**
   - Consider code-splitting for heavy dashboards
   - Use React.lazy() for dashboard components

3. **Caching:**
   - Cache calculated metrics with useMemo
   - Memoize child components with React.memo

4. **Optimization:**
   - Limit number of chart data points
   - Use virtual scrolling for long lists
   - Debounce real-time updates

---

## Security Considerations

1. **Data Access:**
   - Always filter by currentUserId
   - Never expose other users' data
   - Verify permissions server-side (RLS in Supabase)

2. **Sensitive Information:**
   - Mask sensitive financial data for non-admin roles
   - Log access to critical metrics
   - Audit trail for data exports

---

## Future Enhancements

1. **Customization:**
   - Allow users to configure widget visibility
   - Drag-and-drop dashboard builder
   - Save personal preferences

2. **Real-time Updates:**
   - WebSocket integration for live metrics
   - Animated transitions for data changes
   - Push notifications for alerts

3. **Advanced Analytics:**
   - Historical trend comparison
   - Predictive analytics with AI
   - Custom report builder

4. **Mobile App:**
   - Native mobile dashboard views
   - Offline-first architecture
   - Push notifications

---

## Support & Maintenance

For questions or issues with the dashboard system:

1. Check this documentation first
2. Review the code in `components/dashboard/`
3. Test with mock data examples provided
4. Verify role detection logic in `dashboardConfig.ts`

---

**Last Updated:** January 13, 2026
**Version:** 1.0.0
**Maintainer:** AgencyOS Development Team

---

## Project Race Track Widget

The **Project Race Track** is a special live-tracking widget that visualizes project progress across multiple stages. It appears in:
- **Director Dashboard** - Shows ALL projects (admin view)
- **Project Manager Dashboard** - Shows only PM's assigned projects (filtered view)

### Visual Design
```
🏎️ Гонка проектов (Live)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Project Cards in Race Track Layout]
Each showing:
- Client name
- Current stage (Подготовка/Продакшн/Запуск/Финал)
- Progress bar
- Status indicator
```

### Stages
1. **Подготовка** - Initial setup, briefing, planning
2. **Продакшн** - Active content creation, development
3. **Запуск** - Launch preparation, testing
4. **Финал** - Live, completed

### Data Source
The widget uses `level1StageService` to fetch real-time stage statuses from Supabase for each project.

### Filtering Logic

**For Director (Admin):**
```typescript
// In DirectorDashboard.tsx
<ProjectRaceTrack 
  projects={projects}  // ALL projects, no filtering
  tasks={tasks}
  clients={clients}
/>
```

**For Project Manager:**
```typescript
// In ProjectManagerDashboard.tsx
const myProjects = projects.filter(p => 
  myProjectIds.includes(p.id) || 
  p.teamIds?.includes(currentUserId)
);

<ProjectRaceTrack 
  projects={myProjects}  // Only PM's projects
  tasks={tasks}
  clients={clients}
/>
```

### Key Features
- 🔴 **Real-time progress tracking** - Updates from Supabase
- 🎨 **Color-coded stages** - Visual differentiation
- 📊 **Progress bars** - Shows completion within each stage
- 🏆 **Ranking** - Projects sorted by stage advancement
- 🔒 **Stage locking** - Visual indicators for locked/active/completed stages

### Performance Note
The widget loads stage statuses asynchronously on mount. It shows a loading state while fetching data from the database.

---
