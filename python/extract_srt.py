import sys
import whisper
import os
import subprocess
import tempfile
import sys

def extract_srt(video_path, language=None):
    # First try to extract embedded subtitle stream with ffmpeg (fast and preserves original timings/text)
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            out_srt = os.path.join(tmpdir, 'extracted.srt')
            # Attempt to map the first subtitle stream
            cmd = [
                'ffmpeg', '-y', '-i', video_path,
                '-map', '0:s:0',
                out_srt
            ]
            proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if proc.returncode == 0 and os.path.exists(out_srt):
                with open(out_srt, 'r', encoding='utf-8', errors='replace') as f:
                    return f.read()
    except FileNotFoundError:
        # ffmpeg not installed or not in PATH
        pass
    except Exception:
        # extraction failed; we'll fallback to transcription
        pass

    # Fallback: use Whisper transcription to generate SRT
    # Allow selecting model via env var; default to 'small' for multilingual support without huge download
    model_name = os.environ.get('WHISPER_MODEL', 'small')
    model = whisper.load_model(model_name)

    # Prepare transcription kwargs
    # If language is specified and not 'auto', use it; otherwise let Whisper auto-detect
    transcribe_kwargs = {}
    if language and language.lower() != 'auto':
        # Map common language codes to Whisper's expected codes
        lang_map = {
            'en': 'en', 'my': 'my', 'th': 'th', 'zh': 'zh',
            'ja': 'ja', 'ko': 'ko', 'vi': 'vi'
        }
        whisper_lang = lang_map.get(language.lower(), language.lower())
        transcribe_kwargs['language'] = whisper_lang

    result = model.transcribe(video_path, **transcribe_kwargs)

    srt_content = ""
    for i, segment in enumerate(result['segments'], 1):
        start = segment['start']
        end = segment['end']
        text = segment['text'].strip()
        srt_content += f"{i}\n{format_time(start)} --> {format_time(end)}\n{text}\n\n"

    return srt_content

def format_time(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print('Usage: extract_srt.py <video_path> [language]', file=sys.stderr)
        sys.exit(2)
    video_path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else 'auto'
    srt_content = extract_srt(video_path, language)
    # Handle Unicode output properly on Windows
    if sys.stdout.encoding != 'utf-8':
        # Write directly to stdout buffer with UTF-8 encoding
        sys.stdout.buffer.write(srt_content.encode('utf-8'))
    else:
        print(srt_content, end='')