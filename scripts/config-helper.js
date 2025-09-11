#!/usr/bin/env node
/**
 * Configuration Helper Script
 * Helps validate and manage the unified config.yaml file
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const CONFIG_PATH = path.join(__dirname, '..', 'config.yaml');

function loadConfig() {
  try {
    const fileContents = fs.readFileSync(CONFIG_PATH, 'utf8');
    return yaml.load(fileContents);
  } catch (e) {
    console.error('Error loading config.yaml:', e.message);
    return null;
  }
}

function validateConfig(config) {
  const errors = [];
  const warnings = [];

  // Validate required sections
  if (!config.fhir) errors.push('Missing fhir section');
  if (!config.backend) errors.push('Missing backend section');
  if (!config.frontend) errors.push('Missing frontend section');
  if (!config.features) errors.push('Missing features section');

  // Validate FHIR section
  if (config.fhir) {
    if (!config.fhir.base_url) errors.push('Missing fhir.base_url');
    if (!Array.isArray(config.fhir.supported_resources)) warnings.push('fhir.supported_resources should be an array');
  }

  // Validate backend section
  if (config.backend) {
    if (!config.backend.host) warnings.push('Missing backend.host');
    if (!config.backend.port) warnings.push('Missing backend.port');
    if (!config.backend.cache) warnings.push('Missing backend.cache section');
  }

  // Validate frontend section
  if (config.frontend) {
    if (!config.frontend.api_base_url) warnings.push('Missing frontend.api_base_url');
  }

  return { errors, warnings };
}

function showStatus() {
  const config = loadConfig();
  if (!config) return;

  console.log('📋 Configuration Status\n');
  
  const { errors, warnings } = validateConfig(config);
  
  if (errors.length === 0) {
    console.log('✅ Configuration is valid');
  } else {
    console.log('❌ Configuration has errors:');
    errors.forEach(error => console.log(`   - ${error}`));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Configuration warnings:');
    warnings.forEach(warning => console.log(`   - ${warning}`));
  }

  // Show current values
  console.log('\n📊 Current Configuration:');
  console.log(`   FHIR Base URL: ${config.fhir?.base_url}`);
  console.log(`   Backend Port: ${config.backend?.port}`);
  console.log(`   Frontend API URL: ${config.frontend?.api_base_url}`);
  console.log(`   Patient Cache: ${config.backend?.cache?.patient_cache_duration_minutes} minutes`);
  console.log(`   Features Enabled: ${Object.keys(config.features || {}).filter(k => config.features[k]).length}`);
}

function showFeatures() {
  const config = loadConfig();
  if (!config) return;

  console.log('🚀 Feature Flags Status\n');
  
  const features = config.features || {};
  Object.entries(features).forEach(([feature, enabled]) => {
    const status = enabled ? '✅ Enabled' : '❌ Disabled';
    console.log(`   ${feature}: ${status}`);
  });
}

function generateEnvTemplate() {
  console.log('📝 Environment Variables Template\n');
  console.log('# Copy these to your .env file:');
  console.log('FHIR_BASE_URL=https://hapi.fhir.org/baseR4/');
  console.log('PORT=8000');
  console.log('PATIENT_CACHE_DURATION=5');
  console.log('CONFIG_CACHE_DURATION=1');
  console.log('MAX_CACHE_ENTRIES=100');
  console.log('');
  console.log('# Frontend environment variables:');
  console.log('REACT_APP_API_BASE_URL=http://localhost:8000');
  console.log('REACT_APP_FHIR_BASE_URL=https://hapi.fhir.org/baseR4/');
  console.log('REACT_APP_TIMEOUT=30000');
  console.log('REACT_APP_MAX_RETRIES=2');
  console.log('REACT_APP_DEBUG=false');
}

function showHelp() {
  console.log('🛠️  Configuration Helper\n');
  console.log('Usage: node scripts/config-helper.js <command>\n');
  console.log('Commands:');
  console.log('  status     - Show configuration status and validation');
  console.log('  features   - Show feature flags status');
  console.log('  env        - Generate environment variables template');
  console.log('  help       - Show this help message');
  console.log('\nConfiguration file: config.yaml');
}

// Main execution
const command = process.argv[2];

switch (command) {
  case 'status':
    showStatus();
    break;
  case 'features':
    showFeatures();
    break;
  case 'env':
    generateEnvTemplate();
    break;
  case 'help':
  case undefined:
    showHelp();
    break;
  default:
    console.log(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}