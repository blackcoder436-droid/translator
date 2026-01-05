const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function srtTimeToSeconds(line) {
  const m = /(?:(\d+):)?(\d{2}):(\d{2}),(\d{1,3})/.exec(line);
  if (!m) return 0;
  const hh = parseInt(m[1] || '0', 10);
  const mm = parseInt(m[2], 10);
  const ss = parseInt(m[3], 10);
  const ms = parseInt(m[4] || '0', 10);
  return hh*3600 + mm*60 + ss + (ms/1000);
}

function buildDrawtextFilters(srtPath, fontPath, fontSize = 36, marginV = 40) {
  const data = fs.readFileSync(srtPath, 'utf8');
  const parts = data.split(/\n\s*\n/);
  const drawParts = [];
  const fontFor = fontPath.replace(/\\/g, '/');
  for (const part of parts) {
    const lines = part.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) continue;
    let idx = 0;
    if (/^\d+$/.test(lines[0].trim())) idx = 1;
    const times = lines[idx].split('-->');
    if (!times || times.length < 2) continue;
    const start = srtTimeToSeconds(times[0].trim());
    const end = srtTimeToSeconds(times[1].trim());
    const text = lines.slice(idx+1).join('\\n').replace(/'/g, "\\'").replace(/:/g, '\\:').replace(/,/g, '\\,');
    const yPos = `h-${marginV}`;
    const partFilter = `drawtext=fontfile='${fontFor}':text='${text}':fontsize=${fontSize}:fontcolor=white:x=(w-text_w)/2:y=${yPos}:box=1:boxcolor=black@0.6:boxborderw=6:enable='between(t,${start},${end})'`;
    drawParts.push(partFilter);
  }
  return drawParts.join(',');
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 3) {
    console.error('Usage: node hardburn_from_srt.js <videoPath> <srtPath> <outPath>');
    process.exit(2);
  }
  const [video, srt, out] = argv;
  const fontDir = path.join(__dirname, '..', 'fonts');
  let fontFile = null;
  if (fs.existsSync(fontDir)) {
    const cand = fs.readdirSync(fontDir).find(f => f.toLowerCase().endsWith('.ttf') || f.toLowerCase().endsWith('.otf'));
    if (cand) fontFile = path.resolve(path.join(fontDir, cand));
  }
  if (!fontFile) {
    console.error('No font found in backend/fonts. Place a Myanmar-capable TTF there.');
    process.exit(3);
  }

  const vf = buildDrawtextFilters(srt, fontFile, 36, 40);
  if (!vf || vf.trim().length === 0) {
    console.error('No drawtext filters built from SRT');
    process.exit(4);
  }

  console.log('Running ffmpeg with VF length', vf.length);
  const ff = spawnSync('ffmpeg', ['-y', '-i', path.resolve(video), '-vf', vf, '-c:a', 'copy', path.resolve(out)], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 200, timeout: 1200000 });
  if (ff.status !== 0) {
    console.error('ffmpeg failed', ff.stderr);
    process.exit(5);
  }
  console.log('Export succeeded:', out);
}

main();
