import json, os, sys
from faster_whisper import WhisperModel

input_path = sys.argv[1]
model_name = os.getenv('WHISPER_MODEL', 'small')
model = WhisperModel(model_name, device=os.getenv('WHISPER_DEVICE', 'cpu'), compute_type=os.getenv('WHISPER_COMPUTE_TYPE', 'int8'))
segments, info = model.transcribe(input_path, word_timestamps=True, vad_filter=True)
words = []
for segment in segments:
    if segment.words:
        for word in segment.words:
            text = (word.word or '').strip()
            if text:
                words.append({'text': text, 'start': float(word.start), 'end': float(word.end)})
    else:
        text = (segment.text or '').strip()
        if text:
            words.append({'text': text, 'start': float(segment.start), 'end': float(segment.end)})
print(json.dumps({'language': info.language, 'words': words}, ensure_ascii=False))
