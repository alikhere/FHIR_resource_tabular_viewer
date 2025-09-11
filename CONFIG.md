# Configuration Guide

This project uses a **unified configuration approach** with a single `config.yaml` file that controls both backend and frontend settings, as shown in the architecture diagram.

##  Configuration Files

### Primary Configuration
- **`config.yaml`** - Main configuration file (unified for entire project)
- **`.env`** - Environment-specific overrides (optional)

### Generated Configuration  
- **`fhir-backend-dynamic/app/config.py`** - Backend configuration loader
- **`src/config.js`** - Frontend configuration loader

##  Configuration Structure

### FHIR Server Settings
```yaml
fhir:
  base_url: "https://hapi.fhir.org/baseR4/"
  timeout_seconds: 30
  max_retries: 2
  supported_resources: [Patient, Observation, Condition, ...]
```

### Backend API Settings
```yaml
backend:
  host: "localhost"
  port: 8000
  cache:
    patient_cache_duration_minutes: 5
    config_cache_duration_hours: 1
    max_cache_entries: 100
  search:
    default_page_size: 50
    max_page_size: 1000
```

### Frontend Settings
```yaml
frontend:
  api_base_url: "http://localhost:8000"
  title: "FHIR Patient Search"
  ui:
    default_page_size: 50
    enable_export: true
    enable_filters: true
  cache:
    request_cache_ttl_minutes: 5
    max_cache_size: 100
```

### Feature Flags
```yaml
features:
  condition_code_search: true
  age_filtering: true
  gender_filtering: true
  patient_caching: true
  background_prefetch: true
```

##  Key Features from Architecture Diagram

### 1. Condition Code Search (J20N7001)
```yaml
search_parameters:
  condition_codes:
    - code: "J20N7001"
      description: "Example condition code from diagram"
```

### 2. Age & Gender Filtering
```yaml
search_parameters:
  age:
    min_age: 0
    max_age: 150
  gender:
    options: ["male", "female", "other", "unknown"]
```

### 3. Backend Status & Caching
```yaml
backend:
  cache:
    patient_cache_duration_minutes: 5  # Configurable cache duration
    background_prefetch: true           # Enable prefetching
```

##  Environment Overrides

You can override any configuration using environment variables:

### Backend Environment Variables
```bash
FHIR_BASE_URL=https://your-fhir-server.com/baseR4/
PORT=8080
PATIENT_CACHE_DURATION=10
CONFIG_CACHE_DURATION=2
MAX_CACHE_ENTRIES=200
```

### Frontend Environment Variables  
```bash
REACT_APP_API_BASE_URL=http://localhost:8080
REACT_APP_FHIR_BASE_URL=https://your-fhir-server.com/baseR4/
REACT_APP_TIMEOUT=45000
REACT_APP_DEBUG=true
```

##  Usage Examples

### Backend Configuration Loading
```python
from app.config import config

# Access configuration values
fhir_url = config.fhir_base_url
cache_duration = config.patient_cache_duration_minutes
features = config.features
```

### Frontend Configuration Loading
```javascript
import { CONFIG, isFeatureEnabled } from './config';

// Use configuration
const apiUrl = CONFIG.api.baseUrl;
const hasCaching = isFeatureEnabled('patientCaching');
```

### API Endpoints for Configuration
```bash
# Get backend status and configuration
GET /resources/config/status

# Clear backend cache
POST /resources/config/cache/clear
```

##  Configuration Management

### Validate Configuration
```bash
node scripts/config-helper.js status
```

### Show Feature Flags
```bash  
node scripts/config-helper.js features
```

### Generate Environment Template
```bash
node scripts/config-helper.js env
```

## Configuration Examples

### Development Environment
```yaml
environments:
  development:
    fhir:
      base_url: "https://hapi.fhir.org/baseR4/"
    backend:
      port: 8000
    features:
      condition_code_search: true
      age_filtering: true
```

### Production Environment
```yaml  
environments:
  production:
    fhir:
      base_url: "${FHIR_BASE_URL}"
    backend:
      port: "${PORT:-8000}"
    cache:
      patient_cache_duration_minutes: 10
      config_cache_duration_hours: 4
```

##  Configuration Status

The backend provides a status endpoint that shows:
- FHIR server connectivity
- Cache status and performance
- Enabled features
- Current configuration values

```bash
curl http://localhost:8000/resources/config/status
```

##  Performance Settings

```yaml
performance:
  request_timeout_seconds: 30
  connection_pool_size: 10
  max_concurrent_requests: 50
```

##  Security Notes

- Never commit sensitive values to `config.yaml`
- Use environment variables for production secrets
- The configuration loader validates settings on startup
- Feature flags allow safe deployment of new functionality

##  Adding New Configuration

1. Add the setting to `config.yaml`
2. Update `fhir-backend-dynamic/app/config.py` if needed
3. Update `src/config.js` for frontend access
4. Document the new setting in this file
5. Test with `node scripts/config-helper.js status`

This unified configuration approach ensures consistency between backend and frontend while providing flexibility for different deployment environments.