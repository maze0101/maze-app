# Push сервер

Үндсэн хувилбар: **Vercel Function** (`/api/push.js`, үнэгүй). Cloudflare Worker (`push-worker/`) нь хувилбар.

## Vercel дээр суулгах
1. vercel.com → GitHub-аар нэвтэрнэ → **Add New Project** → `maze0101/maze-app`-г сонгоод Deploy.
2. Firebase Console → Project settings → Service accounts → **Generate new private key** (JSON татна).
3. Vercel → Project → Settings → Environment Variables → `SERVICE_ACCOUNT` нэрээр JSON-ийн БҮХ агуулгыг буулгаж Save → Redeploy.
4. Hostname-аа (`https://<төсөл>.vercel.app/api/push`) `index.html` ба `nutag-live.html` доторх `PUSH_URL`-д бичнэ.

Түлхүүр файлыг хэзээ ч GitHub-д оруулахгүй.
