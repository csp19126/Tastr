import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Longest edge we send. Plenty for a phone screen, and small enough for 4G in a busy market. */
const MAX_EDGE = 1600;

export type LocalPhoto = { uri: string; width: number; height: number };

/**
 * Shrinks and re-encodes a photo on the phone before upload. Re-encoding writes a fresh JPEG
 * without the original's EXIF (GPS, camera). The server strips metadata again regardless.
 */
export async function compress(asset: { uri: string; width: number; height: number }): Promise<LocalPhoto> {
  const ctx = ImageManipulator.manipulate(asset.uri);
  const longest = Math.max(asset.width, asset.height);
  if (longest > MAX_EDGE) {
    ctx.resize(asset.width >= asset.height ? { width: MAX_EDGE, height: null } : { width: null, height: MAX_EDGE });
  }
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.72 });
  return { uri: out.uri, width: out.width, height: out.height };
}

export type PickResult = { photos: LocalPhoto[] } | { denied: 'camera' | 'photos' };

export async function takePhoto(): Promise<PickResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { denied: 'camera' };
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1, exif: false });
  if (res.canceled) return { photos: [] };
  return { photos: await Promise.all(res.assets.map(compress)) };
}

export async function pickPhotos(limit: number): Promise<PickResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { denied: 'photos' };
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
    exif: false,
  });
  if (res.canceled) return { photos: [] };
  return { photos: await Promise.all(res.assets.slice(0, limit).map(compress)) };
}
