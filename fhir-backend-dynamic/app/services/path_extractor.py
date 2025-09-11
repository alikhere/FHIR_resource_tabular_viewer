"""
Generic FHIR JSON Path Extractor
Safely walks nested FHIR JSON using dot+bracket notation from config
No resource-specific logic - works universally across all FHIR resources
"""

from typing import List, Dict, Any, Optional, Union
import logging
import re

logger = logging.getLogger(__name__)


def extract_values_by_path(resources: List[Dict[str, Any]], path: str) -> List[str]:
    """
    Extract values from FHIR resources using JSON path notation
    
    Args:
        resources: List of FHIR resource dictionaries
        path: Dot+bracket notation path (e.g., "code.coding[0].code", "author[0].display")
    
    Returns:
        List of string values found at the specified path across all resources
        
    Features:
        - Tolerates missing fields/indices gracefully
        - Skips invalid nodes without crashing
        - Returns empty list if no values found
        - Converts all values to strings for consistency
        - No resource-specific branching or field name checking
    
    Examples:
        extract_values_by_path(observations, "code.coding[0].code")
        extract_values_by_path(documents, "author[0].display") 
        extract_values_by_path(conditions, "clinicalStatus.coding[0].display")
    """
    if not resources or not path:
        return []
    
    values = []
    
    for resource in resources:
        if not isinstance(resource, dict):
            continue
            
        try:
            value = extract_single_value_by_path(resource, path)
            if value is not None:
                # Convert to string and add to results
                str_value = str(value).strip()
                if str_value:  # Only add non-empty strings
                    values.append(str_value)
        except Exception as e:
            # Log debug info but continue processing other resources
            logger.debug(f"Error extracting path '{path}' from resource: {str(e)}")
            continue
    
    return values


def extract_single_value_by_path(resource: Dict[str, Any], path: str) -> Optional[Any]:
    """
    Extract a single value from one FHIR resource using path notation
    
    Args:
        resource: Single FHIR resource dictionary
        path: JSON path like "code.coding[0].code" or "valueQuantity.unit"
    
    Returns:
        The value at the path, or None if not found
        
    Path Syntax Support:
        - Simple fields: "status", "gender"
        - Nested objects: "code.text", "name.family"  
        - Array access: "coding[0]", "name[0].given[0]"
        - Complex paths: "author[0].practitionerRole.specialty[0].coding[0].display"
        - Mixed syntax: "category[0].coding[0].code"
    """
    if not resource or not path:
        return None
    
    try:
        # Parse path into segments
        segments = parse_path_segments(path)
        
        # Walk through the resource following the path
        current = resource
        
        for segment in segments:
            if current is None:
                return None
                
            if segment['type'] == 'field':
                # Simple field access
                if isinstance(current, dict):
                    current = current.get(segment['name'])
                else:
                    return None
                    
            elif segment['type'] == 'array':
                # Array field with index access
                if isinstance(current, dict):
                    current = current.get(segment['name'])
                    if isinstance(current, list) and len(current) > segment['index']:
                        current = current[segment['index']]
                    else:
                        return None
                else:
                    return None
        
        return current
        
    except Exception as e:
        logger.debug(f"Error parsing path '{path}': {str(e)}")
        return None


def parse_path_segments(path: str) -> List[Dict[str, Union[str, int]]]:
    """
    Parse a JSON path string into structured segments
    
    Args:
        path: Path string like "code.coding[0].display"
    
    Returns:
        List of segment dictionaries with type, name, and optional index
        
    Examples:
        "code.text" → [{"type": "field", "name": "code"}, {"type": "field", "name": "text"}]
        "coding[0].code" → [{"type": "array", "name": "coding", "index": 0}, {"type": "field", "name": "code"}]
    """
    if not path:
        return []
    
    segments = []
    
    # Split by dots, but handle array brackets carefully
    parts = path.split('.')
    
    for part in parts:
        if not part:
            continue
            
        # Check if this part has array notation
        array_match = re.match(r'^([a-zA-Z_]\w*)\[(\d+)\]$', part)
        
        if array_match:
            # Array access like "coding[0]"
            field_name = array_match.group(1)
            index = int(array_match.group(2))
            segments.append({
                'type': 'array',
                'name': field_name,
                'index': index
            })
        else:
            # Simple field access
            # Remove any invalid characters for safety
            clean_name = re.sub(r'[^a-zA-Z0-9_]', '', part)
            if clean_name:
                segments.append({
                    'type': 'field',
                    'name': clean_name
                })
    
    return segments


