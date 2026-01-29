export function getCurrentOrganizationId(): string | null {
  const storedUser = localStorage.getItem('currentUser');
  if (!storedUser) return null;
  const user = JSON.parse(storedUser);
  return user.organizationId || null;
}

export function requireOrganizationId(): string {
  const orgId = getCurrentOrganizationId();
  if (!orgId) {
    throw new Error('Organization ID is required. Please log in.');
  }
  return orgId;
}

export function getCurrentUserId(): string | null {
  const storedUser = localStorage.getItem('currentUser');
  if (!storedUser) return null;
  const user = JSON.parse(storedUser);
  return user.id || null;
}

export function requireUserId(): string {
  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error('User ID is required. Please log in.');
  }
  return userId;
}
