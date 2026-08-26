/* 앱에 담을 웹 파일을 www/ 로 복사합니다.
   앱의 본체는 저장소 맨 위의 network-dna.html 하나뿐이라
   그 파일을 www/index.html 로 옮겨 놓기만 하면 됩니다. */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'network-dna.html');
const OUT = path.join(__dirname, 'www', 'index.html');

if (!fs.existsSync(SRC)) {
  console.error('원본을 찾지 못했습니다: ' + SRC);
  process.exit(1);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.copyFileSync(SRC, OUT);
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log('www/index.html 로 복사했습니다 (' + kb + 'KB)');
