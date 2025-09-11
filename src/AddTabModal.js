// src/AddTabModal.js - Updated to remove hardcoded categories
import React, { useState, useMemo } from 'react';
import './AddTabModal.css';

const AddTabModal = ({ availableResources, tabCounts, onAddTab, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');


  // Fully dynamic categorization based on resource type patterns
  const categorizeResources = (resources) => {
    const categories = {};

    resources.forEach(resource => {
      const type = resource.label.toLowerCase();
      let category = 'Other Healthcare Data';
      
      // Clinical care and patient-focused resources
      if (type.includes('condition') || type.includes('diagnosis')) {
        category = 'Conditions & Diagnoses';
      } else if (type.includes('observation') || type.includes('vital') || type.includes('measurement')) {
        category = 'Observations & Vitals';
      } else if (type.includes('procedure') || type.includes('surgery') || type.includes('intervention')) {
        category = 'Procedures & Treatments';
      } else if (type.includes('medication') || type.includes('drug') || type.includes('prescription')) {
        category = 'Medications & Prescriptions';
      } else if (type.includes('immunization') || type.includes('vaccine')) {
        category = 'Immunizations & Vaccines';
      } else if (type.includes('allergy') || type.includes('intolerance') || type.includes('adverse')) {
        category = 'Allergies & Reactions';
      
      // Care management and coordination
      } else if ((type.includes('care') && type.includes('plan')) || type.includes('treatment')) {
        category = 'Care Plans & Goals';
      } else if ((type.includes('care') && type.includes('team')) || type.includes('team')) {
        category = 'Care Teams & Providers';
      } else if (type.includes('goal') || type.includes('target')) {
        category = 'Goals & Targets';
      
      // Healthcare encounters and visits
      } else if (type.includes('encounter') || type.includes('visit') || type.includes('admission')) {
        category = 'Visits & Encounters';
      } else if (type.includes('appointment') || type.includes('schedule')) {
        category = 'Appointments & Scheduling';
      
      // People and organizations
      } else if (type.includes('patient') || type.includes('person') || type.includes('individual')) {
        category = 'Patients & Demographics';
      } else if (type.includes('practitioner') || type.includes('provider') || type.includes('clinician')) {
        category = 'Healthcare Providers';
      } else if (type.includes('organization') || type.includes('facility') || type.includes('institution')) {
        category = 'Organizations & Facilities';
      } else if (type.includes('location') || type.includes('place') || type.includes('site')) {
        category = 'Locations & Places';
      
      // Documentation and reports
      } else if (type.includes('document') || type.includes('reference') || type.includes('attachment')) {
        category = 'Documents & References';
      } else if (type.includes('diagnostic') && type.includes('report')) {
        category = 'Diagnostic Reports';
      } else if (type.includes('imaging') || type.includes('study') || type.includes('scan')) {
        category = 'Imaging & Studies';
      } else if (type.includes('media') || type.includes('photo') || type.includes('image')) {
        category = 'Media & Attachments';
      
      // Administrative and financial
      } else if (type.includes('coverage') || type.includes('insurance') || type.includes('eligibility')) {
        category = 'Insurance & Coverage';
      } else if (type.includes('account') || type.includes('billing') || type.includes('financial')) {
        category = 'Billing & Financial';
      } else if (type.includes('device') || type.includes('equipment') || type.includes('implant')) {
        category = 'Devices & Equipment';
      
      // Family and history
      } else if (type.includes('family') || type.includes('history') || type.includes('genetic')) {
        category = 'Family & Medical History';
      
      // Workflow and requests
      } else if (type.includes('request') || type.includes('order') || type.includes('requisition')) {
        category = 'Orders & Requests';
      } else if (type.includes('task') || type.includes('workflow') || type.includes('process')) {
        category = 'Tasks & Workflow';
      } else if (type.includes('communication') || type.includes('message') || type.includes('alert')) {
        category = 'Communications & Messages';
      
      // Research and quality
      } else if (type.includes('research') || type.includes('study') || type.includes('trial')) {
        category = 'Research & Studies';
      } else if (type.includes('quality') || type.includes('measure') || type.includes('metric')) {
        category = 'Quality & Measures';
      
      // System and audit
      } else if (type.includes('provenance') || type.includes('audit') || type.includes('log')) {
        category = 'Audit & Provenance';
      } else if (type.includes('subscription') || type.includes('notification')) {
        category = 'Subscriptions & Notifications';
      }
      
      // Initialize category if it doesn't exist
      if (!categories[category]) {
        categories[category] = [];
      }
      
      categories[category].push(resource);
    });

    // Sort categories by name and remove empty ones
    const sortedCategories = {};
    Object.keys(categories)
      .filter(category => categories[category].length > 0)
      .sort()
      .forEach(category => {
        sortedCategories[category] = categories[category];
      });

    return sortedCategories;
  };

  // Filter and search resources
  const filteredResources = useMemo(() => {
    let filtered = [...availableResources];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(resource =>
        resource.label.toLowerCase().includes(searchLower) ||
        resource.description.toLowerCase().includes(searchLower)
      );
    }

    // Categorize filtered resources
    const categorized = categorizeResources(filtered);

    // Apply category filter
    if (selectedCategory !== 'All') {
      return { [selectedCategory]: categorized[selectedCategory] || [] };
    }

    return categorized;
  }, [availableResources, searchTerm, selectedCategory]);

  // Get available categories dynamically
  const availableCategories = useMemo(() => {
    const categorized = categorizeResources(availableResources);
    return ['All', ...Object.keys(categorized).sort()];
  }, [availableResources]);

  // Calculate total resources for each category
  const getCategoryCount = (categoryName) => {
    if (categoryName === 'All') {
      return availableResources.length;
    }
    const categorized = categorizeResources(availableResources);
    return categorized[categoryName]?.length || 0;
  };

  return (
    <div className="add-tab-modal-overlay" onClick={onClose}>
      <div className="add-tab-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Resource Tab</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-content">
          <p className="modal-description">
            Select a FHIR resource type to add as a new tab. All resource types are discovered dynamically from the FHIR server.
          </p>
          
          {/* Search and Filter Controls */}
          <div className="modal-controls">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search resources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <span className="search-icon">🔍</span>
            </div>
            
            <div className="category-filter">
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="category-select"
              >
                {availableCategories.map(category => (
                  <option key={category} value={category}>
                    {category} {category !== 'All' ? `(${getCategoryCount(category)})` : `(${availableResources.length})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Resource Grid by Category */}
          <div className="resource-categories">
            {Object.entries(filteredResources).map(([categoryName, resources]) => (
              <div key={categoryName} className="resource-category">
                <h4 className="category-header">
                  {categoryName}
                  <span className="category-count">({resources.length})</span>
                </h4>
                
                <div className="resource-grid">
                  {resources.map(resource => (
                    <div 
                      key={resource.id}
                      className="resource-card"
                      onClick={() => onAddTab(resource.id)}
                    >
                      <div className="resource-icon">{resource.icon}</div>
                      <div className="resource-info">
                        <h5>{resource.label}</h5>
                        <p>{resource.description}</p>
                      </div>
                      <div className="add-indicator">+</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          {/* Empty State */}
          {availableResources.length === 0 && (
            <div className="empty-state">
              <p>No additional resource types available to add as tabs.</p>
            </div>
          )}

          {/* No Search Results */}
          {availableResources.length > 0 && Object.keys(filteredResources).length === 0 && (
            <div className="empty-state">
              <p>No resources found matching "{searchTerm}"</p>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <div className="results-summary">
            Showing {Object.values(filteredResources).flat().length} of {availableResources.length} resources
          </div>
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTabModal;