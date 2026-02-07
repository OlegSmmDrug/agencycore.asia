import { Client } from '../../../types';

const UTM_CHANNEL_MAP: Record<string, string> = {
  'google': 'Google Ads',
  'google_ads': 'Google Ads',
  'adwords': 'Google Ads',
  'facebook': 'Facebook Ads',
  'fb': 'Facebook Ads',
  'instagram': 'Instagram Ads',
  'ig': 'Instagram Ads',
  'tiktok': 'TikTok Ads',
  'tiktok_ads': 'TikTok Ads',
  'yandex': 'Яндекс.Директ',
  'yandex_direct': 'Яндекс.Директ',
  'yadirect': 'Яндекс.Директ',
  'vk': 'VK Ads',
  'vkontakte': 'VK Ads',
  'telegram': 'Telegram',
  'email': 'Email',
  'whatsapp': 'WhatsApp',
};

export const CHANNEL_COLORS: Record<string, string> = {
  'Google Ads': '#4285f4',
  'Facebook Ads': '#1877f2',
  'Instagram Ads': '#e4405f',
  'TikTok Ads': '#010101',
  'Яндекс.Директ': '#fc3f1d',
  'VK Ads': '#0077ff',
  'Telegram': '#2aabee',
  'Email': '#64748b',
  'WhatsApp': '#25d366',
  'SEO': '#10b981',
  'Реферал': '#10b981',
  'Холодные звонки': '#f59e0b',
  'Соцсети': '#ec4899',
  'Сайт (органика)': '#06b6d4',
  'Ручной ввод': '#94a3b8',
  'Импорт из банка': '#78716c',
  'Повторная продажа': '#a855f7',
};

export const SOURCE_LABELS: Record<string, string> = {
  'Website': 'Прямой трафик',
  'Referral': 'Реферал',
  'Cold Call': 'Холодные звонки',
  'Socials': 'Соцсети',
  'Creatium': 'Сайт (органика)',
  'Manual': 'Ручной ввод',
  'WhatsApp': 'WhatsApp',
  'Bank Import': 'Импорт из банка',
  'Repeat': 'Повторная продажа',
  'Other': 'Другое',
};

export function getEffectiveChannel(client: Client): string {
  if (client.utmSource && client.utmSource !== '-') {
    const normalized = client.utmSource.toLowerCase().trim();
    return UTM_CHANNEL_MAP[normalized] || client.utmSource;
  }

  return SOURCE_LABELS[client.source] || client.source || 'Другое';
}

export const CHANNEL_NAME_TO_UTM: Record<string, string[]> = {
  'Google Ads': ['google', 'google_ads', 'adwords'],
  'Facebook Ads': ['facebook', 'fb'],
  'Instagram Ads': ['instagram', 'ig'],
  'TikTok Ads': ['tiktok', 'tiktok_ads'],
  'Яндекс.Директ': ['yandex', 'yandex_direct', 'yadirect'],
  'VK Ads': ['vk', 'vkontakte'],
  'SEO': ['organic', 'seo'],
  'Creatium': ['creatium'],
  'Email': ['email', 'newsletter'],
  'Referral Program': ['referral'],
};

export function countUtmLeadsForChannel(channelName: string, clients: Client[]): number {
  const lower = channelName.toLowerCase();
  const utmValues = Object.entries(CHANNEL_NAME_TO_UTM).find(([key]) =>
    lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)
  )?.[1] || [];

  if (utmValues.length === 0) return 0;

  return clients.filter(c => {
    if (!c.utmSource || c.utmSource === '-') return false;
    const src = c.utmSource.toLowerCase().trim();
    return utmValues.includes(src);
  }).length;
}
