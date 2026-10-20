import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { config } from '../src/config';
import { pool } from '../src/db';
import { mailer, type Email } from '../src/mailer';
import { app, ready, signUp } from './helpers';

beforeAll(ready);

const sent: Email[] = [];
const realSend = mailer.send;
mailer.send = async (e) => {
  sent.push(e);
};
afterEach(() => {
  sent.length = 0;
});

const codeIn = (e: Email) => /(\d{6})/.exec(e.subject)![1];
const forgot = (email: string) => request(app).post('/api/auth/forgot').send({ email });
const reset = (email: string, code: string, password = 'brand-new-pass') =>
  request(app).post('/api/auth/reset').send({ email, code, password });

describe('forgot password', () => {
  it('emails a code, and the code sets a new password and signs out other phones', async () => {
    const { user, auth } = await signUp({ email: 'forgetful@example.com' });
    const res = await forgot('Forgetful@Example.com ');
    expect(res.body).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('forgetful@example.com');
    const code = codeIn(sent[0]);
    expect(sent[0].text).toContain(code);
    expect(sent[0].html).toContain(code);

    const done = await reset('forgetful@example.com', code);
    expect(done.status).toBe(200);
    expect(done.body.user.id).toBe(user.id);
    expect(done.body.token).toBeTruthy();

    // The old session is gone; the new password works; the old one doesn't.
    expect((await request(app).get('/api/me').set(auth)).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'forgetful@example.com', password: 'brand-new-pass' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: 'forgetful@example.com', password: 'correct horse' })).status).toBe(401);

    // A code works once.
    expect((await reset('forgetful@example.com', code, 'another-pass-1')).status).toBe(400);
  });

  it('writes to Vietnamese speakers in Vietnamese', async () => {
    await signUp({ email: 'viet@example.com', language: 'vi' });
    await forgot('viet@example.com');
    expect(sent[0].subject).toContain('Mã đặt lại mật khẩu');
  });

  it('never reveals whether an email has an account', async () => {
    const res = await forgot('nobody-here@example.com');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(sent).toHaveLength(0);
    expect((await reset('nobody-here@example.com', '123456')).body.error).toBe('bad_code');
  });

  it('locks a code after 5 wrong guesses', async () => {
    await signUp({ email: 'guesser@example.com' });
    await forgot('guesser@example.com');
    const code = codeIn(sent[0]);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect((await reset('guesser@example.com', wrong)).body.error).toBe('bad_code');
    // Even the right code is refused now; they need a fresh one.
    expect((await reset('guesser@example.com', code)).status).toBe(400);
  });

  it('only the newest code works, and codes expire', async () => {
    await signUp({ email: 'twice@example.com' });
    await forgot('twice@example.com');
    await forgot('twice@example.com');
    const [first, second] = sent.map(codeIn);
    if (first !== second) expect((await reset('twice@example.com', first)).status).toBe(400);

    await pool.query(`UPDATE password_resets SET expires_at = now() - interval '1 minute'
      WHERE user_id = (SELECT id FROM users WHERE email = 'twice@example.com')`);
    expect((await reset('twice@example.com', second)).status).toBe(400);
  });

  it('sends at most 3 codes an hour to one account', async () => {
    await signUp({ email: 'spammy@example.com' });
    for (let i = 0; i < 5; i++) expect((await forgot('spammy@example.com')).body).toEqual({ ok: true });
    expect(sent).toHaveLength(3);
  });

  it('refuses short passwords and malformed codes', async () => {
    await signUp({ email: 'short@example.com' });
    await forgot('short@example.com');
    expect((await reset('short@example.com', codeIn(sent[0]), 'short')).status).toBe(400);
    expect((await reset('short@example.com', 'abc')).status).toBe(400);
  });

  it('says plainly when email sending is not set up on the live server', async () => {
    const before = { key: config.resendApiKey, prod: config.isProduction };
    mailer.send = realSend;
    config.resendApiKey = '';
    config.isProduction = true;
    try {
      const res = await forgot('anyone@example.com');
      expect(res.status).toBe(503);
      expect(res.body.error).toBe('email_not_configured');
    } finally {
      config.resendApiKey = before.key;
      config.isProduction = before.prod;
      mailer.send = async (e) => {
        sent.push(e);
      };
    }
  });
});
