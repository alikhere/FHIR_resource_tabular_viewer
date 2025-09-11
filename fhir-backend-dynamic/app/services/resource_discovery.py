"""
Dynamic Resource Discovery Service
Discovers available FHIR resources from server capabilities
"""

import logging
from typing import Dict, List, Set, Optional
from datetime import datetime, timedelta

from app.config import config
from app.services import fhir

logger = logging.getLogger(__name__)

class ResourceDiscoveryService:
    """Manages dynamic discovery of FHIR resources"""
    
    def __init__(self):
        self._discovered_resources: List[str] = []
        self._last_discovery: Optional[datetime] = None
        self._discovery_cache_duration = timedelta(hours=config.resource_cache_duration_hours)
        
    async def get_supported_resources(self, force_refresh: bool = False) -> List[str]:
        """
        Get list of supported resources based on discovery mode
        """
        mode = config.resource_discovery_mode
        
        if mode == "static":
            return self._get_static_resources()
        elif mode == "dynamic":
            return await self._get_dynamic_resources(force_refresh)
        elif mode == "hybrid":
            return await self._get_hybrid_resources(force_refresh)
        else:
            logger.warning(f"Unknown resource discovery mode: {mode}, falling back to static")
            return self._get_static_resources()
    
    def _get_static_resources(self) -> List[str]:
        """Return statically configured resources"""
        return config.core_resources + config.extended_resources
    
    async def _get_dynamic_resources(self, force_refresh: bool = False) -> List[str]:
        """Discover resources dynamically from FHIR server"""
        
        # Check if we need to refresh
        if not force_refresh and self._is_cache_valid():
            logger.info("Using cached resource discovery")
            return self._discovered_resources
        
        try:
            logger.info("Discovering resources from FHIR server...")
            
            # Get server capabilities
            capabilities = await fhir.get_capabilities()
            if not capabilities:
                logger.warning("Could not get server capabilities, falling back to core resources")
                return config.core_resources
            
            # Extract all available resource types
            all_server_resources = set(fhir.list_resource_types(capabilities))
            logger.info(f"Server supports {len(all_server_resources)} resource types")
            
            # Filter based on configuration
            supported_resources = self._filter_resources(all_server_resources)
            
            # Cache the results
            self._discovered_resources = list(supported_resources)
            self._last_discovery = datetime.now()
            
            logger.info(f"Discovered {len(self._discovered_resources)} supported resources")
            return self._discovered_resources
            
        except Exception as e:
            logger.error(f"Resource discovery failed: {e}")
            if self._discovered_resources:
                logger.info("Using previously discovered resources")
                return self._discovered_resources
            else:
                logger.info("Falling back to core resources")
                return config.core_resources
    
    async def _get_hybrid_resources(self, force_refresh: bool = False) -> List[str]:
        """Combine static core resources with dynamically discovered extended resources"""
        
        # Always include core resources
        core_resources = set(config.core_resources)
        
        # Try to discover additional resources
        try:
            if not force_refresh and self._is_cache_valid():
                discovered = set(self._discovered_resources)
            else:
                logger.info("Discovering additional resources from FHIR server...")
                capabilities = await fhir.get_capabilities()
                
                if capabilities:
                    all_server_resources = set(fhir.list_resource_types(capabilities))
                    
                    # Only consider extended resources that the server supports
                    extended_candidates = set(config.extended_resources) & all_server_resources
                    discovered = core_resources | extended_candidates
                    
                    # Apply exclusion filter
                    discovered = discovered - set(config.excluded_resources)
                    
                    # Cache the results
                    self._discovered_resources = list(discovered)
                    self._last_discovery = datetime.now()
                else:
                    discovered = core_resources
            
            logger.info(f"Hybrid mode: {len(discovered)} resources available")
            return list(discovered)
            
        except Exception as e:
            logger.error(f"Hybrid resource discovery failed: {e}")
            return list(core_resources)
    
    def _filter_resources(self, server_resources: Set[str]) -> Set[str]:
        """Filter resources based on configuration"""
        
        # Start with server resources
        filtered = set(server_resources)
        
        # Remove excluded resources
        filtered = filtered - set(config.excluded_resources)
        
        # If we have specific core + extended resources defined, use those as a filter
        if config.core_resources or config.extended_resources:
            allowed = set(config.core_resources) | set(config.extended_resources)
            filtered = filtered & allowed
        
        return filtered
    
    def _is_cache_valid(self) -> bool:
        """Check if the discovery cache is still valid"""
        if not self._last_discovery or not self._discovered_resources:
            return False
        
        age = datetime.now() - self._last_discovery
        return age < self._discovery_cache_duration
    
    async def get_resource_categories(self) -> Dict[str, List[str]]:
        """Get resources organized by categories"""
        
        supported = await self.get_supported_resources()
        categories = config.resource_categories.copy()
        
        # Add uncategorized resources
        categorized = set()
        for resources in categories.values():
            categorized.update(resources)
        
        uncategorized = set(supported) - categorized
        if uncategorized:
            categories["other"] = list(uncategorized)
        
        # Filter categories to only include supported resources
        filtered_categories = {}
        for category, resources in categories.items():
            available_resources = [r for r in resources if r in supported]
            if available_resources:
                filtered_categories[category] = available_resources
        
        return filtered_categories
    
    async def get_discovery_status(self) -> Dict:
        """Get status information about resource discovery"""
        
        supported_resources = await self.get_supported_resources()
        
        return {
            "mode": config.resource_discovery_mode,
            "last_discovery": self._last_discovery.isoformat() if self._last_discovery else None,
            "cache_valid": self._is_cache_valid(),
            "cache_duration_hours": config.resource_cache_duration_hours,
            "total_resources": len(supported_resources),
            "core_resources_count": len(config.core_resources),
            "extended_resources_count": len(config.extended_resources),
            "excluded_resources_count": len(config.excluded_resources),
            "resources": supported_resources
        }
    
    async def refresh_discovery(self) -> Dict:
        """Force refresh resource discovery"""
        logger.info("Force refreshing resource discovery...")
        
        try:
            resources = await self.get_supported_resources(force_refresh=True)
            return {
                "success": True,
                "message": f"Discovery refreshed, found {len(resources)} resources",
                "resources": resources,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to refresh discovery: {e}")
            return {
                "success": False,
                "message": str(e),
                "timestamp": datetime.now().isoformat()
            }

# Global resource discovery service
resource_discovery = ResourceDiscoveryService()