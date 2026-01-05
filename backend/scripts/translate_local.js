const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function translateSrt(srtPath, targetLang = 'my') {
  if (!fs.existsSync(srtPath)) {
    throw new Error(`SRT not found: ${srtPath}`);
  }
  const srtContent = fs.readFileSync(srtPath, 'utf8');
  const blocks = srtContent.split(/\r?\n\r?\n/).filter(Boolean);
  const translatedBlocks = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    if (lines.length < 3) { translatedBlocks.push(block); continue; }
    const idx = lines[0];
    const time = lines[1];
    const text = lines.slice(2).join('\n');
    try {
      const resp = await axios.post('https://libretranslate.de/translate', {
        q: text,
        source: 'auto',
        target: targetLang,
        format: 'text'
      }, { timeout: 60000 });
      const translated = resp.data?.translatedText || text;
      translatedBlocks.push(`${idx}\n${time}\n${translated}`);
    } catch (e) {
      console.error('Translate API failed for block', idx, e.message);
      translatedBlocks.push(`${idx}\n${time}\n${text}`);
    }
  }
  const baseName = path.basename(srtPath, path.extname(srtPath));
  const outPath = path.join(path.dirname(srtPath), baseName + `_${targetLang}.srt`);
  const out = translatedBlocks.join('\n\n') + '\n\n';
  fs.writeFileSync(outPath, out, { encoding: 'utf8' });
  return outPath;
}

(async () => {
  try {
    const arg = process.argv[2] || path.join(__dirname, '..', 'uploads', '1767490454710.srt');
    console.log('Translating', arg, '-> Burmese (my)');
    const out = await translateSrt(arg, 'my');
    console.log('Translation completed:', out);
  } catch (err) {
    console.error('Translation failed:', err.message);
    process.exit(1);
  }
})();
