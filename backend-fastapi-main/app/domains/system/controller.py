from datetime import datetime, timezone

from fastapi import APIRouter

from app.domains.system.service import get_gpu_status

router = APIRouter()


@router.get("/health")
async def health_check():
    return {
        "status": "UP",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/gpu")
def gpu() -> dict[str, str]:
    return get_gpu_status()
