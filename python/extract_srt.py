import sys
import whisper
import os

def extract_srt(video_path):
    model = whisper.load_model("base")  # Use 'medium' or 'large' for better accuracy, especially for Burmese
    result = model.transcribe(video_path)
    
    srt_content = ""
    for i, segment in enumerate(result['segments'], 1):
        start = segment['start']
        end = segment['end']
        text = segment['text']
        srt_content += f"{i}\n{format_time(start)} --> {format_time(end)}\n{text}\n\n"
    
    return srt_content

def format_time(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"

if __name__ == "__main__":
    video_path = sys.argv[1]
    srt_content = extract_srt(video_path)
    print(srt_content)
    video_path = sys.argv[1]
    extract_srt(video_path)