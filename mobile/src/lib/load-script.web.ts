const loading = new Map<string, Promise<void>>();

/** Adds a third-party script (Google, Facebook) to the page once, however many times it's asked for. */
export function loadScript(src: string): Promise<void> {
  let p = loading.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loading.delete(src);
        s.remove();
        reject(new Error(`could not load ${src}`));
      };
      document.head.appendChild(s);
    });
    loading.set(src, p);
  }
  return p;
}
