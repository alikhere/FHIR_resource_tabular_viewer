"""
Data Availability Service
Checks which FHIR resources actually contain data on the server
"""

import logging
import asyncio
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta

from app.services import fhir
from app.services.resource_discovery import resource_discovery
from app.config import config

logger = logging.getLogger(__name__)

class DataAvailabilityService:
    """Checks which resources actually contain data"""
    
    def __init__(self):
        self._data_counts: Dict[str, int] = {}
        self._last_check: Optional[datetime] = None
        self._check_cache_duration = timedelta(hours=2)  # Cache for 2 hours
        
    async def check_resource_data_availability(self, resources: List[str] = None, sample_size: int = 1) -> Dict[str, Dict]:
        """
        Check which resources actually have data
        Returns count information for each resource
        """
        if resources is None:
            resources = await resource_discovery.get_supported_resources()
        
        logger.info(f"Checking data availability for {len(resources)} resources...")
        
        # Check cache validity
        if not self._is_cache_valid():
            await self._refresh_data_counts(resources, sample_size)
        
        result = {}
        base_url = fhir.base()
        
        for resource_type in resources:
            cached_count = self._data_counts.get(resource_type, 0)
            result[resource_type] = {
                "has_data": cached_count > 0,
                "total_count": cached_count,
                "last_checked": self._last_check.isoformat() if self._last_check else None,
                "sample_url": f"{base_url}{resource_type}?_count={sample_size}" if cached_count > 0 else None
            }
        
        return result
    
    async def _refresh_data_counts(self, resources: List[str], sample_size: int = 1):
        """Refresh data counts for all resources"""
        logger.info("Refreshing data availability counts...")
        
        # Process resources in batches to avoid overwhelming the server
        batch_size = 5
        semaphore = asyncio.Semaphore(batch_size)
        
        async def check_single_resource(resource_type: str) -> Tuple[str, int]:
            async with semaphore:
                return await self._get_resource_count(resource_type, sample_size)
        
        # Create tasks for all resources
        tasks = [check_single_resource(resource) for resource in resources]
        
        # Execute with timeout
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=60.0  # 60 second timeout
            )
            
            # Process results
            self._data_counts = {}
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.warning(f"Failed to check {resources[i]}: {result}")
                    self._data_counts[resources[i]] = 0
                else:
                    resource_type, count = result
                    self._data_counts[resource_type] = count
            
            self._last_check = datetime.now()
            logger.info(f"Data availability check completed. Found data in {sum(1 for c in self._data_counts.values() if c > 0)} resources")
            
        except asyncio.TimeoutError:
            logger.warning("Data availability check timed out")
            # Keep existing counts if available
            if not self._data_counts:
                self._data_counts = {resource: 0 for resource in resources}
    
    async def _get_resource_count(self, resource_type: str, sample_size: int = 1) -> Tuple[str, int]:
        """Get count of resources for a specific resource type"""
        try:
            base_url = fhir.base()
            url = f"{base_url}{resource_type}"
            
            # First try to get total count without fetching all data
            params = {"_summary": "count", "_count": "0"}
            bundle = await fhir.fetch_bundle_with_deferred_handling(url, params)
            
            if isinstance(bundle, dict) and "total" in bundle:
                total = bundle.get("total", 0)
                logger.debug(f"{resource_type}: {total} resources")
                return resource_type, total
            else:
                # Fallback: try a small sample request
                params = {"_count": str(sample_size)}
                bundle = await fhir.fetch_bundle_with_deferred_handling(url, params)
                
                if isinstance(bundle, dict):
                    entries = bundle.get("entry", [])
                    total = bundle.get("total", len(entries))
                    logger.debug(f"{resource_type}: {total} resources (fallback)")
                    return resource_type, total
                else:
                    return resource_type, 0
                    
        except Exception as e:
            logger.debug(f"Error checking {resource_type}: {e}")
            return resource_type, 0
    
    def _is_cache_valid(self) -> bool:
        """Check if cached data is still valid"""
        if not self._last_check or not self._data_counts:
            return False
        
        age = datetime.now() - self._last_check
        return age < self._check_cache_duration
    
    async def get_resources_with_data(self, min_count: int = 1) -> List[Dict]:
        """Get only resources that actually have data"""
        availability = await self.check_resource_data_availability()
        
        resources_with_data = []
        for resource_type, info in availability.items():
            if info["total_count"] >= min_count:
                resources_with_data.append({
                    "resource_type": resource_type,
                    "total_count": info["total_count"],
                    "sample_url": info["sample_url"]
                })
        
        # Sort by count (descending)
        resources_with_data.sort(key=lambda x: x["total_count"], reverse=True)
        
        return resources_with_data
    
    async def get_top_resources_by_data(self, limit: int = 10) -> List[Dict]:
        """Get top resources by data count"""
        resources_with_data = await self.get_resources_with_data()
        return resources_with_data[:limit]
    
    async def get_availability_summary(self) -> Dict:
        """Get summary of data availability"""
        availability = await self.check_resource_data_availability()
        
        total_resources = len(availability)
        resources_with_data = sum(1 for info in availability.values() if info["has_data"])
        resources_empty = total_resources - resources_with_data
        
        total_records = sum(info["total_count"] for info in availability.values())
        
        # Get top resources
        top_resources = await self.get_top_resources_by_data(5)
        
        return {
            "total_resources_checked": total_resources,
            "resources_with_data": resources_with_data,
            "resources_empty": resources_empty,
            "total_records_across_all": total_records,
            "last_checked": self._last_check.isoformat() if self._last_check else None,
            "top_resources": top_resources,
            "cache_valid_until": (self._last_check + self._check_cache_duration).isoformat() if self._last_check else None
        }
    
    async def force_refresh(self) -> Dict:
        """Force refresh data availability check"""
        logger.info("Force refreshing data availability...")
        
        try:
            resources = await resource_discovery.get_supported_resources()
            await self._refresh_data_counts(resources)
            
            summary = await self.get_availability_summary()
            
            return {
                "success": True,
                "message": f"Data availability refreshed for {len(resources)} resources",
                "summary": summary,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to refresh data availability: {e}")
            return {
                "success": False,
                "message": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def check_specific_resources(self, resource_types: List[str]) -> Dict[str, Dict]:
        """Check data availability for specific resource types"""
        logger.info(f"Checking specific resources: {resource_types}")
        
        result = {}
        for resource_type in resource_types:
            try:
                count = await self._get_resource_count(resource_type)
                result[resource_type] = {
                    "has_data": count[1] > 0,
                    "total_count": count[1],
                    "checked_at": datetime.now().isoformat(),
                    "sample_url": f"{fhir.base()}{resource_type}?_count=5" if count[1] > 0 else None
                }
            except Exception as e:
                logger.error(f"Error checking {resource_type}: {e}")
                result[resource_type] = {
                    "has_data": False,
                    "total_count": 0,
                    "error": str(e),
                    "checked_at": datetime.now().isoformat()
                }
        
        return result

# Global data availability service
data_availability = DataAvailabilityService()