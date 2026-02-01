const SYNC_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-livedune-content`;

interface SyncRequest {
  date_from?: string;
  date_to?: string;
  project_id?: string;
  organization_id?: string;
}

interface SyncResult {
  success: boolean;
  date_from?: string;
  date_to?: string;
  projects_processed?: number;
  total_items_synced?: number;
  results?: Array<{
    project_id: string;
    project_name: string;
    success: boolean;
    cached_items?: number;
    posts?: number;
    stories?: number;
    reels?: number;
    synced_publications?: number;
    error?: string;
    message?: string;
  }>;
  error?: string;
}

const getHeaders = () => ({
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
});

export const syncLiveduneContent = async (params?: SyncRequest): Promise<SyncResult> => {
  try {
    console.log('[LiveDune Sync] Calling sync function with params:', params);

    const response = await fetch(SYNC_FUNCTION_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params || {})
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LiveDune Sync] Error response:', errorText);
      throw new Error(`Sync failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('[LiveDune Sync] Sync result:', result);

    return result;
  } catch (error) {
    console.error('[LiveDune Sync] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const syncProjectForMonth = async (
  projectId: string,
  year: number,
  month: number
): Promise<SyncResult> => {
  // Format dates as YYYY-MM-DD strings directly to avoid timezone issues
  const monthStr = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  const dateFrom = `${year}-${monthStr}-01`;
  const dateTo = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  return syncLiveduneContent({
    project_id: projectId,
    date_from: dateFrom,
    date_to: dateTo
  });
};

export const syncAllProjectsYesterday = async (): Promise<SyncResult> => {
  return syncLiveduneContent();
};

export const syncOrganizationForMonth = async (
  organizationId: string,
  year: number,
  month: number
): Promise<SyncResult> => {
  // Format dates as YYYY-MM-DD strings directly to avoid timezone issues
  const monthStr = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  const dateFrom = `${year}-${monthStr}-01`;
  const dateTo = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  return syncLiveduneContent({
    organization_id: organizationId,
    date_from: dateFrom,
    date_to: dateTo
  });
};
