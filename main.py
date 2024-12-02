import numpy as np
from pydub import AudioSegment
from pydub.playback import play

def generate_sine_wave(frequency, duration_ms):
    # Sampling rate
    sample_rate = 44100
    # Duration in seconds
    duration = duration_ms / 1000
    # Generate the waveform
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    waveform = np.sin(2 * np.pi * frequency * t)  # Full amplitude 
    # Convert waveform to 16-bit audio format
    audio_data = (waveform * 32767).astype(np.int16)
    # Create an AudioSegment from the raw data
    return AudioSegment(audio_data.tobytes(), frame_rate=sample_rate, sample_width=2, channels=1)

def morse_to_audio(morse_code):
    dot = generate_sine_wave(frequency=1000, duration_ms=200)  # Dot sound
    dash = generate_sine_wave(frequency=1000, duration_ms=600)  # Dash sound
    silence_short = AudioSegment.silent(duration=200)  # Between dots and dashes
    silence_long = AudioSegment.silent(duration=600)  # Between words

    audio = AudioSegment.silent(duration=0)

    for symbol in morse_code:
        if symbol == '.':
            audio += dot + silence_short
        elif symbol == '-':
            audio += dash + silence_short
        elif symbol == ' ':
            audio += silence_long

    play(audio)

# Test with a single dot
morse_to_audio('..- .')
