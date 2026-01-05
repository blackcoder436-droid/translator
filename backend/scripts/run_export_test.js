const { spawnSync } = require('child_process');
const path = require('path');

const video = path.resolve('backend', 'uploads', '1767599683613.mp4');
const srt = path.resolve('backend', 'uploads', '1767599683613_my.srt');
const outDir = path.resolve('backend', 'uploads', 'exports');
const out = path.join(outDir, '1767599683613_subtitled.mp4');

console.log('video', video);
console.log('srt', srt);
console.log('out', out);

const args = ['-y', '-i', video, '-i', srt, '-c', 'copy', '-c:s', 'mov_text', out];
console.log('ffmpeg args', args.join(' '));
const res = spawnSync('ffmpeg', args, { encoding: 'utf8', timeout: 600000, maxBuffer: 1024 * 1024 * 50 });
console.log('status', res.status);
console.log('stdout:', res.stdout ? res.stdout.substring(0,2000) : '');
console.log('stderr:', res.stderr ? res.stderr.substring(0,5000) : '');
