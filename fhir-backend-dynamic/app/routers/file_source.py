from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from typing import Optional
import json
import uuid
import logging
import os
import tempfile
from datetime import datetime, timedelta, date

router = APIRouter(prefix="/sources/file", tags=["file-source"])
logger = logging.getLogger(__name__)

STORE_DIR = os.path.join(tempfile.gettempdir(), "fhir_file_sources")
os.makedirs(STORE_DIR, exist_ok=True)

_meta_cache = {}   # source_id -> {filename, uploaded_at}
STORE_DURATION = timedelta(hours=2)


def _source_path(source_id: str) -> str:
    return os.path.join(STORE_DIR, f"{source_id}.json")


def _load_source(source_id: str):
    path = _source_path(source_id)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception:
        return None


def _cleanup_expired():
    now = datetime.now()
    for fname in os.listdir(STORE_DIR):
        if not fname.endswith(".json"):
            continue
        fpath = os.path.join(STORE_DIR, fname)
        age = datetime.now() - datetime.fromtimestamp(os.path.getmtime(fpath))
        if age > STORE_DURATION:
            try:
                os.remove(fpath)
            except Exception:
                pass


def _parse_entries(bundle):
    if isinstance(bundle, dict) and bundle.get("resourceType") == "Bundle":
        return [e.get("resource") for e in bundle.get("entry", []) if e.get("resource")]
    if isinstance(bundle, list):
        return bundle
    return [bundle]


@router.post("/upload")
async def upload_fhir_file(file: UploadFile = File(...)):
    _cleanup_expired()

    content = await file.read()
    try:
        bundle = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON — expected a FHIR Bundle or resource")

    entries = [e for e in _parse_entries(bundle) if e]

    source_id = str(uuid.uuid4())
    store_data = {
        "entries": entries,
        "filename": file.filename,
        "uploaded_at": datetime.now().isoformat(),
    }

    with open(_source_path(source_id), "w") as f:
        json.dump(store_data, f)

    resource_counts = {}
    for entry in entries:
        rt = entry.get("resourceType", "Unknown")
        resource_counts[rt] = resource_counts.get(rt, 0) + 1

    logger.info(f"Uploaded: {file.filename} — {len(entries)} resources, source_id={source_id}")

    return {
        "success": True,
        "source_id": source_id,
        "filename": file.filename,
        "total_resources": len(entries),
        "resource_counts": resource_counts,
    }


def _get_source_or_404(source_id: str):
    data = _load_source(source_id)
    if data is None:
        raise HTTPException(status_code=404, detail="File source not found or expired")
    return data


@router.get("/{source_id}/Patient")
async def get_patients(
    source_id: str,
    _count: int = Query(default=50),
    _getpagesoffset: int = Query(default=0),
    search: Optional[str] = Query(default=None),
):
    store = _get_source_or_404(source_id)
    patients = [e for e in store["entries"] if e.get("resourceType") == "Patient"]

    if search:
        q = search.lower()
        patients = [
            p for p in patients
            if q in " ".join(
                " ".join(n.get("given", [])) + " " + n.get("family", "")
                for n in p.get("name", [])
            ).lower() or q in p.get("id", "").lower()
        ]

    total = len(patients)
    page_data = patients[_getpagesoffset : _getpagesoffset + _count]

    return {
        "success": True,
        "data": page_data,
        "resource_type": "Patient",
        "count": len(page_data),
        "pagination": {
            "total": total,
            "count": len(page_data),
            "has_next": (_getpagesoffset + _count) < total,
            "has_prev": _getpagesoffset > 0,
            "offset": _getpagesoffset,
        },
        "source": "file",
        "filename": store["filename"],
    }


@router.get("/{source_id}/Patient/{patient_id}")
async def get_patient(source_id: str, patient_id: str):
    store = _get_source_or_404(source_id)
    for entry in store["entries"]:
        if entry.get("resourceType") == "Patient" and entry.get("id") == patient_id:
            return {"success": True, "data": entry, "all": entry, "fixed": entry, "dynamic": {}}
    raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found in file")


@router.get("/{source_id}/Patient/{patient_id}/resources/{resource_type}")
async def get_patient_resources(
    source_id: str,
    patient_id: str,
    resource_type: str,
    _count: int = Query(default=50),
    _getpagesoffset: int = Query(default=0),
):
    store = _get_source_or_404(source_id)
    resources = []
    for entry in store["entries"]:
        if entry.get("resourceType") != resource_type:
            continue
        for ref_key in ("subject", "patient", "beneficiary"):
            ref = entry.get(ref_key, {})
            if isinstance(ref, dict) and patient_id in ref.get("reference", ""):
                resources.append(entry)
                break

    total = len(resources)
    page_data = resources[_getpagesoffset : _getpagesoffset + _count]

    return {
        "success": True,
        "data": page_data,
        "resource_type": resource_type,
        "patient_id": patient_id,
        "count": len(page_data),
        "pagination": {
            "total": total,
            "count": len(page_data),
            "has_next": (_getpagesoffset + _count) < total,
            "has_prev": _getpagesoffset > 0,
            "page": (_getpagesoffset // _count) + 1,
            "per_page": _count,
        },
    }


@router.delete("/{source_id}")
async def delete_file_source(source_id: str):
    path = _source_path(source_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File source not found")
    os.remove(path)
    logger.info(f"Deleted file source: {source_id}")
    return {"success": True}
