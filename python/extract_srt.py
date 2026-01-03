import sys
import whisper
import os
import subprocess
import tempfile
import sys

def extract_srt(video_path):
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

    # If caller provided a language hint, use it to avoid autodetect failures
    # The second CLI arg (if present) is treated as the source language code or 'auto'
    lang = None
    try:
        if len(sys.argv) > 2:
            arg_lang = sys.argv[2]
            if arg_lang and arg_lang.lower() != 'auto':
                lang = arg_lang
    except Exception:
        lang = None

    transcribe_kwargs = {}
    if lang:
        transcribe_kwargs['language'] = lang

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
        print('Usage: extract_srt.py <video_path> [sourceLang]', file=sys.stderr)
        sys.exit(2)
    video_path = sys.argv[1]
    srt_content = extract_srt(video_path)
    print(srt_content)