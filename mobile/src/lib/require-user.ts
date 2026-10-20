import { router } from 'expo-router';
import { useCallback } from 'react';

import { useAuth } from './auth';

/** Wraps an action that needs an account: signed out, it opens Sign in instead. */
export function useRequireUser() {
  const { user } = useAuth();
  return useCallback(
    (action: () => void) => {
      if (user) action();
      else router.push('/sign-in');
    },
    [user],
  );
}
