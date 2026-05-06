"""Whisper transcription pipeline step.

Entry point for the Whisper container. Reads MP4 from INPUT_PATH,
extracts audio, transcribes with word-level timestamps, and writes
transcript.json to OUTPUT_PATH.
"""
import sys


def main():
    # TODO: Full implementation in Plan 02-02 (transcription engine)
    # This placeholder allows the container to build and run basic validation.
    print("Whisper container started — transcription logic pending (Plan 02-02)")
    sys.exit(0)


if __name__ == "__main__":
    main()