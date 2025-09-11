import React, { useState, useMemo } from 'react';

const Notes = ({ documentReferences = [], diagnosticReports = [], pagination = {}, onPageChange, loading }) => {
  const [activeNotesTab, setActiveNotesTab] = useState('documentreference');
  const [selectedNote, setSelectedNote] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [filters, setFilters] = useState({
    dateRange: 'all',
    status: 'all',
    provider: 'all'
  });

  const handleViewNote = (note) => {
    setSelectedNote(note);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedNote(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getTitle = (note, resourceType) => {
    if (resourceType === 'DiagnosticReport') {
      return note?.code?.text || 'Diagnostic Report';
    }
    return note?.type?.text || note?.description || 'Clinical Document';
  };

  const getProvider = (note, resourceType) => {
    if (resourceType === 'DiagnosticReport') {
      return note?.performer?.[0]?.display || 'Unknown Provider';
    }
    return note?.author?.[0]?.display || note?.custodian?.display || 'Unknown Provider';
  };

  const getDate = (note, resourceType) => {
    if (resourceType === 'DiagnosticReport') {
      return note?.effectiveDateTime || note?.issued;
    }
    return note?.date || note?.created;
  };

  const getStatus = (note) => {
    return note?.status || 'unknown';
  };

  const getContent = (note, resourceType) => {
    if (resourceType === 'DiagnosticReport') {
      return extractDiagnosticReportContent(note);
    }
    
    // DocumentReference content
    const attachmentData = note?.content?.[0]?.attachment?.data;
    if (attachmentData) {
      try {
        return atob(attachmentData);
      } catch {
        return attachmentData;
      }
    }
    return note?.description || 'Content not available';
  };

  const getResourceType = () => {
    return activeNotesTab === 'documentreference' ? 'DocumentReference' : 'DiagnosticReport';
  };

  const getCurrentData = () => {
    return activeNotesTab === 'documentreference' ? documentReferences : diagnosticReports;
  };

  const getResourceColor = (resourceType) => {
    return resourceType === 'DiagnosticReport' ? '#28a745' : '#007bff';
  };

  // Get unique filter values
  const getUniqueValues = (data, resourceType, field) => {
    const values = data.map(note => {
      switch (field) {
        case 'status':
          return getStatus(note);
        case 'provider':
          return getProvider(note, resourceType);
        default:
          return '';
      }
    }).filter(Boolean);
    return [...new Set(values)].sort();
  };

  // Generate date range options from current data
  const dateRangeOptions = useMemo(() => {
    const data = getCurrentData();
    const resourceType = getResourceType();
    const dates = [];

    data.forEach(note => {
      const dateStr = getDate(note, resourceType);
      if (dateStr && dateStr !== 'Unknown') {
        const noteDate = new Date(dateStr);
        if (!isNaN(noteDate.getTime())) {
          dates.push(noteDate);
        }
      }
    });

    return generateDateRanges(dates);
  }, [activeNotesTab, documentReferences, diagnosticReports]);

  // Filter and sort data
  const processedData = useMemo(() => {
    let data = [...getCurrentData()];
    const resourceType = getResourceType();

    // Apply search filter
    if (searchTerm) {
      data = data.filter(note => {
        const searchLower = searchTerm.toLowerCase();
        const title = getTitle(note, resourceType).toLowerCase();
        const provider = getProvider(note, resourceType).toLowerCase();
        const content = getContent(note, resourceType).toLowerCase();
        const status = getStatus(note).toLowerCase();
        
        // Also search in description and other text fields
        const description = (note?.description || '').toLowerCase();
        const noteText = (note?.text?.div || '').toLowerCase();
        const category = (note?.category?.[0]?.text || '').toLowerCase();
        
        return title.includes(searchLower) ||
               provider.includes(searchLower) ||
               content.includes(searchLower) ||
               status.includes(searchLower) ||
               description.includes(searchLower) ||
               noteText.includes(searchLower) ||
               category.includes(searchLower);
      });
    }

    // Apply date range filter
    if (filters.dateRange !== 'all') {
      // Handle specific date filtering (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(filters.dateRange)) {
        const selectedDate = filters.dateRange;
        data = data.filter(note => {
          const noteDate = new Date(getDate(note, resourceType));
          const noteDateKey = noteDate.toISOString().split('T')[0];
          return noteDateKey === selectedDate;
        });
      } else {
        // Handle traditional range filtering
        const now = new Date();
        const filterDate = getFilterDate(now, filters.dateRange);
        data = data.filter(note => {
          const noteDate = new Date(getDate(note, resourceType));
          return noteDate >= filterDate;
        });
      }
    }

    // Apply status filter
    if (filters.status !== 'all') {
      data = data.filter(note => getStatus(note) === filters.status);
    }

    // Apply provider filter
    if (filters.provider !== 'all') {
      data = data.filter(note => getProvider(note, resourceType) === filters.provider);
    }

    // Apply sorting
    data.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortConfig.key) {
        case 'date':
          aVal = new Date(getDate(a, resourceType) || 0);
          bVal = new Date(getDate(b, resourceType) || 0);
          break;
        case 'title':
          aVal = getTitle(a, resourceType);
          bVal = getTitle(b, resourceType);
          break;
        case 'provider':
          aVal = getProvider(a, resourceType);
          bVal = getProvider(b, resourceType);
          break;
        case 'status':
          aVal = getStatus(a);
          bVal = getStatus(b);
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [getCurrentData(), getResourceType(), searchTerm, filters, sortConfig]);

  // Handle sorting
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Get sort arrow
  const getSortArrow = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const currentData = getCurrentData();
  const currentResourceType = getResourceType();
  const uniqueStatuses = getUniqueValues(currentData, currentResourceType, 'status');
  const uniqueProviders = getUniqueValues(currentData, currentResourceType, 'provider');

  return (
    <div style={{ padding: '1rem' }}>
      {/* Sub-tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #e9ecef',
        marginBottom: '1rem',
        backgroundColor: '#f8f9fa'
      }}>
        <button
          onClick={() => {
            setActiveNotesTab('documentreference');
            setSearchTerm('');
            setFilters({ dateRange: 'all', status: 'all', provider: 'all' });
          }}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            backgroundColor: activeNotesTab === 'documentreference' ? '#007bff' : 'transparent',
            color: activeNotesTab === 'documentreference' ? 'white' : '#495057',
            fontWeight: activeNotesTab === 'documentreference' ? '600' : '500',
            borderRadius: '6px 6px 0 0',
            cursor: 'pointer',
            fontSize: '0.9rem',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            if (activeNotesTab !== 'documentreference') {
              e.target.style.backgroundColor = '#e9ecef';
            }
          }}
          onMouseLeave={(e) => {
            if (activeNotesTab !== 'documentreference') {
              e.target.style.backgroundColor = 'transparent';
            }
          }}
        >
          Document References
        </button>
        <button
          onClick={() => {
            setActiveNotesTab('diagnosticreport');
            setSearchTerm('');
            setFilters({ dateRange: 'all', status: 'all', provider: 'all' });
          }}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            backgroundColor: activeNotesTab === 'diagnosticreport' ? '#007bff' : 'transparent',
            color: activeNotesTab === 'diagnosticreport' ? 'white' : '#495057',
            fontWeight: activeNotesTab === 'diagnosticreport' ? '600' : '500',
            borderRadius: '6px 6px 0 0',
            cursor: 'pointer',
            fontSize: '0.9rem',
            marginLeft: '2px',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            if (activeNotesTab !== 'diagnosticreport') {
              e.target.style.backgroundColor = '#e9ecef';
            }
          }}
          onMouseLeave={(e) => {
            if (activeNotesTab !== 'diagnosticreport') {
              e.target.style.backgroundColor = 'transparent';
            }
          }}
        >
          Diagnostic Reports
        </button>
      </div>

      {/* Inline Filters */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '1rem',
        borderRadius: '8px',
        marginBottom: '1rem',
        border: '1px solid #e9ecef'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
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
              placeholder="Search notes by content, provider, or keywords..."
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

          {/* Date Range */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Date Range
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}
            >
              <option value="all">All Dates</option>
              {dateRangeOptions.map(range => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}
            >
              <option value="all">All Statuses</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          {/* Provider */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Provider
            </label>
            <select
              value={filters.provider}
              onChange={(e) => setFilters(prev => ({ ...prev, provider: e.target.value }))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}
            >
              <option value="all">All Providers</option>
              {uniqueProviders.map(provider => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Second row with results count and clear filters */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '1rem'
        }}>
          <span style={{ fontSize: '0.875rem', color: '#6c757d' }}>
            {processedData.length} of {currentData.length} items
          </span>
          
          <button
            onClick={() => {
              setSearchTerm('');
              setFilters({ dateRange: 'all', status: 'all', provider: 'all' });
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

      {/* Content */}
      {processedData.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '2rem',
          color: '#6c757d'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            {activeNotesTab === 'documentreference' ? 'Document' : 'Report'}
          </div>
          <p>
            {currentData.length === 0
              ? (activeNotesTab === 'documentreference' 
                  ? 'No document references found' 
                  : 'No diagnostic reports found')
              : 'No items match your search and filters'}
          </p>
          <p style={{ fontSize: '0.9rem' }}>
            {currentData.length === 0 
              ? 'Try adjusting your search terms or filters'
              : 'Try adjusting your search terms or filters'}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '1rem'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th 
                  onClick={() => handleSort('date')}
                  style={{ 
                    padding: '0.75rem', 
                    borderBottom: '2px solid #dee2e6',
                    textAlign: 'left',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  Date {getSortArrow('date')}
                </th>
                <th 
                  onClick={() => handleSort('title')}
                  style={{ 
                    padding: '0.75rem', 
                    borderBottom: '2px solid #dee2e6',
                    textAlign: 'left',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  Title {getSortArrow('title')}
                </th>
                <th 
                  onClick={() => handleSort('provider')}
                  style={{ 
                    padding: '0.75rem', 
                    borderBottom: '2px solid #dee2e6',
                    textAlign: 'left',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  Provider {getSortArrow('provider')}
                </th>
                <th 
                  onClick={() => handleSort('status')}
                  style={{ 
                    padding: '0.75rem', 
                    borderBottom: '2px solid #dee2e6',
                    textAlign: 'left',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  Status {getSortArrow('status')}
                </th>
                <th style={{ 
                  padding: '0.75rem', 
                  borderBottom: '2px solid #dee2e6',
                  textAlign: 'left'
                }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {processedData.map((note, index) => (
                <tr key={note.id || index} style={{
                  borderBottom: '1px solid #dee2e6'
                }}>
                  <td style={{ padding: '0.75rem' }}>
                    {formatDate(getDate(note, currentResourceType))}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {getTitle(note, currentResourceType)}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {getProvider(note, currentResourceType)}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem',
                      backgroundColor: getStatus(note) === 'final' ? '#d4edda' : '#fff3cd',
                      color: getStatus(note) === 'final' ? '#155724' : '#856404'
                    }}>
                      {getStatus(note)}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <button
                      onClick={() => handleViewNote(note)}
                      style={{
                        padding: '0.375rem 0.75rem',
                        border: '1px solid #007bff',
                        borderRadius: '0.25rem',
                        backgroundColor: 'transparent',
                        color: '#007bff',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#007bff';
                        e.target.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = '#007bff';
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && selectedNote && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseModal();
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              maxWidth: '800px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              borderBottom: '1px solid #dee2e6',
              paddingBottom: '1rem'
            }}>
              <h3 style={{ margin: 0 }}>
                {currentResourceType === 'DiagnosticReport' ? 'Diagnostic Report Details' : 'Document Reference Details'}
              </h3>
              <button
                onClick={handleCloseModal}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6c757d'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.875rem',
                  backgroundColor: getResourceColor(currentResourceType),
                  color: 'white'
                }}>
                  {currentResourceType}
                </span>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.875rem',
                  backgroundColor: getStatus(selectedNote) === 'final' ? '#28a745' : '#ffc107',
                  color: 'white'
                }}>
                  {getStatus(selectedNote)}
                </span>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <p><strong>Date:</strong> {formatDate(getDate(selectedNote, currentResourceType))}</p>
                <p><strong>Provider:</strong> {getProvider(selectedNote, currentResourceType)}</p>
                <p><strong>Title:</strong> {getTitle(selectedNote, currentResourceType)}</p>
              </div>
            </div>

            <div>
              <h4>Content</h4>
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '1rem',
                borderRadius: '0.25rem',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                maxHeight: '400px',
                overflowY: 'auto',
                border: '1px solid #dee2e6'
              }}>
                {getContent(selectedNote, currentResourceType)}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Add pagination controls */}
      {(pagination.documentReferences?.total > pagination.documentReferences?.per_page || 
        pagination.diagnosticReports?.total > pagination.diagnosticReports?.per_page) && (
        <div className="pagination-controls">
          {pagination.documentReferences && activeNotesTab === 'documentreference' && (
            <div className="pagination-section">
              <div className="pagination-info">
                Document References: {Math.min((pagination.documentReferences.page - 1) * pagination.documentReferences.per_page + 1, pagination.documentReferences.total)}-
                {Math.min(pagination.documentReferences.page * pagination.documentReferences.per_page, pagination.documentReferences.total)} of {pagination.documentReferences.total}
              </div>
              <div className="pagination-buttons">
                <button 
                  className="pagination-btn"
                  disabled={!pagination.documentReferences.has_prev || loading}
                  onClick={() => onPageChange('documentReferences', pagination.documentReferences.page - 1)}
                >
                  Previous
                </button>
                <span>Page {pagination.documentReferences.page}</span>
                <button 
                  className="pagination-btn"
                  disabled={!pagination.documentReferences.has_next || loading}
                  onClick={() => onPageChange('documentReferences', pagination.documentReferences.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
          
          {pagination.diagnosticReports && activeNotesTab === 'diagnosticreport' && (
            <div className="pagination-section">
              <div className="pagination-info">
                Diagnostic Reports: {Math.min((pagination.diagnosticReports.page - 1) * pagination.diagnosticReports.per_page + 1, pagination.diagnosticReports.total)}-
                {Math.min(pagination.diagnosticReports.page * pagination.diagnosticReports.per_page, pagination.diagnosticReports.total)} of {pagination.diagnosticReports.total}
              </div>
              <div className="pagination-buttons">
                <button 
                  className="pagination-btn"
                  disabled={!pagination.diagnosticReports.has_prev || loading}
                  onClick={() => onPageChange('diagnosticReports', pagination.diagnosticReports.page - 1)}
                >
                  Previous
                </button>
                <span>Page {pagination.diagnosticReports.page}</span>
                <button 
                  className="pagination-btn"
                  disabled={!pagination.diagnosticReports.has_next || loading}
                  onClick={() => onPageChange('diagnosticReports', pagination.diagnosticReports.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function extractDiagnosticReportContent(report) {
  // Try different content sources in order of preference
  
  // 1. Check for conclusion text
  if (report.conclusion && report.conclusion.trim()) {
    return report.conclusion;
  }
  
  // 2. Check for narrative text in text.div (often contains the main content)
  if (report.text?.div) {
    // Clean up HTML tags for better readability
    const cleanText = report.text.div
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ')     // Replace multiple spaces with single space
      .trim();
    
    if (cleanText && cleanText !== 'N/A') {
      return cleanText;
    }
  }
  
  // 3. Check for presentedForm data (base64 encoded documents)
  if (report.presentedForm?.[0]?.data) {
    const contentType = report.presentedForm[0].contentType || 'Unknown format';
    const base64Data = report.presentedForm[0].data;
    
    // If it's text/plain, decode and display the content
    if (contentType.toLowerCase().includes('text/plain') || contentType.toLowerCase().includes('text/')) {
      try {
        const decodedText = atob(base64Data);
        if (decodedText && decodedText.trim()) {
          return decodedText.trim();
        }
      } catch (error) {
        console.warn('Failed to decode base64 text content:', error);
      }
    }
    
    // For non-text content types or if decoding failed
    const dataSize = base64Data.length;
    return `Report available as ${contentType} (${Math.round(dataSize * 0.75)} bytes)\n\nNote: This report contains binary data that cannot be displayed as text. The report may be a PDF, image, or other document format.`;
  }
  
  // 4. Check if there are result references - try to extract meaningful content
  if (report.result?.length > 0) {
    const resultCount = report.result.length;
    
    // Try to extract result data from the report's contained resources
    let resultContent = extractResultContent(report);
    
    if (resultContent) {
      return `${report.code?.text || 'Diagnostic Report'}\n\n${resultContent}`;
    }
    
    // Fallback to reference list if no detailed content found
    const resultList = report.result
      .slice(0, 8) // Show more results
      .map(ref => `• ${ref.reference || ref.display || 'Observation result'}`)
      .join('\n');
    
    const moreResults = report.result.length > 8 ? `\n... and ${report.result.length - 8} more results` : '';
    
    return `This diagnostic report contains ${resultCount} result${resultCount === 1 ? '' : 's'}:\n\n${resultList}${moreResults}\n\nNote: Individual results can be viewed in the Labs or Measurements tabs.`;
  }
  
  // 5. Fallback to basic info if available
  const reportType = report.code?.text || report.code?.coding?.[0]?.display || 'Diagnostic Report';
  const status = report.status || 'unknown';
  const date = report.effectiveDateTime || report.issued || 'unknown date';
  
  return `${reportType}\nStatus: ${status}\nDate: ${date}\n\nNo detailed content available for this report.`;
}

function extractResultContent(report) {
  // Check if the report contains embedded observations in 'contained' resources
  if (report.contained && report.contained.length > 0) {
    const observations = report.contained.filter(resource => resource.resourceType === 'Observation');
    
    if (observations.length > 0) {
      const resultText = observations.map(obs => formatObservationResult(obs)).join('\n');
      return `Results:\n${resultText}`;
    }
  }
  
  // Enhanced fallback: provide more detailed information about the results
  if (report.result?.length > 0) {
    const reportDate = report.effectiveDateTime || report.issued;
    const reportType = report.code?.text || report.code?.coding?.[0]?.display || 'Diagnostic Report';
    
    // Create a more informative description
    let content = `${reportType}\n`;
    
    if (reportDate) {
      content += `Date: ${new Date(reportDate).toLocaleDateString()}\n`;
    }
    
    if (report.status) {
      content += `Status: ${report.status}\n`;
    }
    
    if (report.performer?.[0]?.display) {
      content += `Performed by: ${report.performer[0].display}\n`;
    }
    
    content += `\nThis report contains ${report.result.length} individual lab result${report.result.length === 1 ? '' : 's'}:\n\n`;
    
    // Show result references with better formatting
    const resultList = report.result
      .slice(0, 10) // Show up to 10 results
      .map((ref, index) => {
        const refId = ref.reference || ref.display || 'Unknown result';
        // Try to make the reference more readable
        const cleanRef = refId.replace(/^(Observation\/|urn:uuid:)/, '').substring(0, 20);
        return `${index + 1}. Lab Result: ${cleanRef}`;
      }).join('\n');
    
    const moreResults = report.result.length > 10 ? `\n... and ${report.result.length - 10} more results` : '';
    
    content += resultList + moreResults;
    content += '\n\n💡 Individual results with values can be viewed in the "Labs" or "Measurements" tabs for detailed values, reference ranges, and trends.';
    
    return content;
  }
  
  return null;
}

function formatObservationResult(obs) {
  const testName = obs.code?.text || 
                  obs.code?.coding?.[0]?.display || 
                  obs.code?.coding?.[0]?.code || 
                  'Test';
  
  let value = 'N/A';
  let unit = '';
  let status = obs.status ? `(${obs.status})` : '';
  
  // Extract value based on different value types
  if (obs.valueQuantity) {
    value = obs.valueQuantity.value || 'N/A';
    unit = obs.valueQuantity.unit || obs.valueQuantity.code || '';
  } else if (obs.valueString) {
    value = obs.valueString;
  } else if (obs.valueCodeableConcept) {
    value = obs.valueCodeableConcept.text || 
            obs.valueCodeableConcept.coding?.[0]?.display || 
            obs.valueCodeableConcept.coding?.[0]?.code || 'N/A';
  } else if (obs.valueBoolean !== undefined) {
    value = obs.valueBoolean ? 'Positive' : 'Negative';
  } else if (obs.component && obs.component.length > 0) {
    // Handle components (like Blood Pressure with systolic/diastolic)
    const componentValues = obs.component.map(comp => {
      const compName = comp.code?.text || comp.code?.coding?.[0]?.display || 'Component';
      const compValue = comp.valueQuantity?.value || comp.valueString || 'N/A';
      const compUnit = comp.valueQuantity?.unit || comp.valueQuantity?.code || '';
      return `${compName}: ${compValue} ${compUnit}`.trim();
    }).join(', ');
    value = componentValues;
  }
  
  // Reference range if available
  let refRange = '';
  if (obs.referenceRange && obs.referenceRange.length > 0) {
    const range = obs.referenceRange[0];
    if (range.low?.value !== undefined && range.high?.value !== undefined) {
      refRange = ` [Normal: ${range.low.value}-${range.high.value} ${range.low.unit || ''}]`;
    } else if (range.text) {
      refRange = ` [${range.text}]`;
    }
  }
  
  // Format the result line
  const valueWithUnit = unit ? `${value} ${unit}` : value;
  return `• ${testName}: ${valueWithUnit}${refRange} ${status}`.trim();
}

function getFilterDate(now, range) {
  // Handle specific dates (format: "YYYY-MM-DD")
  if (/^\d{4}-\d{2}-\d{2}$/.test(range)) {
    return new Date(range);
  }
  
  const date = new Date(now);
  
  // Handle year ranges (format: "YYYY")
  if (/^\d{4}$/.test(range)) {
    return new Date(`${range}-01-01`);
  }
  
  // Handle traditional ranges
  switch (range) {
    case '1d':
      date.setDate(date.getDate() - 1);
      break;
    case '1w':
      date.setDate(date.getDate() - 7);
      break;
    case '1m':
      date.setMonth(date.getMonth() - 1);
      break;
    case '3m':
      date.setMonth(date.getMonth() - 3);
      break;
    case '1y':
      date.setFullYear(date.getFullYear() - 1);
      break;
    default:
      return new Date(0); // Return epoch for 'all'
  }
  
  return date;
}

function generateDateRanges(dates) {
  if (!dates || dates.length === 0) {
    return [];
  }

  const ranges = [];

  // Group dates by actual date (YYYY-MM-DD)
  const dateGroups = {};
  dates.forEach(date => {
    const dateKey = date.toISOString().split('T')[0]; // Get YYYY-MM-DD format
    if (!dateGroups[dateKey]) {
      dateGroups[dateKey] = [];
    }
    dateGroups[dateKey].push(date);
  });

  // Convert to ranges with counts
  Object.keys(dateGroups)
    .sort((a, b) => new Date(b) - new Date(a)) // Sort by date descending (newest first)
    .forEach(dateKey => {
      const count = dateGroups[dateKey].length;
      const formattedDate = new Date(dateKey).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      ranges.push({
        value: dateKey, // Use ISO date as value for filtering
        label: `${formattedDate} (${count} ${count === 1 ? 'note' : 'notes'})`,
        count: count,
        date: new Date(dateKey)
      });
    });

  return ranges;
}

export default Notes;