"""Generate optional local synthetic word recordings with Kokoro-82M.

The model and voices are downloaded by Kokoro on first use. Check their current
license and attribution requirements before redistributing any model or audio.
Input is a learning-material JSON object with a vocabulary array, or a JSON list.
"""
import argparse
import json
import re
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description='Generate local UK/US Kokoro word audio')
    parser.add_argument('input', type=Path, help='JSON material or list of words')
    parser.add_argument('--output', type=Path, default=Path('voices'))
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding='utf-8-sig'))
    values = data.get('vocabulary', []) if isinstance(data, dict) else data
    if not isinstance(values, list):
        raise SystemExit('Expected a vocabulary array or a list of words.')
    words = sorted({str(x.get('word', '') if isinstance(x, dict) else x).strip().lower() for x in values})
    words = [w for w in words if re.fullmatch(r"[a-z]+(?:[-'][a-z]+)*", w)]
    if not words:
        raise SystemExit('No supported words found.')
    try:
        from kokoro import KPipeline
        import numpy as np
        import soundfile as sf
    except ImportError as exc:
        raise SystemExit('Install kokoro, numpy and soundfile before running: ' + str(exc))
    args.output.mkdir(parents=True, exist_ok=True)
    manifest_path = args.output / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    if not isinstance(manifest, dict):
        raise SystemExit('Existing manifest must be a JSON object.')
    for accent, language, voice in [('us', 'a', 'af_heart'), ('uk', 'b', 'bf_emma')]:
        pipeline = KPipeline(lang_code=language)
        folder = args.output / accent
        folder.mkdir(exist_ok=True)
        if not isinstance(manifest.get(accent, {}), dict):
            raise SystemExit('Existing accent manifest must be an object.')
        entries = manifest.setdefault(accent, {})
        for word in words:
            path = folder / (word + '.wav')
            if not path.exists():
                clips = [audio for _, _, audio in pipeline(word, voice=voice, speed=1)]
                if not clips:
                    raise SystemExit('No audio returned for ' + word)
                sf.write(str(path), np.concatenate(clips), 24000)
            entries[word] = f'voices/{accent}/{word}.wav'
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'{accent}: {len(words)} words ready')


if __name__ == '__main__':
    main()
