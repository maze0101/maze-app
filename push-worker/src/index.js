// MAZE APP push сервер (Cloudflare Worker, үнэгүй). Firebase Cloud Functions (Blaze) хэрэггүй.
// Апп зурвас/дуудлага/найзын хүсэлт илгээсний дараа энд POST хийнэ; энд FCM push илгээнэ.
// Нууц: SERVICE_ACCOUNT = Firebase service account JSON (wrangler secret put SERVICE_ACCOUNT)

const enc = new TextEncoder();
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const b64uStr = u8 => btoa(String.fromCharCode(...new Uint8Array(u8))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const short = (s, n) => String(s || '').slice(0, n);

/* ---------- Firebase ID token шалгах ---------- */
let jwks = null, jwksAt = 0;
async function getJwks() {
  if (jwks && Date.now() - jwksAt < 3600e3) return jwks;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  jwks = (await r.json()).keys; jwksAt = Date.now();
  return jwks;
}
async function verifyIdToken(tok, projectId) {
  const [h, p, s] = String(tok).split('.');
  if (!h || !p || !s) throw new Error('bad token');
  const head = JSON.parse(new TextDecoder().decode(b64u(h)));
  const pay = JSON.parse(new TextDecoder().decode(b64u(p)));
  if (head.alg !== 'RS256') throw new Error('alg');
  const jwk = (await getJwks()).find(k => k.kid === head.kid);
  if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', jwk, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(s), enc.encode(h + '.' + p));
  const now = Date.now() / 1000;
  if (!ok || pay.aud !== projectId || pay.iss !== 'https://securetoken.google.com/' + projectId
    || pay.exp < now || !pay.sub || pay.email_verified !== true) throw new Error('invalid token');
  return pay.sub;
}

/* ---------- Google API-д зориулсан service account access token ---------- */
let acc = null;
async function accessToken(sa) {
  if (acc && acc.exp > Date.now() + 60e3) return acc.t;
  const now = Math.floor(Date.now() / 1000);
  const head = b64uStr(enc.encode(JSON.stringify({alg: 'RS256', typ: 'JWT'})));
  const body = b64uStr(enc.encode(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })));
  const der = b64u(sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''));
  const key = await crypto.subtle.importKey('pkcs8', der, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['sign']);
  const sig = b64uStr(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(head + '.' + body)));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + head + '.' + body + '.' + sig,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('service account token failed');
  acc = {t: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000};
  return acc.t;
}

/* ---------- Firestore REST ---------- */
const val = v => v == null ? undefined : v.stringValue ?? v.booleanValue ?? v.integerValue ?? v.timestampValue
  ?? (v.arrayValue ? (v.arrayValue.values || []).map(val) : undefined);
const docUrl = (env, path) => `https://firestore.googleapis.com/v1/projects/${env.PROJECT_ID}/databases/(default)/documents/${path}`;
async function fsGet(env, tok, path) {
  const r = await fetch(docUrl(env, path), {headers: {Authorization: 'Bearer ' + tok}});
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('firestore ' + r.status);
  const d = await r.json(), o = {};
  for (const k in d.fields || {}) o[k] = val(d.fields[k]);
  return o;
}
async function fsList(env, tok, path) {
  const r = await fetch(docUrl(env, path) + '?pageSize=20', {headers: {Authorization: 'Bearer ' + tok}});
  if (!r.ok) return [];
  return ((await r.json()).documents || []).map(d => d.name);
}

/* ---------- push илгээх ---------- */
const DEAD = ['UNREGISTERED', 'INVALID_ARGUMENT', 'NOT_FOUND'];
async function push(env, tok, uids, data, ttl) {
  await Promise.all(uids.map(async uid => {
    const names = await fsList(env, tok, `users/${uid}/fcm`);
    await Promise.all(names.map(async name => {
      const token = name.split('/').pop();
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${env.PROJECT_ID}/messages:send`, {
        method: 'POST', headers: {Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json'},
        body: JSON.stringify({message: {token, data, webpush: {headers: {Urgency: 'high', TTL: String(ttl)}}}}),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        console.log('FCM send failed', JSON.stringify(j.error || j));
        if (DEAD.includes((j.error && j.error.status) || '')) {
          await fetch(`https://firestore.googleapis.com/v1/${name}`, {method: 'DELETE', headers: {Authorization: 'Bearer ' + tok}}).catch(() => {});
        }
      }
    }));
  }));
}

async function handle(req, env) {
  const auth = req.headers.get('Authorization') || '';
  const uid = await verifyIdToken(auth.replace(/^Bearer /, ''), env.PROJECT_ID);
  const b = await req.json();
  const tok = await accessToken(JSON.parse(env.SERVICE_ACCOUNT));
  const me = await fsGet(env, tok, 'users/' + uid);
  const myName = short(me && me.name, 40);

  if (b.kind === 'msg') {
    const cid = String(b.cid || '');
    if (!/^[\w-]{1,200}$/.test(cid)) return 400;
    const c = await fsGet(env, tok, 'chats/' + cid);
    if (!c || !(c.members || []).includes(uid)) return 403;
    const to = [];
    for (const u of (c.members || []).filter(x => x !== uid)) {
      if (!(await fsGet(env, tok, `blocks/${u}_${uid}`))) to.push(u); // хүлээн авагч илгээгчийг блоклоогүй
    }
    const title = c.group ? short(c.name, 40) : myName;
    const body = (c.group ? short(myName, 30) + ': ' : '') + short(b.preview, 120);
    await push(env, tok, to, {type: 'msg', title: '✉ ' + title, body, tag: 'chat-' + cid, url: './index.html'}, 3600);
    return 200;
  }
  if (b.kind === 'call') {
    const id = String(b.id || '');
    const c = await fsGet(env, tok, 'calls/' + encodeURIComponent(id));
    if (!c || c.from !== uid || c.status !== 'ringing') return 403;
    if (Date.now() - Date.parse(c.createdAt || 0) > 120e3) return 403;
    await push(env, tok, [c.to], {
      type: 'call', title: (c.audio ? '📞 ' : '📹 ') + short(c.fromName, 40) + (c.audio ? ' дуут дуудлагаар залгаж байна' : ' залгаж байна'),
      body: 'Хариулахын тулд дарна уу', tag: 'call-' + id, url: './index.html',
    }, 60);
    return 200;
  }
  if (b.kind === 'req') {
    const id = String(b.id || '');
    const r = await fsGet(env, tok, 'requests/' + encodeURIComponent(id));
    if (!r || r.from !== uid || r.status !== 'pending') return 403;
    await push(env, tok, [r.to], {
      type: 'req', title: '👋 Найзын хүсэлт', body: short(r.fromName, 40) + ' найз болохыг хүсч байна',
      tag: 'req-' + id, url: './index.html',
    }, 86400);
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
    if (req.method !== 'POST') return new Response('maze-push ok', {headers: cors});
    let status = 500;
    try { status = await handle(req, env); } catch (e) { status = /token|alg|kid/.test(e.message) ? 401 : 500; }
    return new Response(null, {status, headers: cors});
  },
};
