import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { LIMITS } from '../../shared';
import { config } from './config';
import { HttpError } from './http';

/**
 * Every photo is decoded and re-encoded here, whatever the phone already did.
 * sharp drops all metadata unless asked to keep it, so GPS position, camera serials and
 * timestamps never reach storage. `.rotate()` first bakes the EXIF orientation into the pixels
 * so photos still show the right way up once that data is gone.
 */
export async function processPhoto(input: Buffer) {
  try {
    const { data, info } = await sharp(input, { failOn: 'error', limitInputPixels: 80_000_000 })
      .rotate()
      .resize({ width: LIMITS.photoMaxEdge, height: LIMITS.photoMaxEdge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw new HttpError(400, 'not_a_photo');
  }
}

const KEY = /^[a-f0-9]{32}\.jpg$/;

export async function storePhoto(data: Buffer) {
  const key = `${crypto.randomBytes(16).toString('hex')}.jpg`;
  await fs.mkdir(config.uploadDir, { recursive: true });
  await fs.writeFile(path.join(config.uploadDir, key), data);
  return key;
}

export async function deletePhotoFiles(keys: (string | null | undefined)[]) {
  await Promise.all(
    keys.filter((k): k is string => !!k && KEY.test(k)).map((k) => fs.rm(path.join(config.uploadDir, k), { force: true })),
  );
}

export function mediaPath(key: string) {
  if (!KEY.test(key)) return null;
  return path.join(config.uploadDir, key);
}

/** Absolute when PUBLIC_URL is set; otherwise the app prefixes its API address. */
export function mediaUrl(key: string | null | undefined) {
  return key ? `${config.publicUrl}/media/${key}` : null;
}
