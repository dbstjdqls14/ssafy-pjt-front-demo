from __future__ import annotations

import argparse
import time

import numpy as np
import sounddevice as sd


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check microphone input levels")
    parser.add_argument("--seconds", type=float, default=3.0)
    parser.add_argument("--device", type=int, default=None)
    parser.add_argument("--sample-rate", type=int, default=16000)
    parser.add_argument("--auto-sample-rate", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    print("Input devices:")
    for index, device in enumerate(sd.query_devices()):
        if device["max_input_channels"] > 0:
            marker = "*" if sd.default.device[0] == index else " "
            print(f"{marker} {index}: {device['name']} ({device['max_input_channels']} ch)")

    device = args.device if args.device is not None else sd.default.device[0]
    sample_rate = args.sample_rate
    if args.auto_sample_rate:
        sample_rate = int(sd.query_devices(device, "input")["default_samplerate"])
    print(f"\nTesting device {device} for {args.seconds:.1f}s. Speak now.")
    peak_db = -120.0
    avg_values = []

    def callback(indata, frames, callback_time, status):
        nonlocal peak_db
        del frames, callback_time
        if status:
            print(f"status: {status}")
        samples = np.asarray(indata[:, 0], dtype=np.float32)
        rms = float(np.sqrt(np.mean(np.square(samples))) + 1e-9)
        db = 20.0 * float(np.log10(rms))
        peak_db = max(peak_db, db)
        avg_values.append(db)

    with sd.InputStream(
        samplerate=sample_rate,
        blocksize=int(sample_rate * 0.2),
        channels=1,
        dtype="float32",
        device=device,
        callback=callback,
    ):
        end = time.time() + args.seconds
        while time.time() < end:
            time.sleep(0.2)
            if avg_values:
                current = avg_values[-1]
                bars = max(0, min(40, int((current + 70) * 1.2)))
                print(f"{current:6.1f} dB | {'#' * bars}")

    avg_db = sum(avg_values) / len(avg_values) if avg_values else -120.0
    print(f"\nAverage: {avg_db:.1f} dB, Peak: {peak_db:.1f} dB")
    if peak_db < -55:
        print("Result: input is very quiet. Try another --device or check Windows microphone permission/input volume.")
    else:
        print("Result: microphone input detected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
