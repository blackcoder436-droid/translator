const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function srtTimeToAss(s) {
  const m = /(?:(\d+):)?(\d{2}):(\d{2}),?(\d{1,3})/.exec(s);
  if (!m) return '0:00:00.00';
  const hh = m[1] || '0';
  const mm = m[2];
  const ss = m[3];
  const ms = m[4] || '0';
  const cs = Math.round((parseInt(ms,10) || 0) / 10);
  return `${hh}:${mm}:${ss}.${cs.toString().padStart(2,'0')}`;
}

function parseSrtToEvents(srt) {
  const parts = srt.split(/\n\s*\n/);
  const events = [];
  for (const part of parts) {
    const lines = part.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) continue;
    let idx = 0;
    if (/^\d+$/.test(lines[0].trim())) idx = 1;
    const times = lines[idx].split('-->');
    if (!times || times.length < 2) continue;
    const start = srtTimeToAss(times[0].trim());
    const end = srtTimeToAss(times[1].trim());
    const text = lines.slice(idx+1).join('\\N').replace(/"/g, "'");
    events.push({ start, end, text });
  }
  return events;
}

function buildAss(srtPath, fontName = 'Noto Sans Myanmar', fontSize = 36, fontColor = '#FFFFFF', marginV = 40) {
  const srt = fs.readFileSync(srtPath, 'utf8');
  const events = parseSrtToEvents(srt);
  const ass = [];
  ass.push('[Script Info]');
  ass.push('ScriptType: v4.00+');
  ass.push('PlayResX: 1280');
  ass.push('PlayResY: 720');
  ass.push('');
  ass.push('[V4+ Styles]');
  ass.push('Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding');
  const hexToAssColor = (hex) => {
    const h = (hex || '#ffffff').replace('#','');
    const r = h.substring(0,2);
    const g = h.substring(2,4);
    const b = h.substring(4,6);
    return `&H00${b}${g}${r}`;
  };
  ass.push(`Style: Default,${fontName},${fontSize},${hexToAssColor(fontColor)},&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,10,10,${marginV},1`);
  ass.push('');
  ass.push('[Events]');
  ass.push('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text');
  for (const ev of events) {
    ass.push(`Dialogue: 0,${ev.start},${ev.end},Default,,0,0,0,,${ev.text}`);
  }
  return ass.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 3) {
    console.error('Usage: node ass_burn_from_srt.js <srtPath> <videoPath> <outPath>');
    process.exit(2);
  }
  const [srtPath, videoPath, outPath] = argv;
  const base = path.basename(videoPath, path.extname(videoPath));
  const assRel = path.join('uploads', 'exports', base + '.ass');
  const absAss = path.resolve(assRel);
  const assText = buildAss(srtPath);
  fs.mkdirSync(path.dirname(absAss), { recursive: true });
  fs.writeFileSync(absAss, assText, 'utf8');

  // Use libass filter without extra quoting
  // Use a path relative to the current working directory to avoid drive-letter parsing issues
  const relPath = path.relative(process.cwd(), absAss).replace(/\\/g, '/');
  const assForFfmpeg = relPath;
  const vfArg = `ass=${assForFfmpeg}`;
  console.log('Running ffmpeg - will burn ASS:', absAss);
  const ff = spawnSync('ffmpeg', ['-y', '-i', path.resolve(videoPath), '-vf', vfArg, '-c:a', 'copy', path.resolve(outPath)], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 200, timeout: 1200000 });
  if (ff.status !== 0) {
    console.error('ffmpeg failed', ff.stderr);
    process.exit(3);
  }
  console.log('Created', outPath);
}

main();
