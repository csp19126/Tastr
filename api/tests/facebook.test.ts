import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { config } from '../src/config';
import { app, ready, signUp } from './helpers';

beforeAll(ready);

// Stand-ins for Facebook's servers, so the real checks in socialVerifier.facebook run.
const APP_ID = '1234567890';
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'fb-test', alg: 'RS256', use: 'sig' };
const tokens: Record<string, { app_id: string; user_id: string; is_valid: boolean; name: string }> = {
  'good-android-token': { app_id: APP_ID, user_id: '555', is_valid: true, name: 'Facebook Phở Fan' },
  'other-app-token': { app_id: '999', user_id: '666', is_valid: true, name: 'Wrong App' },
  'expired-token': { app_id: APP_ID, user_id: '777', is_valid: false, name: 'Old' },
};
const realFetch = globalThis.fetch;

beforeAll(() => {
  config.facebookAppId = APP_ID;
  config.facebookAppSecret = 'test-secret';
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url.host === 'www.facebook.com' && url.pathname === '/.well-known/oauth/openid/jwks/') return json({ keys: [jwk] });
    if (url.host !== 'graph.facebook.com') return realFetch(input as any);
    if (url.pathname === '/debug_token') {
      if (url.searchParams.get('access_token') !== `${APP_ID}|test-secret`) return json({ error: {} }, 400);
      const t = tokens[url.searchParams.get('input_token')!];
      return t ? json({ data: { app_id: t.app_id, user_id: t.user_id, is_valid: t.is_valid } }) : json({ data: { is_valid: false } });
    }
    if (url.pathname === '/me') {
      const t = tokens[url.searchParams.get('access_token')!];
      if (!t || !url.searchParams.get('appsecret_proof')) return json({ error: {} }, 400);
      return json({ id: t.user_id, name: t.name });
    }
    return json({ error: {} }, 404);
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
  config.facebookAppId = '';
  config.facebookAppSecret = '';
});

const limitedToken = (claims: Record<string, unknown>, audience = APP_ID) =>
  new SignJWT({ name: 'iPhone Diner', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'fb-test' })
    .setIssuer('https://www.facebook.com')
    .setAudience(audience)
    .setSubject('fb-ios-42')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);

describe('Facebook sign-in', () => {
  it('signs up on Android/web with a token Facebook confirms, and signs the same person back in', async () => {
    const first = await request(app).post('/api/auth/facebook').send({ accessToken: 'good-android-token' });
    expect(first.status).toBe(200);
    expect(first.body.user).toMatchObject({ displayName: 'Facebook Phở Fan', email: null, signInMethods: ['facebook'] });
    const again = await request(app).post('/api/auth/facebook').send({ accessToken: 'good-android-token' });
    expect(again.body.user.id).toBe(first.body.user.id);
  });

  it("refuses tokens Facebook says are dead, or that were made for someone else's app", async () => {
    for (const accessToken of ['expired-token', 'other-app-token', 'made-up-token']) {
      expect((await request(app).post('/api/auth/facebook').send({ accessToken })).status).toBe(401);
    }
  });

  it('signs in on iPhone with a Limited Login token, checking signature, app and nonce', async () => {
    const nonce = 'nonce-abcdefgh';
    const ok = await request(app).post('/api/auth/facebook').send({ authenticationToken: await limitedToken({ nonce }), nonce });
    expect(ok.status).toBe(200);
    expect(ok.body.user).toMatchObject({ displayName: 'iPhone Diner', signInMethods: ['facebook'] });

    const wrongNonce = await request(app).post('/api/auth/facebook').send({ authenticationToken: await limitedToken({ nonce }), nonce: 'nonce-zzzzzzzz' });
    expect(wrongNonce.status).toBe(401);
    const wrongApp = await request(app).post('/api/auth/facebook').send({ authenticationToken: await limitedToken({ nonce }, '999'), nonce });
    expect(wrongApp.status).toBe(401);
    const { privateKey: forger } = await generateKeyPair('RS256');
    const forged = await new SignJWT({ nonce }).setProtectedHeader({ alg: 'RS256', kid: 'fb-test' }).setIssuer('https://www.facebook.com')
      .setAudience(APP_ID).setSubject('fb-ios-42').setExpirationTime('5m').sign(forger);
    expect((await request(app).post('/api/auth/facebook').send({ authenticationToken: forged, nonce })).status).toBe(401);
  });

  it("never uses Facebook to get into someone else's email account", async () => {
    const { user } = await signUp({ email: 'fb-victim@example.com' });
    tokens['claims-victim-email'] = { app_id: APP_ID, user_id: '888', is_valid: true, name: 'Not The Victim' };
    const res = await request(app).post('/api/auth/facebook').send({ accessToken: 'claims-victim-email' });
    expect(res.status).toBe(200);
    expect(res.body.user.id).not.toBe(user.id);
    expect(res.body.user.email).toBeNull();
  });

  it('tells the web version which buttons and maps are switched on', async () => {
    const on = await request(app).get('/api/config');
    expect(on.body).toEqual({ googleWebClientId: null, facebookAppId: APP_ID, googleMapsKey: null, googleMapsMapId: null });
    config.facebookAppSecret = '';
    expect((await request(app).get('/api/config')).body.facebookAppId).toBeNull();
    expect((await request(app).post('/api/auth/facebook').send({ accessToken: 'good-android-token' })).status).toBe(501);
    config.facebookAppSecret = 'test-secret';
  });
});
