import React, { useState, useRef } from 'react';

const FileUploadModal = ({ onClose, onUploadSuccess }) => {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setError('Please select a .json FHIR Bundle file');
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/api/sources/file/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Upload failed: HTTP ${response.status}`);
      }

      const data = await response.json();
      onUploadSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleInputChange = (e) => {
    handleFile(e.target.files[0]);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '8px', padding: '2rem',
        width: '480px', maxWidth: '90vw', boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#333' }}>Upload FHIR Bundle</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? '#007bff' : '#ced4da'}`,
            borderRadius: '8px',
            padding: '2.5rem',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: dragging ? '#e8f4ff' : '#f8f9fa',
            transition: 'all 0.2s',
            marginBottom: '1rem',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />
          {uploading ? (
            <div style={{ color: '#007bff' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
              <p style={{ margin: 0 }}>Uploading…</p>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📂</div>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: '#333' }}>
                Drop a FHIR Bundle here
              </p>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
                or click to select a .json file
              </p>
            </>
          )}
        </div>

        {error && (
          <div style={{
            backgroundColor: '#fff5f5', border: '1px solid #f5c6cb',
            borderRadius: '4px', padding: '0.75rem', color: '#721c24',
            fontSize: '0.875rem', marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        <div style={{ fontSize: '0.8rem', color: '#888', lineHeight: 1.5 }}>
          <strong>Supported formats:</strong> FHIR R4 Bundle JSON (e.g. from Synthea or a FHIR export).
          Files are held in memory for 2 hours.
        </div>
      </div>
    </div>
  );
};

export default FileUploadModal;
