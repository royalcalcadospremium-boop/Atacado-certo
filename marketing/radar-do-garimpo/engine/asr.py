# Transcribe every narration file with word timestamps (faster-whisper) -> vo/asr_raw.json, then run captext.py
from faster_whisper import WhisperModel
import glob, json
m = WhisperModel('small', compute_type='int8'); out = {}
for f in sorted(glob.glob('vo/[VH]*.mp3')):
    s, i = m.transcribe(f, language='pt', word_timestamps=True); segs = list(s)
    words = [{'w': w.word.strip(), 's': round(w.start, 3), 'e': round(w.end, 3)} for x in segs for w in x.words]
    out[f] = {'text': ' '.join(x.text.strip() for x in segs), 'start': words[0]['s'] if words else 0, 'end': words[-1]['e'] if words else 0, 'words': words}
json.dump(out, open('vo/asr_raw.json', 'w'), ensure_ascii=False, indent=0)
print('done')
