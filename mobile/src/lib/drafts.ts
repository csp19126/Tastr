import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { Currency, SubRating, Tag } from '@shared';
import type { LocalPhoto } from './photos';

/**
 * A review in progress, kept on the phone. Saved as you type, so a dropped connection,
 * a dead battery or a closed app never loses a half-written review.
 */
export type DraftPhoto = LocalPhoto & { serverId?: number; serverUrl?: string };
export type DraftDish = { key: string; name: string; thumbsUp: boolean | null; note: string; photo?: DraftPhoto };
export type Draft = {
  id: string;
  reviewId?: number; // set when editing a posted review
  place: { id: number; name: string } | null;
  photos: DraftPhoto[];
  paws: number | null;
  ratings: Partial<Record<SubRating, number>>;
  body: string;
  pricePaid: string;
  currency: Currency;
  priceBracket: number | null;
  tags: Tag[];
  dishes: DraftDish[];
  sponsored: boolean | null; // null = not answered yet; posting is blocked until it is
  visitedOn: string | null;
  updatedAt: number;
};

const INDEX = 'tastr.drafts';

export function newDraft(place: Draft['place'], currency: Currency): Draft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    place,
    photos: [],
    paws: null,
    ratings: {},
    body: '',
    pricePaid: '',
    currency,
    priceBracket: null,
    tags: [],
    dishes: [],
    sponsored: null,
    visitedOn: null,
    updatedAt: Date.now(),
  };
}

function draftDir(id: string) {
  return new Directory(Paths.document, 'drafts', id);
}

/** Picked/compressed photos live in a cache the system may clear, so drafts keep their own copy. */
export async function keepPhoto(draftId: string, photo: LocalPhoto): Promise<LocalPhoto> {
  if (Platform.OS === 'web') return photo;
  try {
    const dir = draftDir(draftId);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const dest = new File(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`);
    await new File(photo.uri).copy(dest);
    return { ...photo, uri: dest.uri };
  } catch {
    return photo;
  }
}

export async function listDrafts(): Promise<Draft[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX);
    const all: Draft[] = raw ? JSON.parse(raw) : [];
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function getDraft(id: string) {
  return (await listDrafts()).find((d) => d.id === id) ?? null;
}

export async function saveDraft(draft: Draft) {
  const all = (await listDrafts()).filter((d) => d.id !== draft.id);
  await AsyncStorage.setItem(INDEX, JSON.stringify([{ ...draft, updatedAt: Date.now() }, ...all]));
}

export async function deleteDraft(id: string) {
  const all = (await listDrafts()).filter((d) => d.id !== id);
  await AsyncStorage.setItem(INDEX, JSON.stringify(all));
  if (Platform.OS !== 'web') {
    try {
      const dir = draftDir(id);
      if (dir.exists) dir.delete();
    } catch {
      // A leftover folder is harmless.
    }
  }
}
