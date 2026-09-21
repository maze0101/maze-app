// MAZE APP: апп хаалттай үед push мэдэгдэл (дуудлага, мессеж, найзын хүсэлт) илгээнэ.
const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();
const REGION = 'asia-east2'; // Firestore өгөгдлийн сангийн байршилтай ижил байх ёстой
const DEAD = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];
const short = (s, n) => String(s || '').slice(0, n);

async function push(uids, data, ttl) {
  await Promise.all(uids.map(async uid => {
    const snap = await db.collection('users').doc(uid).collection('fcm').get();
    await Promise.all(snap.docs.map(async d => {
      try {
        await getMessaging().send({
          token: d.id,
          data,
          webpush: {headers: {Urgency: 'high', TTL: String(ttl)}},
        });
      } catch (e) {
        if (DEAD.includes(e.code)) await d.ref.delete().catch(() => {});
        else console.warn('push failed', e.code);
      }
    }));
  }));
}

exports.onCall = onDocumentCreated({document: 'calls/{id}', region: REGION}, async ev => {
  const c = ev.data && ev.data.data();
  if (!c || c.status !== 'ringing') return;
  await push([c.to], {
    type: 'call', title: (c.audio ? '📞 ' : '📹 ') + short(c.fromName, 40) + (c.audio ? ' дуут дуудлагаар залгаж байна' : ' залгаж байна'),
    body: 'Хариулахын тулд дарна уу', tag: 'call-' + ev.params.id, url: './index.html',
  }, 60);
});

exports.onMessage = onDocumentCreated({document: 'chats/{cid}/messages/{mid}', region: REGION}, async ev => {
  const m = ev.data && ev.data.data();
  if (!m) return;
  const chat = await db.collection('chats').doc(ev.params.cid).get();
  if (!chat.exists) return;
  const c = chat.data();
  const ok = [];
  for (const u of (c.members || []).filter(x => x !== m.from)) {
    const b = await db.collection('blocks').doc(u + '_' + m.from).get(); // хүлээн авагч илгээгчийг блоклосон эсэх
    if (!b.exists) ok.push(u);
  }
  const title = c.group ? short(c.name, 40) : short(m.fn, 40);
  const body = (c.group ? short(m.fn, 30) + ': ' : '') +
    (m.text ? short(m.text, 120) : m.img ? '📷 Зураг' : m.aud ? '🎤 Дуут мессеж' : '');
  await push(ok, {type: 'msg', title: '✉ ' + title, body, tag: 'chat-' + ev.params.cid, url: './index.html'}, 3600);
});

exports.onRequest = onDocumentCreated({document: 'requests/{id}', region: REGION}, async ev => {
  const r = ev.data && ev.data.data();
  if (!r) return;
  await push([r.to], {
    type: 'req', title: '👋 Найзын хүсэлт',
    body: short(r.fromName, 40) + ' найз болохыг хүсч байна', tag: 'req-' + ev.params.id, url: './index.html',
  }, 86400);
});
