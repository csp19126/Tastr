import i18n from './i18n';
import type { List } from './types';

/** Built-in lists are named in the reader's language; custom ones keep the owner's name. */
export function listName(l: Pick<List, 'kind' | 'name'>) {
  return l.kind === 'custom' ? l.name : i18n.t(`lists.${l.kind}`);
}
