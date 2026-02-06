const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SESSION_TOKEN_KEY = 'ac_session_token';
const HEARTBEAT_INTERVAL = 5 * 60 * 1000;

function getSessionToken(): string {
  let token = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  }
  return token;
}

function getDeviceFingerprint(): string {
  const { userAgent, language, platform } = navigator;
  const screen = `${window.screen.width}x${window.screen.height}`;
  return btoa(`${platform}|${language}|${screen}|${userAgent.slice(0, 50)}`).slice(0, 64);
}

export interface SessionCheckResult {
  concurrent_ips: number;
  ip_list: string[];
  warning: boolean;
  current_ip: string;
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let onWarningCallback: ((result: SessionCheckResult) => void) | null = null;

async function ping(userId: string): Promise<SessionCheckResult | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/session-monitor`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        session_token: getSessionToken(),
        user_agent: navigator.userAgent,
        device_fingerprint: getDeviceFingerprint(),
      }),
    });

    if (!res.ok) return null;

    const data: SessionCheckResult = await res.json();

    if (data.warning && onWarningCallback) {
      onWarningCallback(data);
    }

    return data;
  } catch {
    return null;
  }
}

export const sessionMonitorService = {
  start(userId: string, onWarning: (result: SessionCheckResult) => void) {
    onWarningCallback = onWarning;
    ping(userId);

    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => ping(userId), HEARTBEAT_INTERVAL);
  },

  stop() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    onWarningCallback = null;
  },
};
