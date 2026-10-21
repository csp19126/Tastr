/** The phone apps use the native Google button (see sign-in); this one is web only. */
export function GoogleWebButton(_: { onIdToken: (idToken: string) => void }) {
  return null;
}
