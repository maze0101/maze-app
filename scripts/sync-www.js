// index.html/sw.js/manifest.json/icon-* файлуудыг www/ рүү хуулж, Capacitor-ийн native төслүүд рүү sync хийнэ.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = ['index.html', 'sw.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];

fs.mkdirSync(path.join(root, 'www'), {recursive: true});
for (const f of files) fs.copyFileSync(path.join(root, f), path.join(root, 'www', f));
console.log('www/ шинэчлэгдлээ:', files.join(', '));