def extract_multiple_paths(resources: List[Dict[str, Any]], paths: Dict[str, str]) -> Dict[str, List[str]]:
    """
    Extract values for multiple paths from resources efficiently
    
    Args:
        resources: List of FHIR resource dictionaries
        paths: Dictionary mapping result keys to path strings
               e.g., {"code": "code.coding[0].code", "display": "code.coding[0].display"}
    
    Returns:
        Dictionary mapping result keys to lists of extracted values
        
    Example:
        paths = {
            "code": "code.coding[0].code",
            "display": "code.coding[0].display", 
            "status": "status"
        }
        result = extract_multiple_paths(resources, paths)
        # result = {"code": ["123", "456"], "display": ["Test A", "Test B"], "status": ["final", "final"]}
    """
    if not resources or not paths:
        return {}
    
    results = {}
    
    for key, path in paths.items():
        try:
            values = extract_values_by_path(resources, path)
            results[key] = values
        except Exception as e:
            logger.warning(f"Error extracting path '{path}' for key '{key}': {str(e)}")
            results[key] = []
    
    return results


def validate_path_syntax(path: str) -> bool:
    """
    Validate if a path string has correct syntax
    
    Args:
        path: Path string to validate
    
    Returns:
        True if syntax is valid, False otherwise
        
    Valid Examples:
        - "status"
        - "code.text"  
        - "coding[0].code"
        - "author[0].display"
        - "category[0].coding[0].display"
    
    Invalid Examples:
        - "coding[]" (missing index)
        - "coding[abc]" (non-numeric index)
        - ".field" (leading dot)
        - "field." (trailing dot)
        - "field..subfield" (double dot)
    """
    if not path or not isinstance(path, str):
        return False
    
    # Basic checks
    if path.startswith('.') or path.endswith('.') or '..' in path:
        return False
    
    try:
        segments = parse_path_segments(path)
        
        # Must have at least one segment
        if not segments:
            return False
        
        # All segments must have valid names
        for segment in segments:
            if not segment.get('name') or not re.match(r'^[a-zA-Z_]\w*$', segment['name']):
                return False
            
            # Array segments must have valid indices
            if segment['type'] == 'array':
                if 'index' not in segment or not isinstance(segment['index'], int) or segment['index'] < 0:
                    return False
        
        return True
        
    except Exception:
        return False


def get_available_paths(resources: List[Dict[str, Any]], max_depth: int = 3) -> List[str]:
    """
    Discover available paths in FHIR resources (for debugging/development)
    
    Args:
        resources: List of FHIR resource dictionaries
        max_depth: Maximum depth to traverse
    
    Returns:
        List of discovered paths
        
    Note: This is a utility function for development/debugging.
    Production code should use predefined paths from config.
    """
    if not resources:
        return []
    
    paths = set()
    
    for resource in resources[:5]:  # Sample first 5 resources
        if isinstance(resource, dict):
            discovered = _discover_paths_recursive(resource, "", max_depth)
            paths.update(discovered)
    
    return sorted(list(paths))


def _discover_paths_recursive(obj: Any, current_path: str, max_depth: int) -> List[str]:
    """
    Recursively discover paths in a nested object
    """
    if max_depth <= 0:
        return []
    
    paths = []
    
    if isinstance(obj, dict):
        for key, value in obj.items():
            # Skip certain FHIR system fields
            if key in ['resourceType', 'id', 'meta', 'text']:
                continue
                
            new_path = f"{current_path}.{key}" if current_path else key
            
            if isinstance(value, (str, int, float, bool)):
                paths.append(new_path)
            elif isinstance(value, list) and value:
                # Handle arrays
                if isinstance(value[0], (str, int, float, bool)):
                    paths.append(f"{new_path}[0]")
                elif isinstance(value[0], dict):
                    sub_paths = _discover_paths_recursive(value[0], f"{new_path}[0]", max_depth - 1)
                    paths.extend(sub_paths)
            elif isinstance(value, dict):
                sub_paths = _discover_paths_recursive(value, new_path, max_depth - 1)
                paths.extend(sub_paths)
    
    return paths