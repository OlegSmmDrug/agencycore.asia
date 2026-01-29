import { User, Client } from '../types';

export const canManageLeads = (user: User): boolean => {
  const jobTitleLower = user.jobTitle.toLowerCase();
  return jobTitleLower === 'ceo' || jobTitleLower.includes('sales manager');
};

export const isCEO = (user: User): boolean => {
  return user.jobTitle === 'CEO';
};

export const canAssignLead = (user: User, client: Client | Partial<Client>): boolean => {
  if (!canManageLeads(user)) {
    return false;
  }

  if (isCEO(user)) {
    return true;
  }

  if (!client.managerId) {
    return true;
  }

  return client.managerId === user.id;
};

export const shouldAutoAssignManager = (
  client: Partial<Client>,
  currentUser: User
): boolean => {
  if (client.managerId) {
    return false;
  }

  return canManageLeads(currentUser);
};

export const getAvailableManagers = (users: User[]): User[] => {
  return users.filter(user => canManageLeads(user));
};
