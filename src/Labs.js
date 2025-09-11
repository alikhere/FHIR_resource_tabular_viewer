// src/components/Labs.js
import React, { useState } from 'react';

const Labs = ({ observations, diagnosticReports, pagination, onPageChange, loading }) => {
  const [activeLabTab, setActiveLabTab] = useState('observation');
  
  // Filter state
  const [selectedTestType, setSelectedTestType] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [valueRange, setValueRange] = useState({ min: '', max: '' });
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [searchTerm, setSearchTerm] = useState('');

  if (!observations && !diagnosticReports) {
    return <div className="loading">Loading lab data...</div>;
  }


  // Get filter options from data
  const getFilterOptions = () => {
    const allData = observations || [];
    
    const testTypes = [...new Set(allData.map(obs => obs.code_display).filter(Boolean))].sort();
    const units = [...new Set(allData.map(obs => obs.value_unit).filter(Boolean))].sort();
    const statuses = [...new Set(allData.map(obs => obs.status).filter(Boolean))].sort();
    
    // Get value range
    const numericValues = allData
      .map(obs => parseFloat(obs.value_quantity))
      .filter(val => !isNaN(val) && isFinite(val));
    
    const valueRangeData = numericValues.length > 0 ? {
      min: Math.min(...numericValues),
      max: Math.max(...numericValues)
    } : null;
    
    return {
      testTypes,
      units,
      statuses,
      valueRange: valueRangeData
    };
  };
  
  // Apply all filters to the observations
  const getFilteredObservations = () => {
    let data = observations || [];
    
    // Apply test type filter
    if (selectedTestType) {
      data = data.filter(obs => obs.code_display === selectedTestType);
    }
    
    // Apply unit filter
    if (selectedUnit) {
      data = data.filter(obs => obs.value_unit === selectedUnit);
    }
    
    // Apply status filter
    if (selectedStatus) {
      data = data.filter(obs => obs.status === selectedStatus);
    }
    
    // Apply numeric value range filter
    if (valueRange.min !== '' || valueRange.max !== '') {
      data = data.filter(obs => {
        const value = parseFloat(obs.value_quantity);
        if (isNaN(value)) return false;
        
        const minCheck = valueRange.min === '' || value >= parseFloat(valueRange.min);
        const maxCheck = valueRange.max === '' || value <= parseFloat(valueRange.max);
        
        return minCheck && maxCheck;
      });
    }
    
    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      data = data.filter(obs => {
        const obsDate = new Date(obs.effective_date || obs.effectiveDateTime);
        if (isNaN(obsDate.getTime())) return false;
        
        const fromCheck = !dateRange.from || obsDate >= new Date(dateRange.from);
        const toCheck = !dateRange.to || obsDate <= new Date(dateRange.to);
        
        return fromCheck && toCheck;
      });
    }
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      data = data.filter(obs => {
        const codeDisplay = (obs.code_display || '').toLowerCase();
        const value = (obs.value_quantity || '').toString().toLowerCase();
        const unit = (obs.value_unit || '').toLowerCase();
        const status = (obs.status || '').toLowerCase();
        
        return codeDisplay.includes(searchLower) ||
               value.includes(searchLower) ||
               unit.includes(searchLower) ||
               status.includes(searchLower);
      });
    }
    
    return data;
  };

  const filterOptions = getFilterOptions();
  const labObservations = getFilteredObservations();

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getReference = (obs) => {
    // Try to get reference range from FHIR observation data
    if (obs.referenceRange && obs.referenceRange.length > 0) {
      const ref = obs.referenceRange[0];
      const low = ref.low?.value || '';
      const high = ref.high?.value || '';
      const unit = ref.low?.unit || ref.high?.unit || '';
      
      if (low && high) {
        return `${low}-${high} ${unit}`.trim();
      } else if (ref.text) {
        return ref.text;
      }
    }
    
    // Check if observation has component with reference ranges
    if (obs.component && obs.component.length > 0) {
      for (const comp of obs.component) {
        if (comp.referenceRange && comp.referenceRange.length > 0) {
          const ref = comp.referenceRange[0];
          const low = ref.low?.value || '';
          const high = ref.high?.value || '';
          const unit = ref.low?.unit || ref.high?.unit || '';
          
          if (low && high) {
            return `${low}-${high} ${unit}`.trim();
          }
        }
      }
    }
    
    return 'N/A';
  };

  const renderInlineFilters = () => {
    return (
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '1rem',
        borderRadius: '8px',
        marginBottom: '1rem',
        border: '1px solid #e9ecef'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          alignItems: 'end'
        }}>
          {/* Search */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Search
            </label>
            <input
              type="text"
              placeholder="Search tests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}
            />
          </div>

          {/* Test Type */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Test Type
            </label>
            <select
              value={selectedTestType}
              onChange={(e) => setSelectedTestType(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}
            >
              <option value="">All Types</option>
              {filterOptions.testTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Unit */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Unit
            </label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}
            >
              <option value="">All Units</option>
              {filterOptions.units.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}
            >
              <option value="">All Statuses</option>
              {filterOptions.statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Second row for ranges */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem',
          marginTop: '1rem'
        }}>
          {/* Value Range */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Value Range {filterOptions.valueRange && `(${filterOptions.valueRange.min.toFixed(1)} - ${filterOptions.valueRange.max.toFixed(1)})`}
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="number"
                placeholder="Min"
                value={valueRange.min}
                onChange={(e) => setValueRange(prev => ({ ...prev, min: e.target.value }))}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '0.875rem'
                }}
              />
              <input
                type="number"
                placeholder="Max"
                value={valueRange.max}
                onChange={(e) => setValueRange(prev => ({ ...prev, max: e.target.value }))}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '0.875rem'
                }}
              />
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Date Range
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '0.875rem'
                }}
              />
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '0.875rem'
                }}
              />
            </div>
          </div>

          {/* Clear Filters */}
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button
              onClick={() => {
                setSelectedTestType('');
                setSelectedUnit('');
                setSelectedStatus('');
                setValueRange({ min: '', max: '' });
                setDateRange({ from: '', to: '' });
                setSearchTerm('');
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderLabContent = () => {
    if (activeLabTab === 'observation') {
      return (
        <div className="lab-table-container">
          <table className="lab-table">
            <thead>
              <tr>
                <th>Test Name</th>
                <th>Value</th>
                <th>Unit</th>
                <th>Reference Range</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {labObservations.length > 0 ? (
                labObservations.map((obs, index) => (
                  <tr key={obs.id || index}>
                    <td className="test-name">{obs.code_display || 'Unknown'}</td>
                    <td className="test-value">{obs.value_quantity || 'N/A'}</td>
                    <td className="test-unit">{obs.value_unit || '-'}</td>
                    <td className="reference-range">{getReference(obs)}</td>
                    <td className="test-date">{formatDate(obs.effective_date || obs.effectiveDateTime)}</td>
                    <td>
                      <span className={`status-badge ${obs.status || 'unknown'}`}>
                        {obs.status || 'Unknown'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty-state">No lab observations found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    } else {
      return (
        <div className="lab-table-container">
          <table className="lab-table">
            <thead>
              <tr>
                <th>Report ID</th>
                <th>Status</th>
                <th>Effective Date</th>
                <th>Issued Date</th>
                <th>Resource Type</th>
              </tr>
            </thead>
            <tbody>
              {diagnosticReports && diagnosticReports.length > 0 ? (
                diagnosticReports.map((report, index) => (
                  <tr key={report.id || index}>
                    <td className="report-id">{report.id || 'Unknown'}</td>
                    <td>
                      <span className={`status-badge ${report.status || 'unknown'}`}>
                        {report.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="report-date">{formatDate(report.effectiveDateTime)}</td>
                    <td className="report-date">{formatDate(report.issued)}</td>
                    <td className="report-type">{report.resourceType || 'DiagnosticReport'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty-state">No diagnostic reports found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    }
  };

  return (
    <div className="labs-container">
      <div className="labs-tabs">
        <button 
          className={`lab-tab ${activeLabTab === 'observation' ? 'active' : ''}`}
          onClick={() => setActiveLabTab('observation')}
        >
          Lab Results
        </button>
        <button 
          className={`lab-tab ${activeLabTab === 'diagnostic' ? 'active' : ''}`}
          onClick={() => setActiveLabTab('diagnostic')}
        >
          Diagnostic Reports
        </button>
      </div>
      <div className="labs-content">
        {renderInlineFilters()}
        {renderLabContent()}
        
        {/* Add pagination controls */}
        {pagination && pagination.total > pagination.per_page && (
          <div className="pagination-controls">
            <div className="pagination-info">
              Showing {Math.min((pagination.page - 1) * pagination.per_page + 1, pagination.total)}-
              {Math.min(pagination.page * pagination.per_page, pagination.total)} of {pagination.total} results
            </div>
            <div className="pagination-buttons">
              <button 
                className="pagination-btn"
                disabled={!pagination.has_prev || loading}
                onClick={() => onPageChange(pagination.page - 1)}
              >
                Previous
              </button>
              <span className="page-info">Page {pagination.page}</span>
              <button 
                className="pagination-btn"
                disabled={!pagination.has_next || loading}
                onClick={() => onPageChange(pagination.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Labs;