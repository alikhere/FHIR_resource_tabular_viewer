from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from typing import Optional
import json
import uuid
import logging
from datetime import datetime, timedelta, date

router = APIRouter(prefix="/sources/file", tags=["file-source"])
logger = logging.getLogger(__name__)

_file_store = {}
_store_expiry = {}
STORE_DURATION = timedelta(hours=2)


def _cleanup_expired():
    now = datetime.now()
    expired = [k for k, v in _store_expiry.items() if now > v]
    for k in expired:
        _file_store.pop(k, None)
        _store_expiry.pop(k, None)


def _calc_age(birth_date_str):
    if not birth_date_str:
        return None
    try:
        birth = date.fromisoformat(str(birth_date_str)[:10])
        today = date.today()
        age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
        return age if age >= 0 else None
    except Exception:
        return None


def _parse_entries(bundle):
    if bundle.get("resourceType") == "Bundle":
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

    entries = _parse_entries(bundle)
    entries = [e for e in entries if e]

    source_id = str(uuid.uuid4())
    _file_store[source_id] = {
        "entries": entries,
        "filename": file.filename,
        "uploaded_at": datetime.now().isoformat(),
    }
    _store_expiry[source_id] = datetime.now() + STORE_DURATION

    resource_counts = {}
    for entry in entries:
        rt = entry.get("resourceType", "Unknown")
        resource_counts[rt] = resource_counts.get(rt, 0) + 1

    logger.info(f"Uploaded file: {file.filename} — {len(entries)} resources, source_id={source_id}")

    return {
        "success": True,
        "source_id": source_id,
        "filename": file.filename,
        "total_resources": len(entries),
        "resource_counts": resource_counts,
    }


@router.get("/{source_id}/Patient")
async def get_patients(
    source_id: str,
    _count: int = Query(default=50),
    _getpagesoffset: int = Query(default=0),
    search: Optional[str] = Query(default=None),
):
    if source_id not in _file_store:
        raise HTTPException(status_code=404, detail="File source not found or expired")

    entries = _file_store[source_id]["entries"]
    patients = [e for e in entries if e.get("resourceType") == "Patient"]

    if search:
        q = search.lower()
        matched = []
        for p in patients:
            name_text = " ".join(
                " ".join(n.get("given", [])) + " " + n.get("family", "")
                for n in p.get("name", [])
            ).lower()
            if q in name_text or q in p.get("id", "").lower():
                matched.append(p)
        patients = matched

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
        "filename": _file_store[source_id]["filename"],
    }


@router.get("/{source_id}/Patient/{patient_id}")
async def get_patient(source_id: str, patient_id: str):
    if source_id not in _file_store:
        raise HTTPException(status_code=404, detail="File source not found or expired")

    for entry in _file_store[source_id]["entries"]:
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
    if source_id not in _file_store:
        raise HTTPException(status_code=404, detail="File source not found or expired")

    resources = []
    for entry in _file_store[source_id]["entries"]:
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
    if source_id not in _file_store:
        raise HTTPException(status_code=404, detail="File source not found")
    _file_store.pop(source_id, None)
    _store_expiry.pop(source_id, None)
    logger.info(f"Deleted file source: {source_id}")
    return {"success": True}
