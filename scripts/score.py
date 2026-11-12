"""Create the original 180-second instrumental score. Requires NumPy and FFmpeg."""
from pathlib import Path
import subprocess

import numpy as np

RATE = 48000
SECONDS = 180
COUNT = RATE * SECONDS
OUTPUT = Path(__file__).resolve().parents[1] / "assets" / "music.ogg"

def frequency(note):
    return 440 * 2 ** ((note - 69) / 12)

def add(start, note, duration, level, pan, bell=False):
    t = np.arange(round(duration * RATE)) / RATE
    f = frequency(note)
    if bell:
        envelope = np.minimum(t / .045, 1) * np.exp(-t * 1.5) * np.minimum((duration-t) / .4, 1)
        tone = np.sin(2*np.pi*f*t) + .22*np.sin(4*np.pi*f*t) + .05*np.sin(6*np.pi*f*t)
    else:
        envelope = np.sin(np.pi * t / duration) ** 1.6
        tone = (.72*np.sin(2*np.pi*f*t) + .17*np.sin(2*np.pi*f*1.003*t)
                + .11*np.sin(4*np.pi*f*t) + .04*np.sin(6*np.pi*f*t))
    signal = (envelope * tone * level).astype(np.float32)
    first = round(start * RATE) % COUNT
    split = min(len(signal), COUNT - first)
    mix[first:first + split] += signal[:split, None] * pan
    if split < len(signal):
        mix[:len(signal) - split] += signal[split:, None] * pan

mix = np.zeros((COUNT, 2), dtype=np.float32)
chords = [(38, 50, 57, 60, 65), (34, 50, 53, 57, 60),
          (41, 48, 53, 57, 64), (36, 48, 55, 62, 64),
          (43, 50, 55, 58, 62), (36, 48, 55, 60, 64)]
for bar in range(30):
    chord = chords[bar % len(chords)]
    start = bar * 6
    for i, note in enumerate(chord):
        pan = np.array([.93 + .07*(i % 2), 1 - .07*(i % 2)], dtype=np.float32)
        add(start - 1.45 + i*.06, note, 8.9, .034 if i == 0 else .015, pan)
    for j, delay in enumerate((.75, 2.25, 4.125)):
        note = chord[2 + (j + bar) % 3] + 12
        add(start + delay, note, 3.1, .018, np.array([.90, 1.0]), bell=True)
        add(start + delay + .31, note, 3.1, .004, np.array([1.0, .55]), bell=True)

pcm = (np.clip(mix * 2, -.98, .98) * 32767).astype("<i2").tobytes()
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-f", "s16le", "-ar", str(RATE), "-ac", "2", "-i", "pipe:0",
                "-c:a", "libopus", "-b:a", "112k", str(OUTPUT)], input=pcm, check=True)
