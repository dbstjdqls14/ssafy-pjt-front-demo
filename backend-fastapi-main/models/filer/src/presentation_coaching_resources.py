"""CPU, RAM, GPU, and VRAM sampling for model benchmark runs."""

from dataclasses import dataclass, field
import statistics
import subprocess
import threading

import psutil


@dataclass(frozen=True, slots=True)
class ResourcePeaks:
    """Process and NVIDIA resource samples collected across a complete run."""

    average_cpu_percent: float
    max_cpu_percent: float
    max_process_ram_mib: float
    average_gpu_percent: float
    max_gpu_percent: float
    max_vram_mib: float


@dataclass(slots=True)  # noqa: MUTABLE_OK
class ResourceSampler:
    """Mutable sampler whose measurements accumulate on a background thread."""

    process: psutil.Process = field(default_factory=psutil.Process)
    cpu_samples: list[float] = field(default_factory=list)
    ram_samples: list[float] = field(default_factory=list)
    gpu_samples: list[float] = field(default_factory=list)
    vram_samples: list[float] = field(default_factory=list)
    stop_signal: threading.Event = field(default_factory=threading.Event)
    worker: threading.Thread | None = None

    def start(self) -> None:
        self.process.cpu_percent(interval=None)
        self._sample()
        self.worker = threading.Thread(target=self._loop, daemon=True)
        self.worker.start()

    def stop(self) -> ResourcePeaks:
        self.stop_signal.set()
        if self.worker is not None:
            self.worker.join(timeout=1.0)
        self._sample()
        return ResourcePeaks(
            _mean(self.cpu_samples),
            max(self.cpu_samples, default=0.0),
            max(self.ram_samples, default=0.0),
            _mean(self.gpu_samples),
            max(self.gpu_samples, default=0.0),
            max(self.vram_samples, default=0.0),
        )

    def _loop(self) -> None:
        while not self.stop_signal.wait(0.2):
            self._sample()

    def _sample(self) -> None:
        self.cpu_samples.append(self.process.cpu_percent(interval=None))
        self.ram_samples.append(self.process.memory_info().rss / 1024**2)
        gpu_sample = _nvidia_sample()
        if gpu_sample is not None:
            self.gpu_samples.append(gpu_sample[0])
            self.vram_samples.append(gpu_sample[1])


def gpu_name() -> str:
    """Return the first NVIDIA GPU name or a stable unavailable marker."""
    try:
        result = subprocess.run(
            ("nvidia-smi", "--query-gpu=name", "--format=csv,noheader"),
            check=True,
            capture_output=True,
            text=True,
            timeout=2.0,
        )
        return result.stdout.splitlines()[0].strip()
    except (FileNotFoundError, subprocess.SubprocessError, IndexError):
        return "GPU unavailable"


def _nvidia_sample() -> tuple[float, float] | None:
    command = (
        "nvidia-smi", "--query-gpu=utilization.gpu,memory.used",
        "--format=csv,noheader,nounits",
    )
    try:
        output = subprocess.run(
            command, check=True, capture_output=True, text=True, timeout=2.0,
        ).stdout.splitlines()[0]
        utilization, memory = output.split(",", maxsplit=1)
        return float(utilization.strip()), float(memory.strip())
    except (FileNotFoundError, subprocess.SubprocessError, IndexError, ValueError):
        return None


def _mean(values: list[float]) -> float:
    return statistics.fmean(values) if values else 0.0
