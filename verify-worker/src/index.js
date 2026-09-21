// MAZE APP имэйл кодоор баталгаажуулах сервер (Cloudflare Worker, үнэгүй). Код нь Brevo-оор имэйлээр ирнэ.
// Нууц (wrangler secret put ...): SERVICE_ACCOUNT (Firebase service account JSON), BREVO_API_KEY
// Нууц: BREVO_SENDER (Brevo дээр баталгаажуулсан илгээгчийн имэйл). wrangler.toml [vars]: PROJECT_ID, ALLOWED_ORIGIN
// Firestore-ийн `emailCodes/{uid}` баримтад кодын hash хадгална (зөвхөн сервер хандана, rules-д нээгээгүй).

const subtle = crypto.subtle;
const enc = new TextEncoder();
const TTL = 30 * 60e3, COOLDOWN = 30e3, MAX_TRIES = 5;
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const b64uStr = u8 => btoa(String.fromCharCode(...new Uint8Array(u8))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/* ---------- Firebase ID token шалгах (имэйл баталгаажаагүй байсан ч зөвшөөрнө) ---------- */
let jwks = null, jwksAt = 0;
async function getJwks() {
  if (jwks && Date.now() - jwksAt < 3600e3) return jwks;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  jwks = (await r.json()).keys; jwksAt = Date.now();
  return jwks;
}
async function verifyIdToken(tok, PROJECT_ID) {
  const [h, p, s] = String(tok).split('.');
  if (!h || !p || !s) throw new Error('bad token');
  const head = JSON.parse(new TextDecoder().decode(b64u(h)));
  const pay = JSON.parse(new TextDecoder().decode(b64u(p)));
  if (head.alg !== 'RS256') throw new Error('bad alg');
  const jwk = (await getJwks()).find(k => k.kid === head.kid);
  if (!jwk) throw new Error('bad kid');
  const key = await subtle.importKey('jwk', jwk, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']);
  const ok = await subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(s), enc.encode(h + '.' + p));
  const now = Date.now() / 1000;
  if (!ok || pay.aud !== PROJECT_ID || pay.iss !== 'https://securetoken.google.com/' + PROJECT_ID
    || pay.exp < now || !pay.sub || !pay.email) throw new Error('invalid token');
  return {uid: pay.sub, email: pay.email, verified: pay.email_verified === true};
}

/* ---------- service account access token ---------- */
let acc = null;
async function accessToken(env) {
  if (acc && acc.exp > Date.now() + 60e3) return acc.t;
  const sa = JSON.parse(env.SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const head = b64uStr(enc.encode(JSON.stringify({alg: 'RS256', typ: 'JWT'})));
  const body = b64uStr(enc.encode(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })));
  const der = b64u(sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''));
  const key = await subtle.importKey('pkcs8', der, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['sign']);
  const sig = b64uStr(await subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(head + '.' + body)));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + head + '.' + body + '.' + sig,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('service account token failed');
  acc = {t: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000};
  return acc.t;
}

/* ---------- кодын хадгалалт (Firestore REST) ---------- */
const docUrl = (PROJECT_ID, uid) => `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/emailCodes/${uid}`;
async function getCode(env, tok, uid) {
  const r = await fetch(docUrl(env.PROJECT_ID, uid), {headers: {Authorization: 'Bearer ' + tok}});
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('firestore ' + r.status);
  const f = (await r.json()).fields || {};
  return {h: f.h && f.h.stringValue, exp: Number(f.exp && f.exp.integerValue), sent: Number(f.sent && f.sent.integerValue), tries: Number(f.tries && f.tries.integerValue) || 0};
}
async function putCode(env, tok, uid, d) {
  const r = await fetch(docUrl(env.PROJECT_ID, uid), {
    method: 'PATCH', headers: {Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json'},
    body: JSON.stringify({fields: {h: {stringValue: d.h}, exp: {integerValue: String(d.exp)}, sent: {integerValue: String(d.sent)}, tries: {integerValue: String(d.tries)}}}),
  });
  if (!r.ok) throw new Error('firestore ' + r.status);
}
const delCode = (env, tok, uid) => fetch(docUrl(env.PROJECT_ID, uid), {method: 'DELETE', headers: {Authorization: 'Bearer ' + tok}}).catch(() => {});

async function hash(code, uid, PROJECT_ID) {
  return b64uStr(await subtle.digest('SHA-256', enc.encode(code + ':' + uid + ':' + PROJECT_ID)));
}
function newCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
  return String(n).padStart(4, '0');
}

async function sendMail(env, email, code) {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: {'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json'},
    body: JSON.stringify({
      sender: {name: 'MAZE APP', email: env.BREVO_SENDER},
      to: [{email}],
      subject: `MAZE APP баталгаажуулах код: ${code}`,
      htmlContent: `<div style="font-family:sans-serif;font-size:16px;line-height:1.5"><p>Таны баталгаажуулах код:</p><p style="font-size:32px;font-weight:700;letter-spacing:6px">${code}</p><p>Код 30 минутын дотор хүчинтэй. Хэрэв та бүртгүүлээгүй бол энэ имэйлийг үл тоомсорлоно уу.</p></div>`,
      textContent: `MAZE APP баталгаажуулах код: ${code} (30 минут хүчинтэй)`,
    }),
  });
  if (!r.ok) throw new Error('mail ' + r.status);
}

async function markVerified(env, tok, uid) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${env.PROJECT_ID}/accounts:update`, {
    method: 'POST', headers: {Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json'},
    body: JSON.stringify({localId: uid, emailVerified: true}),
  });
  if (!r.ok) throw new Error('identity ' + r.status);
}

async function handle(req, env) {
  let u;
  try { u = await verifyIdToken((req.headers.get('authorization') || '').replace(/^Bearer /, ''), env.PROJECT_ID); } catch (e) { throw new Error('bad token'); }
  const b = await req.json().catch(() => ({}));
  if (u.verified) return 200;
  const tok = await accessToken(env);
  const now = Date.now();

  if (b.kind === 'send') {
    const old = await getCode(env, tok, u.uid);
    if (old && now - old.sent < COOLDOWN) return 429;
    const code = newCode();
    await putCode(env, tok, u.uid, {h: await hash(code, u.uid, env.PROJECT_ID), exp: now + TTL, sent: now, tries: 0});
    await sendMail(env, u.email, code);
    return 200;
  }
  if (b.kind === 'check') {
    const code = String(b.code || '').trim();
    if (!/^\d{4}$/.test(code)) return 400;
    const d = await getCode(env, tok, u.uid);
    if (!d || d.exp < now) return 410;
    if (d.tries >= MAX_TRIES) return 429;
    if (d.h !== await hash(code, u.uid, env.PROJECT_ID)) {
      await putCode(env, tok, u.uid, {...d, tries: d.tries + 1});
      return 403;
    }
    await markVerified(env, tok, u.uid);
    await delCode(env, tok, u.uid);
    return 200;
  }
  return 400;
}

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
    if (req.method !== 'POST') return new Response('maze-verify ok', {headers: cors});
    let status = 500;
    try { status = await handle(req, env); } catch (e) { console.error('verify', e.message); status = /token|alg|kid/.test(e.message) ? 401 : /^mail/.test(e.message) ? 502 : 500; }
    return new Response(null, {status, headers: cors});
  },
};
