import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../types';
import { roadmapService, ProjectMember } from '../services/roadmapService';

interface ProjectTeamSelectorProps {
  projectId: string;
  users: User[];
  onTeamUpdated?: () => void;
}

const ProjectTeamSelector: React.FC<ProjectTeamSelectorProps> = ({
  projectId,
  users,
  onTeamUpdated
}) => {
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingUser, setTogglingUser] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProjectMembers();
  }, [projectId]);

  const loadProjectMembers = async () => {
    try {
      const members = await roadmapService.getProjectMembers(projectId);
      setSelectedMembers(members.map(m => m.user_id));
    } catch (error) {
      console.error('Error loading project members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMember = async (userId: string) => {
    if (togglingUser) return;

    setTogglingUser(userId);
    const wasSelected = selectedMembers.includes(userId);

    setSelectedMembers(prev =>
      wasSelected ? prev.filter(id => id !== userId) : [...prev, userId]
    );

    try {
      if (wasSelected) {
        await roadmapService.removeProjectMember(projectId, userId);
      } else {
        await roadmapService.addProjectMember(projectId, userId, 'member');
      }
      onTeamUpdated?.();
    } catch (error) {
      console.error('Error updating team member:', error);
      setSelectedMembers(prev =>
        wasSelected ? [...prev, userId] : prev.filter(id => id !== userId)
      );
    } finally {
      setTogglingUser(null);
    }
  };

  const groupedUsers = useMemo(() => {
    const filtered = users.filter(user =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.jobTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const groups: Record<string, User[]> = {};
    filtered.forEach(user => {
      const title = user.jobTitle || 'Другие';
      if (!groups[title]) groups[title] = [];
      groups[title].push(user);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [users, searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mb-3"></div>
        <p className="text-slate-500 text-sm">Загрузка команды...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Команда проекта</h3>
          <p className="text-sm text-slate-500">
            Выбрано: <span className="font-semibold text-blue-600">{selectedMembers.length}</span> участников
          </p>
        </div>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск по имени или должности..."
            className="w-full sm:w-64 pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {selectedMembers.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-xl border border-blue-200">
          <span className="text-xs font-semibold text-blue-700 w-full mb-1">В команде:</span>
          {selectedMembers.map(userId => {
            const user = users.find(u => u.id === userId);
            if (!user) return null;
            return (
              <div
                key={userId}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-white rounded-lg border border-blue-200 group cursor-pointer hover:border-red-300 transition-colors"
                onClick={() => handleToggleMember(userId)}
              >
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  {user.name.charAt(0)}
                </div>
                <span className="text-sm font-medium text-slate-700">{user.name}</span>
                <svg className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-4">
        {groupedUsers.map(([jobTitle, groupUsers]) => (
          <div key={jobTitle}>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
              {jobTitle}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {groupUsers.map(user => {
                const isSelected = selectedMembers.includes(user.id);
                const isToggling = togglingUser === user.id;

                return (
                  <div
                    key={user.id}
                    onClick={() => handleToggleMember(user.id)}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${
                      isToggling
                        ? 'border-blue-300 bg-blue-50 opacity-60'
                        : isSelected
                        ? 'border-blue-500 bg-blue-50 hover:bg-blue-100'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold transition-colors ${
                            isSelected ? 'bg-blue-600' : 'bg-slate-400'
                          }`}
                        >
                          {user.name.charAt(0)}
                        </div>
                        {isToggling && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{user.name}</div>
                        <div className="text-xs text-slate-500 truncate">{user.email}</div>
                      </div>
                      {isSelected && !isToggling && (
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {groupedUsers.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-sm font-medium">Сотрудники не найдены</p>
          <p className="text-xs mt-1">Попробуйте изменить поисковый запрос</p>
        </div>
      )}

      {selectedMembers.length === 0 && groupedUsers.length > 0 && (
        <div className="text-center py-4 px-6 bg-amber-50 rounded-xl border border-amber-200">
          <p className="text-sm text-amber-700 font-medium">Команда не сформирована</p>
          <p className="text-xs text-amber-600 mt-1">Выберите участников для работы над проектом</p>
        </div>
      )}
    </div>
  );
};

export default ProjectTeamSelector;
