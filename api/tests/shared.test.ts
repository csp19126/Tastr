import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { foldForSearch, isOpenAt, isValidHours } from '../../shared';
import { processPhoto } from '../src/media';
import { jpeg } from './helpers';

describe('Vietnamese search folding', () => {
  it('finds accented words from plain typing', () => {
    expect(foldForSearch('Bánh Mì')).toBe('banh mi');
    expect(foldForSearch('bún chả')).toBe('bun cha');
    expect(foldForSearch('Phở Đà Nẵng')).toBe('pho da nang');
    expect(foldForSearch('Mì Quảng Ếch')).toBe('mi quang ech');
    expect(foldForSearch('Cơm gà Hội An')).toBe('com ga hoi an');
    expect(foldForSearch('  Bò   lá lốt!! ')).toBe('bo la lot');
  });
  it('leaves plain text alone', () => {
    expect(foldForSearch('Pizza 4P')).toBe('pizza 4p');
  });
});

describe('opening hours', () => {
  const tz = 'Asia/Ho_Chi_Minh'; // UTC+7, no daylight saving
  // 2026-10-19 is a Monday.
  const at = (isoLocal: string) => new Date(`${isoLocal}+07:00`);

  it('knows when nobody knows', () => {
    expect(isOpenAt(null, new Date(), tz)).toBeNull();
    expect(isOpenAt({}, new Date(), tz)).toBeNull();
  });
  it('handles a normal day', () => {
    const h = { mon: [['06:00', '10:30'] as [string, string]] };
    expect(isOpenAt(h, at('2026-10-19T06:00:00'), tz)).toBe(true);
    expect(isOpenAt(h, at('2026-10-19T10:29:00'), tz)).toBe(true);
    expect(isOpenAt(h, at('2026-10-19T10:30:00'), tz)).toBe(false);
    expect(isOpenAt(h, at('2026-10-20T07:00:00'), tz)).toBe(false); // Tuesday: not listed
  });
  it('handles bars that run past midnight', () => {
    const h = { fri: [['17:00', '02:00'] as [string, string]] };
    expect(isOpenAt(h, at('2026-10-23T23:30:00'), tz)).toBe(true); // Friday night
    expect(isOpenAt(h, at('2026-10-24T01:59:00'), tz)).toBe(true); // Saturday small hours
    expect(isOpenAt(h, at('2026-10-24T02:00:00'), tz)).toBe(false);
    expect(isOpenAt(h, at('2026-10-24T18:00:00'), tz)).toBe(false); // Saturday evening: not listed
  });
  it('validates input', () => {
    expect(isValidHours({ mon: [['07:00', '14:00']] })).toBe(true);
    expect(isValidHours({ funday: [['07:00', '14:00']] })).toBe(false);
    expect(isValidHours({ mon: [['7am', '2pm']] })).toBe(false);
    expect(isValidHours({ mon: [['24:00', '02:00']] })).toBe(false);
  });
});

describe('photo privacy', () => {
  it('strips EXIF and camera data but keeps the photo the right way up', async () => {
    const input = await jpeg(400, 200, true);
    const before = await sharp(input).metadata();
    expect(before.exif).toBeDefined();
    expect(before.orientation).toBe(6);

    const out = await processPhoto(input);
    const after = await sharp(out.data).metadata();
    expect(after.exif).toBeUndefined();
    expect(after.xmp).toBeUndefined();
    expect(after.iptc).toBeUndefined();
    expect(after.orientation).toBeUndefined();
    expect(out.data.includes(Buffer.from('SpyCam'))).toBe(false);
    // Orientation 6 means "rotate 90°": the pixels are turned for real.
    expect([out.width, out.height]).toEqual([200, 400]);
  });

  it('shrinks huge photos', async () => {
    const out = await processPhoto(await jpeg(5000, 2500));
    expect(Math.max(out.width, out.height)).toBe(2048);
  });

  it('rejects things that are not photos', async () => {
    await expect(processPhoto(Buffer.from('definitely not a jpeg'))).rejects.toThrow('not_a_photo');
  });
});

describe('sign-in flood limiter', () => {
  it('lets a few attempts through, then says slow down', async () => {
    const { ipLimiter } = await import('../src/http');
    const limit = ipLimiter(3, 60_000);
    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      limit({ ip: '1.2.3.4' } as any, {} as any, (err?: any) => results.push(err ? err.code : 'ok'));
    }
    limit({ ip: '5.6.7.8' } as any, {} as any, (err?: any) => results.push(err ? err.code : 'ok'));
    expect(results).toEqual(['ok', 'ok', 'ok', 'slow_down', 'slow_down', 'ok']);
  });
});
