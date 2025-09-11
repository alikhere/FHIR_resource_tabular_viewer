// PatientTable.js - Patient table with proper age display
import React from "react";
import { CONFIG } from "./config";
import "./PatientTable.css";

const PatientTable = ({
  patients = [],
  searchTerm = "",
  onPatientSelect,
  loading = false,
  pagination = {},
  onPageChange,
  onPageSizeChange,
}) => {
  // Display value with proper null handling
  const displayValue = (value, defaultText = "-") => {
    if (value === null || value === undefined || value === "") {
      return defaultText;
    }
    return value;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Enhanced age formatting
  const formatAge = (age) => {
    if (age === null || age === undefined || age === "Unknown") {
      return "Unknown";
    }
    // Handle both string and number formats
    if (typeof age === "string" && age.includes("years")) {
      return age; // Already formatted
    }
    if (typeof age === "number" && age >= 0) {
      return `${age} years`;
    }
    if (typeof age === "string" && !isNaN(Number(age))) {
      const numAge = Number(age);
      return numAge >= 0 ? `${numAge} years` : "Unknown";
    }
    return "Unknown";
  };

  // UUID detection removed - no longer needed

  const handlePatientClick = (patient) => {
    if (onPatientSelect && patient.id && patient.id !== "Unknown") {
      onPatientSelect(patient);
    }
  };

  const handlePageChange = (newPage) => {
    if (onPageChange && newPage !== (pagination.page || 1) && newPage > 0) {
      onPageChange(newPage);
    }
  };

  const handlePageSizeChange = (event) => {
    const newPageSize = parseInt(event.target.value, 10);
    if (onPageSizeChange && newPageSize > 0) {
      onPageSizeChange(newPageSize);
    }
  };

  // Safe total-pages calculation
  const calculateTotalPages = () => {
    const total = pagination.total ?? 0;
    const perPage = pagination.per_page || CONFIG.ui.defaultPageSize;
    if (total <= 0 || perPage <= 0) return 1;
    return Math.ceil(total / perPage);
  };

  const getPageRange = () => {
    const perPage = pagination.per_page || CONFIG.ui.defaultPageSize;
    const total = pagination.total ?? 0;
    const totalPages = calculateTotalPages();
    const currentPage = Math.min(Math.max(pagination.page || 1, 1), totalPages);
    const startRecord = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
    const endRecord = total === 0 ? 0 : Math.min(currentPage * perPage, total);
    return { startRecord, endRecord, totalPages, currentPage };
  };

  const renderPaginationControls = () => {
    const { startRecord, endRecord, totalPages, currentPage } = getPageRange();

    // Hide controls if everything fits on one page or no total known
    if (
      (pagination.total ?? 0) <=
      (pagination.per_page || CONFIG.ui.defaultPageSize)
    ) {
      return null;
    }

    const generatePageNumbers = () => {
      const pages = [];
      const maxVisible = 7;
      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
      return pages;
    };

    const pageNumbers = generatePageNumbers();

    return (
      <div className="pagination-controls">
        <div className="pagination-info">
          Showing {startRecord}-{endRecord} of {pagination.total ?? 0} patients
          {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
        </div>

        <div className="pagination-buttons">
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage <= 1 || loading}
            className="btn"
            title="Go to first page"
          >
            First
          </button>

          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="btn"
            title="Go to previous page"
          >
            Previous
          </button>

          {pageNumbers.map((pageNum, index) =>
            pageNum === "..." ? (
              <span key={`ellipsis-${index}`} className="page-dots">
                ...
              </span>
            ) : (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                disabled={loading}
                className={`btn ${pageNum === currentPage ? "active" : ""}`}
                title={`Go to page ${pageNum}`}
              >
                {pageNum}
              </button>
            )
          )}

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            className="btn"
            title="Go to next page"
          >
            Next
          </button>

          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage >= totalPages || loading}
            className="btn"
            title="Go to last page"
          >
            Last
          </button>

          <label htmlFor="pageSize" className="page-size-label">
            Show:
          </label>
          <select
            id="pageSize"
            value={pagination.per_page || CONFIG.ui.defaultPageSize}
            onChange={handlePageSizeChange}
            disabled={loading}
            className="page-size-select"
            title="Select number of patients per page"
          >
            {CONFIG.ui.pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="page-size-suffix">per page</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="patient-table-loading">
        <div className="loading-emoji">⳿</div>
        <h3>Loading Patient Data</h3>
        <p>Fetching records from FHIR server...</p>
      </div>
    );
  }

  // UUID statistics removed

  return (
    <div className="patient-table-container">
      {/* Header */}
      <div className="patient-table-header">
        <h2>Patient Directory</h2>
        <p>
          Total: {pagination.total ?? patients.length} patients
          {searchTerm && ` (filtered for: "${searchTerm}")`}
        </p>
      </div>

      {/* Pagination at top */}
      {patients.length > 0 && renderPaginationControls()}

      {/* Table */}
      {patients.length === 0 ? (
        <div className="patient-table-empty">
          <div className="empty-emoji">🔍</div>
          <h3>No Patients Found</h3>
          <p>
            {searchTerm
              ? `No patients match your search for "${searchTerm}"`
              : "No patient data available from the server"}
          </p>
        </div>
      ) : (
        <div className="patient-table-wrapper">
          <table className="patient-table">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Name</th>
                <th>Age</th>
                <th>Gender</th>
                <th>Birth Date</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient, index) => {
                return (
                  <tr key={patient.id || index} className="patient-row">
                    <td>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "0.85rem",
                            color: "#6c757d",
                            fontWeight: "normal",
                          }}
                        >
                          {displayValue(patient.id)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => handlePatientClick(patient)}
                        className="patient-link"
                        disabled={!patient.id || patient.id === "Unknown"}
                        style={{
                          fontWeight: "normal",
                          color: "#007bff",
                          cursor:
                            !patient.id || patient.id === "Unknown"
                              ? "not-allowed"
                              : "pointer",
                        }}
                        onMouseEnter={(e) => {
                          if (patient.id && patient.id !== "Unknown") {
                            e.target.style.textDecoration = "underline";
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.textDecoration = "none";
                        }}
                        title="Click to view details"
                      >
                        {displayValue(patient.given_name)}{" "}
                        {displayValue(patient.family_name)}
                      </button>
                      <div className="patient-link-sub">
                        {patient.id && patient.id !== "Unknown"
                          ? "Click to view details"
                          : "No ID available"}
                      </div>
                    </td>
                    <td style={{ fontWeight: "normal" }}>
                      {formatAge(patient.age)}
                    </td>
                    <td>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                          fontWeight: "500",
                          backgroundColor:
                            patient.gender === "male"
                              ? "#e3f2fd"
                              : patient.gender === "female"
                              ? "#fce4ec"
                              : "#f5f5f5",
                          color:
                            patient.gender === "male"
                              ? "#1976d2"
                              : patient.gender === "female"
                              ? "#c2185b"
                              : "#616161",
                          border: "none",
                        }}
                      >
                        {displayValue(patient.gender)}
                      </span>
                    </td>
                    <td style={{ fontWeight: "normal" }}>
                      {formatDate(patient.birth_date)}
                    </td>
                    <td style={{ fontWeight: "normal" }}>
                      {patient.city || patient.state ? (
                        <div>
                          {[patient.city, patient.state]
                            .filter(Boolean)
                            .join(", ")}
                          {patient.postal_code && (
                            <span className="postal-muted">
                              {" "}
                              {patient.postal_code}
                            </span>
                          )}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <span
                        className={`patient-status ${
                          patient.active ? "active" : "inactive"
                        }`}
                        style={{ fontWeight: "500" }}
                      >
                        {patient.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom pagination controls */}
      {patients.length > 0 && renderPaginationControls()}
    </div>
  );
};

export default PatientTable;
