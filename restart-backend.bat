@echo off
echo 🔄 Restarting FHIR Backend with New Configuration...

echo 📦 Installing dependencies...
cd fhir-backend-dynamic
pip install -r requirements.txt

echo 📋 Checking config file...
cd ..
if not exist "config.yaml" (
    echo ❌ ERROR: config.yaml not found in project root
    echo Please make sure config.yaml exists in C:\copy -fhir\config.yaml
    pause
    exit /b 1
)

echo ✅ Config file found
echo 🚀 Starting backend server...
cd fhir-backend-dynamic

echo Starting server at http://localhost:8000
echo Press Ctrl+C to stop the server
echo.
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --log-level info