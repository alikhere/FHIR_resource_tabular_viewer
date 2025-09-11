"""
Backend Startup Module
Handles server initialization, configuration validation, and health checks
As shown in the architecture diagram
"""

import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from app.config import config
from app.services import fhir
from app.services.http import get_json
from app.services.resource_discovery import resource_discovery

logger = logging.getLogger(__name__)

class BackendStartup:
    """Handles backend server startup and initialization"""
    
    def __init__(self):
        self.startup_time = None
        self.fhir_server_status = "unknown"
        self.config_validation_status = "unknown"
        self.startup_errors = []
        self.startup_warnings = []
    
    async def initialize(self) -> Dict[str, Any]:
        """
        Main startup initialization process
        Returns startup status and configuration
        """
        self.startup_time = datetime.now()
        logger.info("🚀 Starting FHIR Patient Search Backend...")
        
        startup_status = {
            "success": True,
            "startup_time": self.startup_time.isoformat(),
            "errors": [],
            "warnings": [],
            "config_status": "unknown",
            "fhir_server_status": "unknown",
            "cache_status": "initialized",
            "features_enabled": []
        }
        
        try:
            # Step 1: Validate configuration
            logger.info("📋 Validating configuration...")
            config_status = await self._validate_configuration()
            startup_status["config_status"] = config_status["status"]
            startup_status["warnings"].extend(config_status["warnings"])
            startup_status["errors"].extend(config_status["errors"])
            
            # Step 2: Test FHIR server connectivity
            logger.info("🔗 Testing FHIR server connectivity...")
            fhir_status = await self._test_fhir_connectivity()
            startup_status["fhir_server_status"] = fhir_status["status"]
            startup_status["fhir_server_details"] = fhir_status["details"]
            if fhir_status["status"] == "error":
                startup_status["warnings"].append(f"FHIR server connection failed: {fhir_status['details'].get('error', 'Unknown error')}")
            
            # Step 3: Initialize cache system
            logger.info("💾 Initializing cache system...")
            cache_status = await self._initialize_cache()
            startup_status["cache_status"] = cache_status["status"]
            
            # Step 4: Initialize resource discovery
            logger.info("🔍 Initializing resource discovery...")
            discovery_status = await self._initialize_resource_discovery()
            startup_status["resource_discovery"] = discovery_status
            startup_status["warnings"].extend(discovery_status.get("warnings", []))
            
            # Step 5: Validate enabled features
            logger.info("🎯 Validating enabled features...")
            features_status = await self._validate_features()
            startup_status["features_enabled"] = features_status["enabled_features"]
            startup_status["warnings"].extend(features_status["warnings"])
            
            # Step 6: Final startup checks
            logger.info("✅ Running final startup checks...")
            final_status = await self._final_startup_checks()
            startup_status["warnings"].extend(final_status["warnings"])
            
            # Determine overall success
            if startup_status["errors"]:
                startup_status["success"] = False
                logger.error(f"❌ Backend startup failed with {len(startup_status['errors'])} errors")
            else:
                logger.info(f"✅ Backend startup completed successfully with {len(startup_status['warnings'])} warnings")
            
            return startup_status
            
        except Exception as e:
            logger.error(f"💥 Critical startup error: {e}")
            startup_status["success"] = False
            startup_status["errors"].append(f"Critical startup error: {str(e)}")
            return startup_status
    
    async def _validate_configuration(self) -> Dict[str, Any]:
        """Validate configuration file and settings"""
        try:
            status = {
                "status": "valid",
                "warnings": [],
                "errors": []
            }
            
            # Check required configuration values
            if not config.fhir_base_url:
                status["errors"].append("FHIR base URL not configured")
            
            if not config.backend_port:
                status["errors"].append("Backend port not configured")
            
            # Check cache configuration
            if config.patient_cache_duration_minutes <= 0:
                status["warnings"].append("Patient cache duration is 0 or negative")
            
            if config.max_cache_entries <= 0:
                status["warnings"].append("Max cache entries is 0 or negative")
            
            # Check search configuration
            if config.default_page_size <= 0 or config.default_page_size > 1000:
                status["warnings"].append(f"Default page size ({config.default_page_size}) may be invalid")
            
            # Check supported resources
            if not config.supported_resources:
                status["warnings"].append("No supported resources configured")
            elif len(config.supported_resources) < 3:
                status["warnings"].append("Very few supported resources configured")
            
            # Set overall status
            if status["errors"]:
                status["status"] = "invalid"
            elif status["warnings"]:
                status["status"] = "valid_with_warnings"
            
            logger.info(f"Configuration validation: {status['status']}")
            return status
            
        except Exception as e:
            logger.error(f"Configuration validation failed: {e}")
            return {
                "status": "error",
                "warnings": [],
                "errors": [f"Configuration validation error: {str(e)}"]
            }
    
    async def _test_fhir_connectivity(self) -> Dict[str, Any]:
        """Test connection to FHIR server"""
        try:
            # Test basic connectivity
            base_url = fhir.base()
            logger.info(f"Testing FHIR server at: {base_url}")
            
            # Get server capabilities
            capabilities = await fhir.get_capabilities()
            
            if capabilities and isinstance(capabilities, dict):
                server_info = {
                    "fhir_version": capabilities.get("fhirVersion"),
                    "server_name": capabilities.get("software", {}).get("name"),
                    "server_version": capabilities.get("software", {}).get("version"),
                    "base_url": base_url,
                    "resource_types_count": len(fhir.list_resource_types(capabilities))
                }
                
                logger.info(f"✅ FHIR server connected: {server_info['server_name']} v{server_info['server_version']}")
                return {
                    "status": "connected",
                    "details": server_info
                }
            else:
                logger.warning("⚠️ FHIR server responded but with invalid capabilities")
                return {
                    "status": "degraded",
                    "details": {"error": "Invalid capabilities response", "base_url": base_url}
                }
                
        except Exception as e:
            logger.error(f"❌ FHIR server connection failed: {e}")
            return {
                "status": "error",
                "details": {"error": str(e), "base_url": config.fhir_base_url}
            }
    
    async def _initialize_cache(self) -> Dict[str, Any]:
        """Initialize cache system"""
        try:
            # Cache is initialized in the resources router
            # Here we just validate the configuration
            cache_config = {
                "patient_cache_duration_minutes": config.patient_cache_duration_minutes,
                "config_cache_duration_hours": config.config_cache_duration_hours,
                "max_cache_entries": config.max_cache_entries
            }
            
            logger.info(f"Cache system initialized: {cache_config}")
            return {
                "status": "initialized",
                "config": cache_config
            }
            
        except Exception as e:
            logger.error(f"Cache initialization failed: {e}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _initialize_resource_discovery(self) -> Dict[str, Any]:
        """Initialize resource discovery system"""
        try:
            mode = config.resource_discovery_mode
            logger.info(f"Resource discovery mode: {mode}")
            
            warnings = []
            
            # Initialize discovery based on mode
            if mode == "dynamic":
                logger.info("Discovering resources from FHIR server...")
                resources = await resource_discovery.get_supported_resources()
                logger.info(f"Discovered {len(resources)} resources dynamically")
                
            elif mode == "hybrid":
                logger.info("Using hybrid resource discovery (core + server-discovered)...")
                resources = await resource_discovery.get_supported_resources()
                logger.info(f"Hybrid discovery found {len(resources)} resources")
                
            elif mode == "static":
                logger.info("Using static resource configuration...")
                resources = config.core_resources + config.extended_resources
                logger.info(f"Static configuration: {len(resources)} resources")
                
            else:
                warnings.append(f"Unknown discovery mode '{mode}', falling back to static")
                resources = config.core_resources
            
            # Get categories
            categories = await resource_discovery.get_resource_categories()
            
            return {
                "status": "initialized",
                "mode": mode,
                "resources_count": len(resources),
                "categories_count": len(categories),
                "core_resources_count": len(config.core_resources),
                "extended_resources_count": len(config.extended_resources),
                "excluded_resources_count": len(config.excluded_resources),
                "warnings": warnings
            }
            
        except Exception as e:
            logger.error(f"Resource discovery initialization failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "warnings": [f"Resource discovery failed: {str(e)}"]
            }
    
    async def _validate_features(self) -> Dict[str, Any]:
        """Validate enabled features"""
        try:
            features = config.features
            enabled_features = [name for name, enabled in features.items() if enabled]
            warnings = []
            
            # Check feature dependencies
            if features.get("condition_code_search") and not features.get("age_filtering"):
                warnings.append("Condition code search is enabled but age filtering is disabled")
            
            if features.get("background_prefetch") and not features.get("patient_caching"):
                warnings.append("Background prefetch is enabled but patient caching is disabled")
            
            logger.info(f"Features validation: {len(enabled_features)} features enabled")
            return {
                "enabled_features": enabled_features,
                "warnings": warnings
            }
            
        except Exception as e:
            logger.error(f"Feature validation failed: {e}")
            return {
                "enabled_features": [],
                "warnings": [f"Feature validation error: {str(e)}"]
            }
    
    async def _final_startup_checks(self) -> Dict[str, Any]:
        """Final startup checks"""
        try:
            warnings = []
            
            # Check if we can perform a basic patient search
            try:
                base_url = fhir.base()
                url = base_url + "Patient"
                params = {"_count": "1"}
                
                # Simple timeout test
                result = await asyncio.wait_for(
                    fhir.fetch_bundle_with_deferred_handling(url, params),
                    timeout=10.0
                )
                
                if result:
                    logger.info("✅ Basic patient search test passed")
                else:
                    warnings.append("Basic patient search test returned no results")
                    
            except asyncio.TimeoutError:
                warnings.append("Basic patient search test timed out")
            except Exception as e:
                warnings.append(f"Basic patient search test failed: {str(e)}")
            
            return {"warnings": warnings}
            
        except Exception as e:
            logger.error(f"Final startup checks failed: {e}")
            return {"warnings": [f"Final checks error: {str(e)}"]}
    
    def get_startup_summary(self) -> Dict[str, Any]:
        """Get a summary of the startup status"""
        if not self.startup_time:
            return {"status": "not_started"}
        
        uptime_seconds = (datetime.now() - self.startup_time).total_seconds()
        
        return {
            "status": "running",
            "startup_time": self.startup_time.isoformat(),
            "uptime_seconds": uptime_seconds,
            "fhir_server_status": self.fhir_server_status,
            "config_validation_status": self.config_validation_status,
            "error_count": len(self.startup_errors),
            "warning_count": len(self.startup_warnings)
        }

# Global startup manager instance
startup_manager = BackendStartup()

async def initialize_backend() -> Dict[str, Any]:
    """Initialize the backend and return startup status"""
    return await startup_manager.initialize()

def get_startup_status() -> Dict[str, Any]:
    """Get current startup status"""
    return startup_manager.get_startup_summary()