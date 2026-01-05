#!/usr/bin/env python3
from googletrans import Translator
from pathlib import Path
import sys

uploads = Path(__file__).resolve().parents[1] / 'uploads'
input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else uploads / '1767490454710.srt'
if not input_path.exists():
    print('Input SRT not found:', input_path)
    sys.exit(1)

text = input_path.read_text(encoding='utf8')
blocks = [b for b in text.split('\n\n') if b.strip()]
translator = Translator()
translated_blocks = []
for b in blocks:
    lines = b.splitlines()
    if len(lines) < 3:
        translated_blocks.append(b)
        continue
    idx = lines[0]
    time = lines[1]
    src_text = '\n'.join(lines[2:])
    try:
        res = translator.translate(src_text, dest='my')
        tr = res.text if hasattr(res, 'text') else str(res)
    except Exception as e:
        print('translate error:', e)
        tr = src_text
    translated_blocks.append(f"{idx}\n{time}\n{tr}")

out_path = input_path.with_name(input_path.stem + '_my' + input_path.suffix)
out_path.write_text('\n\n'.join(translated_blocks) + '\n\n', encoding='utf8')
print('Wrote', out_path)
