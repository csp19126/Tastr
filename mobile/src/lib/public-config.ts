import { useQuery } from '@tanstack/react-query';

import { get } from './api';

/** What the server has switched on. Used by the web version, which can't have keys built in. */
export type PublicConfig = {
  googleWebClientId: string | null;
  facebookAppId: string | null;
  googleMapsKey: string | null;
  googleMapsMapId: string | null;
};

/** `config` is undefined while loading; if the server can't be asked, everything counts as off. */
export function usePublicConfig() {
  const q = useQuery({ queryKey: ['public-config'], queryFn: () => get<PublicConfig>('/config'), staleTime: Infinity });
  return { config: q.data, loading: q.isPending };
}
