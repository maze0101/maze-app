# MAZE push сервер (Cloudflare Worker, үнэгүй)

Апп хаалттай үед мэдэгдэл (зурвас, дуудлага, найзын хүсэлт) илгээнэ. Firebase Blaze хэрэггүй.

## Суулгах (нэг удаа, ~10 минут)

1. https://dash.cloudflare.com дээр үнэгүй бүртгэл үүсгэнэ (карт шаардахгүй).
2. Firebase Console → Project settings → **Service accounts** → **Generate new private key** → JSON файл татна.
   Энэ файлыг ХЭЗЭЭ Ч GitHub-д оруулахгүй, хэнд ч өгөхгүй.
3. Терминалд:
   ```
   cd push-worker
   npx wrangler login
   npx wrangler secret put SERVICE_ACCOUNT     # JSON файлын БҮХ агуулгыг буулгана
   npx wrangler deploy
   ```
4. Deploy хийсний дараа гарсан хаягийг (`https://maze-push.<нэр>.workers.dev`) `index.html` ба `nutag-live.html` доторх `PUSH_URL`-д бичнэ, дараа нь GitHub руу оруулна.
5. Хүсвэл `wrangler.toml` доторх `ALLOWED_ORIGIN`-д аппын домэйнийг бичнэ (жишээ: `https://maze0101.github.io`).

## Ашиглах
Хэрэглэгч Тохиргоо → "Мэдэгдэл асаах" дарж зөвшөөрнө. iPhone дээр апп Home Screen-д нэмэгдсэн байх ёстой.

## Хамгаалалт
Worker нь Firebase ID token (баталгаажсан имэйл)-ийг шалгаж, илгээгч тухайн чат/дуудлага/хүсэлтийн жинхэнэ оролцогч мөн эсэхийг Firestore-оос шалгасны дараа л push илгээнэ.
