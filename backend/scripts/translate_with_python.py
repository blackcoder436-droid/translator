#!/usr/bin/env python3
import sys
import json
import subprocess
from pathlib import Path

base_dir = Path(__file__).resolve().parents[1]
Uploads = base_dir / 'uploads'
python_translator = Path(__file__).resolve().parents[1].parent / 'python' / 'translate_text.py'

if len(sys.argv) > 1:
    srt_path = Path(sys.argv[1])
else:
    srt_path = Uploads / '1767490454710.srt'

if not srt_path.exists():
    print(f"SRT not found: {srt_path}")
    sys.exit(1)

srt_text = srt_path.read_text(encoding='utf8')
blocks = [b for b in srt_text.split('\n\n') if b.strip()]
texts = []
for b in blocks:
    lines = b.splitlines()
    if len(lines) >= 3:
        texts.append('\n'.join(lines[2:]))
    else:
        texts.append('')

# Call the project's translate_text.py
try:
    proc = subprocess.run([
        sys.executable,
        str(python_translator),
        json.dumps(texts, ensure_ascii=False),
        'my'
    ], capture_output=True, text=True, check=True, timeout=120)
except subprocess.CalledProcessError as e:
    print('Translation subprocess failed', e, file=sys.stderr)
    print('STDOUT:', e.stdout)
    print('STDERR:', e.stderr)
    sys.exit(1)
except Exception as e:
    print('Translation call failed:', str(e), file=sys.stderr)
    sys.exit(1)

out = proc.stdout.strip()
try:
    data = json.loads(out)
    translations = data.get('translations')
    if not translations:
        print('No translations returned, aborting')
        sys.exit(1)
except Exception as e:
    print('Failed to parse translation output:', e, file=sys.stderr)
    print('Raw output:', out)
    sys.exit(1)

translated_blocks = []
for i, b in enumerate(blocks):
    lines = b.splitlines()
    if len(lines) >= 2:
        idx = lines[0]
        time = lines[1]
        text = translations[i] if i < len(translations) else '\n'.join(lines[2:])
        translated_blocks.append(f"{idx}\n{time}\n{text}")
    else:
        translated_blocks.append(b)

out_path = srt_path.with_name(srt_path.stem + '_my' + srt_path.suffix)
out_path.write_text('\n\n'.join(translated_blocks) + '\n\n', encoding='utf8')
print('Wrote', out_path)
