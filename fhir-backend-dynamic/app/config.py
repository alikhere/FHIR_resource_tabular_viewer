"""
Unified configuration loader for FHIR Patient Search Application
Loads settings from config.yaml with environment variable overrides
"""

import os
import yaml
from typing import Dict, Any, Optional
from pathlib import Path

class Config:
    """Configuration class that loads from config.yaml and environment variables"""
    
    def __init__(self, config_path: Optional[str] = None):
        if config_path is None:
            # Look for config.yaml in parent directory (project root)
            config_path = Path(__file__).parent.parent.parent / "config.yaml"
        
        self._config = self._load_config(config_path)
        self._apply_environment_overrides()
    
    def _load_config(self, config_path: Path) -> Dict[str, Any]:
        """Load configuration from YAML file"""
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            print(f"Configuration loaded from: {config_path}")
            return config
        except FileNotFoundError:
            print(f"Config file not found: {config_path}, using defaults")
            return self._get_default_config()
        except yaml.YAMLError as e:
            print(f"Error parsing config file: {e}, using defaults")
            return self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Default configuration if config.yaml is not found"""
        return {
            "fhir": {
                "base_url": "https://hapi.fhir.org/baseR4/",
                "timeout_seconds": 30,
                "max_retries": 2
            },
            "backend": {
                "host": "localhost", 
                "port": 8000,
                "cache": {
                    "patient_cache_duration_minutes": 5,
                    "config_cache_duration_hours": 1,
                    "max_cache_entries": 100
                }
            },
            "features": {
                "condition_code_search": True,
                "age_filtering": True,
                "gender_filtering": True,
                "patient_caching": True
            }
        }
    
    def _apply_environment_overrides(self):
        """Apply environment variable overrides"""
        env_mappings = {
            "FHIR_BASE_URL": ("fhir", "base_url"),
            "PORT": ("backend", "port"),
            "PATIENT_CACHE_DURATION": ("backend", "cache", "patient_cache_duration_minutes"),
            "CONFIG_CACHE_DURATION": ("backend", "cache", "config_cache_duration_hours"),
            "MAX_CACHE_ENTRIES": ("backend", "cache", "max_cache_entries"),
        }
        
        for env_var, config_path in env_mappings.items():
            env_value = os.getenv(env_var)
            if env_value:
                self._set_nested_value(self._config, config_path, env_value)
    
    def _set_nested_value(self, config: Dict, path: tuple, value: str):
        """Set a nested configuration value"""
        current = config
        for key in path[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]
        
        # Convert to appropriate type
        if path[-1] in ["port", "timeout_seconds", "max_retries", "patient_cache_duration_minutes", 
                       "config_cache_duration_hours", "max_cache_entries"]:
            try:
                value = int(value)
            except ValueError:
                pass
        
        current[path[-1]] = value
    
    # Property accessors for easy usage
    
    @property
    def fhir_base_url(self) -> str:
        return self._config.get("fhir", {}).get("base_url", "https://hapi.fhir.org/baseR4/")
    
    @property
    def fhir_timeout(self) -> int:
        return self._config.get("fhir", {}).get("timeout_seconds", 30)
    
    @property
    def fhir_max_retries(self) -> int:
        return self._config.get("fhir", {}).get("max_retries", 2)
    
    @property
    def backend_host(self) -> str:
        return self._config.get("backend", {}).get("host", "localhost")
    
    @property
    def backend_port(self) -> int:
        return self._config.get("backend", {}).get("port", 8000)
    
    @property
    def cors_origins(self) -> list:
        return self._config.get("backend", {}).get("cors_origins", ["http://localhost:3000"])
    
    @property
    def patient_cache_duration_minutes(self) -> int:
        return self._config.get("backend", {}).get("cache", {}).get("patient_cache_duration_minutes", 5)
    
    @property
    def config_cache_duration_hours(self) -> int:
        return self._config.get("backend", {}).get("cache", {}).get("config_cache_duration_hours", 1)
    
    @property
    def max_cache_entries(self) -> int:
        return self._config.get("backend", {}).get("cache", {}).get("max_cache_entries", 100)
    
    @property
    def default_page_size(self) -> int:
        return self._config.get("backend", {}).get("search", {}).get("default_page_size", 50)
    
    @property
    def max_page_size(self) -> int:
        return self._config.get("backend", {}).get("search", {}).get("max_page_size", 1000)
    
    @property
    def features(self) -> Dict[str, bool]:
        return self._config.get("features", {
            "condition_code_search": True,
            "age_filtering": True,
            "gender_filtering": True,
            "patient_caching": True,
            "background_prefetch": True
        })
    
    # Aggregate Configuration Properties
    @property
    def aggregate_enabled(self) -> bool:
        return self._config.get("backend", {}).get("aggregate", {}).get("enabled", False)
    
    @property
    def aggregate_max_records(self) -> int:
        return self._config.get("backend", {}).get("aggregate", {}).get("max_records", 200000)
    
    @property
    def aggregate_page_count_hint(self) -> int:
        return self._config.get("backend", {}).get("aggregate", {}).get("page_count_hint", 100)
    
    @property
    def aggregate_max_build_time_seconds(self) -> int:
        return self._config.get("backend", {}).get("aggregate", {}).get("max_build_time_seconds", 300)
    
    @property
    def aggregate_progress_enabled(self) -> bool:
        return self._config.get("backend", {}).get("aggregate", {}).get("progress_enabled", True)
    
    @property
    def aggregate_max_memory_mb(self) -> int:
        return self._config.get("backend", {}).get("aggregate", {}).get("max_memory_mb", 512)
    
    # Cache Backend Configuration
    @property
    def cache_backend(self) -> str:
        return self._config.get("cache", {}).get("backend", "memory")
    
    @property
    def cache_ttl_seconds(self) -> int:
        return self._config.get("cache", {}).get("ttl_seconds", 1800)
    
    @property
    def cache_max_datasets_per_user(self) -> int:
        return self._config.get("cache", {}).get("max_datasets_per_user", 10)
    
    @property
    def cache_redis_url(self) -> str:
        return self._config.get("cache", {}).get("redis_url", "redis://localhost:6379")
    
    # HTTP Configuration
    @property
    def http_fetch_concurrency(self) -> int:
        return self._config.get("http", {}).get("fetch_concurrency", 3)
    
    @property
    def http_bundle_timeout_seconds(self) -> int:
        return self._config.get("http", {}).get("bundle_timeout_seconds", 30)
    
    @property
    def http_max_retries(self) -> int:
        return self._config.get("http", {}).get("max_retries", 2)
    
    @property
    def environment(self) -> str:
        return self._config.get("environment", "dev")
    
    @property
    def resource_discovery_mode(self) -> str:
        return self._config.get("fhir", {}).get("resource_discovery", {}).get("mode", "dynamic")
    
    @property
    def resource_cache_duration_hours(self) -> int:
        return self._config.get("fhir", {}).get("resource_discovery", {}).get("cache_duration_hours", 24)
    
    @property
    def core_resources(self) -> list:
        return self._config.get("fhir", {}).get("core_resources", [
            "Patient", "Observation", "Condition", "Procedure", "MedicationRequest",
            "Encounter", "DiagnosticReport", "DocumentReference", "AllergyIntolerance", "Immunization"
        ])
    
    @property
    def extended_resources(self) -> list:
        return self._config.get("fhir", {}).get("extended_resources", [])
    
    @property
    def excluded_resources(self) -> list:
        return self._config.get("fhir", {}).get("excluded_resources", [])
    
    @property
    def resource_categories(self) -> dict:
        return self._config.get("fhir", {}).get("resource_categories", {})
    
    @property
    def supported_resources(self) -> list:
        """Get supported resources based on discovery mode"""
        if self.resource_discovery_mode == "static":
            return self.core_resources + self.extended_resources
        else:
            # For dynamic and hybrid modes, this will be populated at runtime
            return self.core_resources
    
    @property
    def filter_definitions(self) -> list:
        """Get filter definitions from config.yaml
        
        Fails gracefully if the section is missing; defaults to empty list.
        Each filter definition should contain:
        - resource: FHIR resource type
        - element: UI element name 
        - path: JSON path to extract value
        - display_path: Path for display text
        - endpoint: FHIR endpoint
        - search_parameter: FHIR search parameter
        - description: Human readable description
        """
        try:
            filter_defs = self._config.get("filter_definitions", [])
            if not isinstance(filter_defs, list):
                print("Warning: filter_definitions in config.yaml is not a list, defaulting to empty list")
                return []
            return filter_defs
        except Exception as e:
            print(f"Warning: Error loading filter_definitions: {e}, defaulting to empty list")
            return []
    
    @property
    def filter_ui(self) -> dict:
        """Get filter UI organization configuration from config.yaml
        
        Defines how filters are organized in the frontend sidebar.
        Auto-discovers resources from filter_definitions when "auto" is specified.
        Fails gracefully if missing, returning default structure.
        """
        try:
            filter_ui_config = self._config.get("filter_ui", {})
            if not isinstance(filter_ui_config, dict):
                print("Warning: filter_ui in config.yaml is not a dict, using default structure")
                return self._get_default_filter_ui()
            
            # Process auto-discovery for sections
            processed_config = {"sections": []}
            for section in filter_ui_config.get("sections", []):
                processed_section = dict(section)
                
                # Handle auto resource discovery
                if processed_section.get("resources") == "auto":
                    # Get all resource types from filter_definitions
                    available_resources = list(set(
                        filter_def.get("resource") 
                        for filter_def in self.filter_definitions 
                        if filter_def.get("resource")
                    ))
                    
                    # Apply exclusions
                    exclude_resources = processed_section.get("exclude_resources", [])
                    auto_resources = [r for r in available_resources if r not in exclude_resources]
                    
                    processed_section["resources"] = sorted(auto_resources)
                    print(f"Auto-discovered resources for {section['id']}: {auto_resources}")
                
                processed_config["sections"].append(processed_section)
            
            return processed_config
            
        except Exception as e:
            print(f"Warning: Error loading filter_ui: {e}, using default structure")
            return self._get_default_filter_ui()
    
    def _get_default_filter_ui(self) -> dict:
        """Default filter UI structure if not configured"""
        return {
            "sections": [
                {
                    "id": "patient_filters",
                    "label": "Patient Filters",
                    "description": "Filter and search for patients",
                    "resources": ["Patient"],
                    "icon": "👤",
                    "expanded_by_default": True
                },
                {
                    "id": "medical_resource_filters", 
                    "label": "Medical Resource Filters",
                    "description": "Filter medical data and clinical resources",
                    "resources": ["Observation", "Condition", "Procedure", "DiagnosticReport", "DocumentReference", "AllergyIntolerance"],
                    "icon": "🏥",
                    "expanded_by_default": True
                }
            ]
        }
    
    def get(self, key: str, default=None):
        """Get configuration value by key"""
        return self._config.get(key, default)
    
    def get_nested(self, *keys, default=None):
        """Get nested configuration value"""
        current = self._config
        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                return default
        return current

# Global configuration instance
config = Config()

# Global filter definitions - can be imported by any module
# This is the single source of truth for all filterable elements
FILTER_DEFINITIONS = config.filter_definitions

# Convenience functions for backward compatibility
def get_fhir_base_url() -> str:
    return config.fhir_base_url

def get_backend_port() -> int:
    return config.backend_port

def get_features() -> Dict[str, bool]:
    return config.features

def get_filter_definitions() -> list:
    """Get filter definitions from config.yaml"""
    return config.filter_definitions

def get_filter_ui() -> dict:
    """Get filter UI configuration from config.yaml"""
    return config.filter_ui

def get_config() -> dict:
    """Get the full configuration dictionary"""
    return config._config