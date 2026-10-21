/** Web only (see load-script.web.ts): the phone apps never load scripts from other sites. */
export function loadScript(_src: string): Promise<void> {
  return Promise.reject(new Error('web only'));
}
