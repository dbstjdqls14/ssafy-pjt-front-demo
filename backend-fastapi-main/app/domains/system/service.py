import subprocess


def get_gpu_status() -> dict[str, str]:
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
            capture_output=True,
            text=True,
            timeout=10,
            check=True,
        )

        return {
            "status": "available",
            "gpu": result.stdout.strip(),
        }

    except Exception as exception:
        return {
            "status": "unavailable",
            "error": str(exception),
        }
