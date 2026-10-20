import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { get } from './api';
import type { ContentEntry } from './types';

export type ContentKey = 'about_intro' | 'who_runs_this_app' | 'partnerships' | 'terms' | 'privacy';

/** About / Terms / Privacy text, edited from the admin screen and fetched live (no app update needed). */
export function useContent() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'vi' ? 'vi' : 'en';
  return useQuery({
    queryKey: ['content', lang],
    queryFn: () => get<{ content: Partial<Record<ContentKey, ContentEntry>> }>('/content', { lang }),
    staleTime: 5 * 60_000,
  });
}
