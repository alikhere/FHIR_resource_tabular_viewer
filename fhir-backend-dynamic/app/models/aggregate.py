"""
Pydantic models for aggregate API endpoints
"""

from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field

class AggregateRequest(BaseModel):
    """Request model for creating aggregate dataset"""
    filters: Dict[str, Any] = Field(default_factory=dict, description="Search filter parameters")
    search_params: Dict[str, Any] = Field(default_factory=dict, description="Additional FHIR search parameters")
    user_session: str = Field(..., description="User session identifier for cache namespacing")

class AggregateResponse(BaseModel):
    """Response model for aggregate dataset creation"""
    dataset_id: str = Field(..., description="Unique identifier for the created dataset")
    total: int = Field(..., description="Total number of resources in dataset")
    truncated: bool = Field(default=False, description="Whether dataset was truncated due to size limits")
    build_time_ms: int = Field(..., description="Time taken to build dataset in milliseconds")
    cache_hit: bool = Field(default=False, description="Whether response was served from cache")

class SliceRequest(BaseModel):
    """Request model for getting dataset slice"""
    offset: int = Field(default=0, ge=0, description="Starting offset for pagination slice")
    limit: int = Field(default=50, ge=1, le=1000, description="Number of items to return")

class SliceResponse(BaseModel):
    """Response model for dataset slice"""
    dataset_id: str = Field(..., description="Dataset identifier")
    total: int = Field(..., description="Total number of resources in full dataset")
    offset: int = Field(..., description="Starting offset of this slice")
    limit: int = Field(..., description="Requested limit for this slice")
    items: List[Dict[str, Any]] = Field(..., description="Resource items in this slice")
    has_next: bool = Field(..., description="Whether there are more items after this slice")
    has_prev: bool = Field(..., description="Whether there are items before this slice")
    truncated: bool = Field(default=False, description="Whether original dataset was truncated")

class ProgressResponse(BaseModel):
    """Response model for dataset build progress"""
    dataset_id: str = Field(..., description="Dataset identifier")
    resource_type: str = Field(..., description="Type of FHIR resource being aggregated")
    status: str = Field(..., description="Current status: building, ready, error, truncated")
    fetched: int = Field(..., description="Number of resources fetched so far")
    estimated_total: int = Field(..., description="Estimated total resources (if known)")
    progress_percent: int = Field(..., description="Completion percentage (0-100)")
    build_time_ms: int = Field(..., description="Elapsed build time in milliseconds")
    started_at: str = Field(..., description="ISO timestamp when build started")
    completed_at: Optional[str] = Field(None, description="ISO timestamp when build completed")
    error_message: Optional[str] = Field(None, description="Error message if status is error")
    truncated: bool = Field(default=False, description="Whether dataset was truncated")

class ErrorResponse(BaseModel):
    """Error response model"""
    success: bool = Field(default=False)
    message: str = Field(..., description="Error message")
    dataset_id: Optional[str] = Field(None, description="Dataset ID if applicable")
    error_code: Optional[str] = Field(None, description="Machine-readable error code")

class DeleteResponse(BaseModel):
    """Response model for dataset deletion"""
    success: bool = Field(..., description="Whether deletion was successful")
    dataset_id: str = Field(..., description="Dataset identifier")
    message: str = Field(..., description="Result message")