from fastapi import APIRouter
from app.config import FILTER_DEFINITIONS

router = APIRouter()

@router.get("/health")
async def health():
    return {"status": "ok"}

@router.get("/filter-definitions")
async def get_filter_definitions():
    """Get all available filter definitions from config.yaml"""
    return {
        "success": True,
        "count": len(FILTER_DEFINITIONS),
        "filter_definitions": FILTER_DEFINITIONS
    }
