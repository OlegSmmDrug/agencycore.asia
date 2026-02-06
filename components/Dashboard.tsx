import React from 'react';
import { Client, Project, Task, Transaction, User } from '../types';
import { getDashboardType } from '../utils/dashboardConfig';
import DirectorDashboard from './dashboard/DirectorDashboard';
import SalesManagerDashboard from './dashboard/SalesManagerDashboard';
import TargetologistDashboard from './dashboard/TargetologistDashboard';
import ProjectManagerDashboard from './dashboard/ProjectManagerDashboard';
import SmmDashboard from './dashboard/SmmDashboard';
import VideographerDashboard from './dashboard/VideographerDashboard';
import MobilographDashboard from './dashboard/MobilographDashboard';
import PhotographerDashboard from './dashboard/PhotographerDashboard';
import AccountantDashboard from './dashboard/AccountantDashboard';

interface DashboardProps {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  transactions?: Transaction[];
  users?: User[];
  currentUser: User;
  onTaskClick?: (task: Task) => void;
  onAddTransaction?: (transaction: Transaction) => void | Promise<void>;
  onUpdateTransaction?: (transaction: Transaction) => void | Promise<void>;
  onDeleteTransaction?: (id: string) => void | Promise<void>;
}

const Dashboard: React.FC<DashboardProps> = ({
  clients,
  projects,
  tasks,
  transactions = [],
  users = [],
  currentUser,
  onTaskClick,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction
}) => {
  const dashboardType = getDashboardType(currentUser);
  const nonContentTasks = tasks.filter(t => !['Post', 'Reels', 'Stories'].includes(t.type));

  switch (dashboardType) {
    case 'director':
      return (
        <DirectorDashboard
          clients={clients}
          projects={projects}
          tasks={nonContentTasks}
          transactions={transactions}
        />
      );

    case 'sales':
      return (
        <SalesManagerDashboard
          clients={clients}
          tasks={nonContentTasks}
          transactions={transactions}
          currentUserId={currentUser.id}
          currentUserSalary={currentUser.salary || 0}
        />
      );

    case 'targetologist':
      return (
        <TargetologistDashboard
          clients={clients}
          projects={projects}
          tasks={nonContentTasks}
          currentUserId={currentUser.id}
        />
      );

    case 'pm':
      return (
        <ProjectManagerDashboard
          clients={clients}
          projects={projects}
          tasks={tasks}
          currentUserId={currentUser.id}
        />
      );

    case 'smm':
      return (
        <SmmDashboard
          clients={clients}
          projects={projects}
          tasks={nonContentTasks}
          currentUserId={currentUser.id}
        />
      );

    case 'videographer':
      return (
        <VideographerDashboard
          clients={clients}
          projects={projects}
          tasks={nonContentTasks}
          currentUserId={currentUser.id}
        />
      );

    case 'mobilograph':
      return (
        <MobilographDashboard
          clients={clients}
          projects={projects}
          tasks={nonContentTasks}
          currentUserId={currentUser.id}
        />
      );

    case 'photographer':
      return (
        <PhotographerDashboard
          clients={clients}
          projects={projects}
          tasks={nonContentTasks}
          currentUserId={currentUser.id}
        />
      );

    case 'accountant':
      return (
        <AccountantDashboard
          clients={clients}
          projects={projects}
          tasks={nonContentTasks}
          transactions={transactions}
          users={users}
          currentUser={currentUser}
          onAddTransaction={onAddTransaction || (() => {})}
          onUpdateTransaction={onUpdateTransaction || (() => {})}
          onDeleteTransaction={onDeleteTransaction || (() => {})}
        />
      );

    case 'creative':
    case 'intern':
    default:
      return (
        <div className="space-y-6 p-4 md:p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Рабочее место: {currentUser.name}</h2>
              <p className="text-sm text-slate-500 mt-1">Мои задачи и проекты</p>
            </div>
          </div>

          <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Персонализированный дашборд в разработке</h3>
              <p className="text-slate-600 mb-6">
                Специальный дашборд для вашей должности ({currentUser.jobTitle}) скоро будет доступен.
                А пока вы можете работать с задачами через модуль "Задачи".
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-sm text-slate-700 font-medium mb-2">Что уже доступно:</p>
                <ul className="text-sm text-slate-600 space-y-1 text-left">
                  <li>• Модуль задач с фильтрацией</li>
                  <li>• Календарь и Kanban доска</li>
                  <li>• База знаний</li>
                  <li>• Заметки</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      );
  }
};

export default Dashboard;
