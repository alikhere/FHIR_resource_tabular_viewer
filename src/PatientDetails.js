// PatientDetails.js - Complete with dynamic resource discovery and back navigation
import React, { useState, useEffect } from "react";
import GeneralInformation from "./GeneralInformation";
import Measurements from "./Measurements";
import LabsContainer from "./LabsContainer";
import Notes from "./Notes";
import DynamicResourceTab from "./DynamicResourceTab";
import AddTabModal from "./AddTabModal";
import * as api from "./api";
import { CONFIG } from "./config";
import "./PatientDetails.css";

const PatientDetails = ({ patientId, onBackToList }) => {
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Patient data state
  const [patientData, setPatientData] = useState(null);
  const [observations, setObservations] = useState([]);
  const [diagnosticReports, setDiagnosticReports] = useState([]);
  const [documentReferences, setDocumentReferences] = useState([]);
  const [medicalData, setMedicalData] = useState({
    conditions: [],
    encounters: [],
    procedures: [],
    medications: [],
    immunizations: [],
    careTeam: [],
    allergies: [],
  });

  // ENHANCED: Dynamic tabs state with schema detection
  const [dynamicTabs, setDynamicTabs] = useState([]);
  const [showAddTabModal, setShowAddTabModal] = useState(false);
  const [availableResources, setAvailableResources] = useState([]);
  const [allResourceData, setAllResourceData] = useState({});
  const [resourceSchemas, setResourceSchemas] = useState({});

  // Original data for filtering
  const [originalData, setOriginalData] = useState({
    observations: [],
    diagnosticReports: [],
    documentReferences: [],
    medicalData: {},
  });

  // Filter and sort state
  const [filters, setFilters] = useState({
    dateRange: { start: "", end: "" },
    categories: [],
    status: [],
    types: [],
    searchTerm: "",
  });

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  // Add pagination state for each resource type
  const [resourcePagination, setResourcePagination] = useState({
    observations: {
      page: 1,
      per_page: CONFIG.ui.defaultPageSize,
      total: 0,
      has_next: false,
      has_prev: false,
    },
    diagnosticReports: {
      page: 1,
      per_page: CONFIG.ui.defaultPageSize,
      total: 0,
      has_next: false,
      has_prev: false,
    },
    documentReferences: {
      page: 1,
      per_page: CONFIG.ui.defaultPageSize,
      total: 0,
      has_next: false,
      has_prev: false,
    },
  });

  // Track which tabs have been loaded using object instead of Set
  const [loadedTabs, setLoadedTabs] = useState({});
  const [tabLoading, setTabLoading] = useState({});

  // Helper function to dynamically generate medical data property names
  const generateMedicalDataKey = (resourceType) => {
    // Handle special cases and common mappings
    const specialMappings = {
      MedicationRequest: "medications",
      AllergyIntolerance: "allergies",
      CareTeam: "careTeam",
    };

    if (specialMappings[resourceType]) {
      return specialMappings[resourceType];
    }

    // Generate plural camelCase property name
    // Examples: Condition -> conditions, Procedure -> procedures
    return resourceType.charAt(0).toLowerCase() + resourceType.slice(1) + "s";
  };

  // Load basic patient data on mount
  useEffect(() => {
    if (patientId) {
      loadBasicPatientData();
    }
  }, [patientId]);

  // Load tab data when activeTab changes (for lazy loading)
  useEffect(() => {
    if (patientId && activeTab && !loading) {
      loadTabData(activeTab);
    }
  }, [activeTab, patientId, loading]);

  // Apply filters when they change
  useEffect(() => {
    applyFiltersAndSorting();
  }, [filters, sortConfig, originalData]);

  // Load only basic patient demographics - no medical resources
  const loadBasicPatientData = async () => {
    try {
      setLoading(true);
      setError(null);

      // CRITICAL: Reset loaded tabs state when switching patients
      setLoadedTabs({});
      setTabLoading({});
      setActiveTab("general"); // Reset to general tab

      console.log("Loading basic patient info for ID:", patientId);

      // Only load basic patient info, not medical resources
      const response = await api.getByIdDetailed("Patient", patientId);

      if (!response.success) {
        setError(response.message || "Patient not found");
        setLoading(false);
        return;
      }

      console.log("Basic patient data loaded successfully");

      // Transform FHIR patient data for display
      const transformedPatient = transformPatientData(response.all);
      setPatientData(transformedPatient);

      // Initialize empty state - all medical data is loaded on-demand when tabs are clicked
      setOriginalData({
        observations: [],
        diagnosticReports: [],
        documentReferences: [],
        medicalData: {
          conditions: [],
          encounters: [],
          procedures: [],
          medications: [],
          immunizations: [],
          careTeam: [],
          allergies: [],
        },
      });

      setMedicalData({
        conditions: [],
        encounters: [],
        procedures: [],
        medications: [],
        immunizations: [],
        careTeam: [],
        allergies: [],
      });
    } catch (error) {
      console.error("Error loading patient data:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const transformPatientData = (fhirPatient) => {
    if (!fhirPatient) return null;

    const name = fhirPatient.name?.[0] || {};
    const address = fhirPatient.address?.[0] || {};

    return {
      id: fhirPatient.id,
      given_name: name.given?.join(" ") || "Unknown",
      family_name: name.family || "Unknown",
      birth_date: fhirPatient.birthDate,
      gender: fhirPatient.gender,
      city: address.city,
      state: address.state,
      postal_code: address.postalCode,
      multipleBirthBoolean: fhirPatient.multipleBirthBoolean,
      combined_record_id: fhirPatient.id,
    };
  };

  // Load data for a specific tab on-demand
  const loadTabData = async (tabName) => {
    if (loadedTabs[tabName] || tabLoading[tabName]) {
      return; // Already loaded or currently loading
    }

    console.log(`Loading data for tab: ${tabName}`);
    setTabLoading((prev) => ({ ...prev, [tabName]: true }));

    try {
      let newData = {};

      switch (tabName) {
        case "measurements":
          if (!loadedTabs.observations) {
            console.log("Loading Observations...");
            const obsResponse = await api.getPatientResources(
              patientId,
              "Observation",
              CONFIG.ui.defaultPageSize,
              1,
              0
            );
            // Transform FHIR Observations to expected frontend format
            const transformedObs = (obsResponse.data || []).map((obs) => {
              // More robust extraction with fallbacks
              const extractCodeDisplay = (obs) => {
                if (obs.code?.text) return obs.code.text;
                if (obs.code?.coding?.length > 0) {
                  for (const coding of obs.code.coding) {
                    if (coding.display) return coding.display;
                    if (coding.code) return coding.code;
                  }
                }
                if (obs.code?.display) return obs.code.display;
                return "Unknown Test";
              };

              const extractValue = (obs) => {
                if (obs.valueQuantity?.value !== undefined)
                  return obs.valueQuantity.value;
                if (obs.valueString) return obs.valueString;
                if (obs.valueBoolean !== undefined)
                  return obs.valueBoolean ? "True" : "False";
                if (obs.component?.length > 0) {
                  for (const comp of obs.component) {
                    if (comp.valueQuantity?.value !== undefined)
                      return comp.valueQuantity.value;
                    if (comp.valueString) return comp.valueString;
                  }
                }
                return null;
              };

              const extractUnit = (obs) => {
                if (obs.valueQuantity?.unit) return obs.valueQuantity.unit;
                if (obs.component?.length > 0) {
                  for (const comp of obs.component) {
                    if (comp.valueQuantity?.unit)
                      return comp.valueQuantity.unit;
                  }
                }
                return "";
              };

              const extractDate = (obs) => {
                return (
                  obs.effectiveDateTime ||
                  obs.effectivePeriod?.start ||
                  obs.issued ||
                  obs.meta?.lastUpdated
                );
              };

              return {
                ...obs, // Keep original data
                // Add expected frontend fields
                code_display: extractCodeDisplay(obs),
                effective_date: extractDate(obs),
                value_quantity: extractValue(obs),
                value_unit: extractUnit(obs),
              };
            });
            newData.observations = obsResponse.success ? transformedObs : [];

            // Update pagination state
            if (obsResponse.success && obsResponse.pagination) {
              setResourcePagination((prev) => ({
                ...prev,
                observations: obsResponse.pagination,
              }));
            }

            setLoadedTabs((prev) => ({
              ...prev,
              observations: true,
              measurements: true,
            }));
          }
          break;

        case "labs":
          if (!loadedTabs.observations) {
            console.log("Loading Observations for Labs...");
            const obsResponse = await api.getPatientResources(
              patientId,
              "Observation",
              CONFIG.ui.defaultPageSize,
              1,
              0
            );
            const transformedObs = (obsResponse.data || []).map((obs) => {
              return {
                ...obs,
                code_display:
                  obs.code?.text ||
                  obs.code?.coding?.[0]?.display ||
                  obs.code?.display ||
                  "Unknown",
                effective_date:
                  obs.effectiveDateTime ||
                  obs.effectivePeriod?.start ||
                  obs.issued ||
                  obs.meta?.lastUpdated,
                value_quantity:
                  obs.valueQuantity?.value ||
                  obs.valueString ||
                  (obs.valueBoolean !== undefined
                    ? obs.valueBoolean
                      ? "True"
                      : "False"
                    : null),
                value_unit: obs.valueQuantity?.unit || "",
              };
            });
            newData.observations = obsResponse.success ? transformedObs : [];

            // Update pagination state
            if (obsResponse.success && obsResponse.pagination) {
              setResourcePagination((prev) => ({
                ...prev,
                observations: obsResponse.pagination,
              }));
            }

            setLoadedTabs((prev) => ({
              ...prev,
              observations: true,
              measurements: true,
              labs: true,
            }));
          }
          break;

        case "notes":
          const promises = [];
          if (!loadedTabs.diagnosticReports) {
            promises.push(
              api.getPatientResources(
                patientId,
                "DiagnosticReport",
                CONFIG.ui.defaultPageSize,
                1,
                0
              )
            );
          }
          if (!loadedTabs.documentReferences) {
            promises.push(
              api.getPatientResources(
                patientId,
                "DocumentReference",
                CONFIG.ui.defaultPageSize,
                1,
                0
              )
            );
          }

          if (promises.length > 0) {
            console.log("Loading DiagnosticReports and DocumentReferences...");
            const results = await Promise.allSettled(promises);

            if (!loadedTabs.diagnosticReports && results[0]) {
              const result = results[0].value;
              const rawReports =
                results[0].status === "fulfilled" && result.success
                  ? result.data || []
                  : [];
              // Transform DiagnosticReports for Notes component compatibility
              newData.diagnosticReports = rawReports.map((report) => ({
                ...report,
                source_filename: `${
                  report.resourceType || "DiagnosticReport"
                }_${report.id || "unknown"}.fhir`,
                date:
                  report.effectiveDateTime ||
                  report.issued ||
                  report.meta?.lastUpdated,
              }));

              // Update pagination state for DiagnosticReports
              if (
                results[0].status === "fulfilled" &&
                result.success &&
                result.pagination
              ) {
                setResourcePagination((prev) => ({
                  ...prev,
                  diagnosticReports: result.pagination,
                }));
              }
            }
            if (!loadedTabs.documentReferences) {
              const docIndex = !loadedTabs.diagnosticReports ? 1 : 0;
              if (results[docIndex]) {
                const result = results[docIndex].value;
                const rawDocs =
                  results[docIndex].status === "fulfilled" && result.success
                    ? result.data || []
                    : [];
                // Transform DocumentReferences for Notes component compatibility
                newData.documentReferences = rawDocs.map((doc) => ({
                  ...doc,
                  source_filename: `${
                    doc.resourceType || "DocumentReference"
                  }_${doc.id || "unknown"}.fhir`,
                  date:
                    doc.date ||
                    doc.effectiveDateTime ||
                    doc.issued ||
                    doc.meta?.lastUpdated,
                }));

                // Update pagination state for DocumentReferences
                if (
                  results[docIndex].status === "fulfilled" &&
                  result.success &&
                  result.pagination
                ) {
                  setResourcePagination((prev) => ({
                    ...prev,
                    documentReferences: result.pagination,
                  }));
                }
              }
            }

            setLoadedTabs((prev) => ({
              ...prev,
              diagnosticReports: true,
              documentReferences: true,
              notes: true,
            }));
          }
          break;

        case "general":
          // General Information tab handles its own medical data loading internally
          if (!loadedTabs.general) {
            console.log(
              "General Information tab loaded - Personal Information ready, Overview loads on demand"
            );
            setLoadedTabs((prev) => ({ ...prev, general: true }));
          }
          break;
      }

      // Update the original data with newly loaded data
      setOriginalData((prev) => ({
        observations: newData.observations || prev.observations,
        diagnosticReports: newData.diagnosticReports || prev.diagnosticReports,
        documentReferences:
          newData.documentReferences || prev.documentReferences,
        medicalData: newData.medicalData || prev.medicalData,
      }));
    } catch (error) {
      console.error(`Error loading data for tab ${tabName}:`, error);
    } finally {
      setTabLoading((prev) => ({ ...prev, [tabName]: false }));
    }
  };

  // Add pagination handler
  const handleResourcePageChange = async (resourceType, newPage) => {
    try {
      setTabLoading((prev) => ({ ...prev, [activeTab]: true }));

      const offset = (newPage - 1) * CONFIG.ui.defaultPageSize;
      const response = await api.getPatientResources(
        patientId,
        resourceType,
        CONFIG.ui.defaultPageSize,
        newPage,
        offset
      );

      if (response.success) {
        if (resourceType === "Observation") {
          const transformedObs = (response.data || []).map((obs) => {
            return {
              ...obs,
              code_display:
                obs.code?.text ||
                obs.code?.coding?.[0]?.display ||
                obs.code?.display ||
                "Unknown",
              effective_date:
                obs.effectiveDateTime ||
                obs.effectivePeriod?.start ||
                obs.issued ||
                obs.meta?.lastUpdated,
              value_quantity:
                obs.valueQuantity?.value ||
                obs.valueString ||
                (obs.valueBoolean !== undefined
                  ? obs.valueBoolean
                    ? "True"
                    : "False"
                  : null),
              value_unit: obs.valueQuantity?.unit || "",
            };
          });
          setObservations(transformedObs);
        } else if (resourceType === "DiagnosticReport") {
          const transformedReports = (response.data || []).map((report) => ({
            ...report,
            source_filename: `${report.resourceType || "DiagnosticReport"}_${
              report.id || "unknown"
            }.fhir`,
            date:
              report.effectiveDateTime ||
              report.issued ||
              report.meta?.lastUpdated,
          }));
          setDiagnosticReports(transformedReports);
        } else if (resourceType === "DocumentReference") {
          const transformedDocs = (response.data || []).map((doc) => ({
            ...doc,
            source_filename: `${doc.resourceType || "DocumentReference"}_${
              doc.id || "unknown"
            }.fhir`,
            date:
              doc.date ||
              doc.effectiveDateTime ||
              doc.issued ||
              doc.meta?.lastUpdated,
          }));
          setDocumentReferences(transformedDocs);
        }

        // Update pagination state
        if (response.pagination) {
          setResourcePagination((prev) => ({
            ...prev,
            [resourceType === "Observation"
              ? "observations"
              : resourceType === "DiagnosticReport"
              ? "diagnosticReports"
              : "documentReferences"]: response.pagination,
          }));
        }
      }
    } catch (error) {
      console.error(
        `Error loading page ${newPage} for ${resourceType}:`,
        error
      );
    } finally {
      setTabLoading((prev) => ({ ...prev, [activeTab]: false }));
    }
  };

  const loadAvailableResources = async () => {
    try {
      console.log("🔍 Loading available resources from FHIR metadata...");

      // Use the new metadata API to get supported resources
      const metadataResponse = await api.getSupportedResources();

      if (metadataResponse.success && metadataResponse.supported_resources) {
        const resourceTypes = metadataResponse.supported_resources;
        console.log("📋 Supported resources from FHIR server:", resourceTypes);

        // Define which resources are handled by fixed tabs (dynamic based on actual implementation)
        const fixedTabResources = [
          "Patient", // Patient demographics handled by general tab
          "Observation", // Handled by measurements and labs tabs
          "DiagnosticReport", // Handled by labs and notes tabs
          "DocumentReference", // Handled by notes tab
        ];

        const resources = resourceTypes
          .filter(
            (resourceType) =>
              // Exclude resources that are already handled by fixed tabs
              !fixedTabResources.includes(resourceType)
          )
          .map((resourceType) => ({
            id: resourceType, // Keep proper capitalization for FHIR API calls
            label: resourceType,
            description: getResourceDescription(resourceType),
            icon: getResourceIcon(resourceType.toLowerCase()),
            count: 0,
          }));

        setAvailableResources(resources);
      } else {
        console.warn("⚠️ Metadata API failed, falling back to legacy method");
        // Fallback to old method if metadata API fails
        const resourceTypes = await api.listResourceTypes();

        const resources = resourceTypes
          .filter(
            (resourceType) =>
              // Exclude resources that are already handled by fixed tabs
              !fixedTabResources.includes(resourceType)
          )
          .map((resourceType) => ({
            id: resourceType, // Keep proper capitalization for FHIR API calls
            label: resourceType,
            description: getResourceDescription(resourceType),
            icon: getResourceIcon(resourceType.toLowerCase()),
            count: 0,
          }));

        setAvailableResources(resources);
        console.log(
          "📋 Available resources loaded via fallback:",
          resources.length
        );
      }
    } catch (error) {
      console.error("❌ Error loading available resources:", error);
      setAvailableResources([]);
    }
  };

  const getResourceDescription = (resourceType) => {
    // Dynamic description generation based on resource type patterns
    const type = resourceType.toLowerCase();

    // Clinical data patterns
    if (type.includes("condition") || type.includes("diagnosis"))
      return "Medical conditions and diagnoses";
    if (type.includes("observation") || type.includes("vital"))
      return "Clinical observations and measurements";
    if (type.includes("procedure") || type.includes("surgery"))
      return "Medical procedures and interventions";
    if (type.includes("medication") || type.includes("drug"))
      return "Medication prescriptions and therapy";
    if (type.includes("immunization") || type.includes("vaccine"))
      return "Vaccination records and immunization";
    if (type.includes("allergy") || type.includes("intolerance"))
      return "Allergies and adverse reactions";

    // Administrative patterns
    if (type.includes("encounter") || type.includes("visit"))
      return "Healthcare visits and encounters";
    if (type.includes("patient") || type.includes("person"))
      return "Patient demographic information";
    if (type.includes("practitioner") || type.includes("provider"))
      return "Healthcare providers and practitioners";
    if (type.includes("organization") || type.includes("facility"))
      return "Healthcare organizations and facilities";
    if (type.includes("location") || type.includes("place"))
      return "Healthcare locations and facilities";

    // Care management patterns
    if (type.includes("care") && type.includes("plan"))
      return "Care plans and treatment programs";
    if (type.includes("care") && type.includes("team"))
      return "Healthcare team members and coordination";
    if (type.includes("goal") || type.includes("target"))
      return "Patient goals and treatment targets";
    if (type.includes("appointment") || type.includes("schedule"))
      return "Scheduled appointments and bookings";

    // Documentation patterns
    if (type.includes("document") || type.includes("reference"))
      return "Clinical documents and references";
    if (type.includes("diagnostic") && type.includes("report"))
      return "Diagnostic test results and reports";
    if (type.includes("imaging") || type.includes("study"))
      return "Medical imaging studies and scans";
    if (type.includes("media") || type.includes("photo"))
      return "Photos, videos, and media attachments";

    // Administrative patterns
    if (type.includes("coverage") || type.includes("insurance"))
      return "Insurance coverage and benefits";
    if (type.includes("account") || type.includes("billing"))
      return "Billing and financial information";
    if (type.includes("device") || type.includes("equipment"))
      return "Medical devices and equipment";
    if (type.includes("family") || type.includes("history"))
      return "Family medical history records";
    if (type.includes("provenance") || type.includes("audit"))
      return "Record provenance and audit trail";

    // Request/workflow patterns
    if (type.includes("request") || type.includes("order"))
      return "Service and procedure requests";
    if (type.includes("task") || type.includes("workflow"))
      return "Clinical tasks and workflow items";
    if (type.includes("communication") || type.includes("message"))
      return "Clinical communications and messages";

    // Default for unknown types
    return `${resourceType} healthcare data from FHIR server`;
  };

  const getResourceIcon = (resourceType) => {
    // Dynamic icon generation based on resource type patterns
    const type = resourceType.toLowerCase();

    // Clinical data icons
    if (type.includes("condition") || type.includes("diagnosis")) return "🏥";
    if (type.includes("observation") || type.includes("vital")) return "📊";
    if (type.includes("procedure") || type.includes("surgery")) return "⚕️";
    if (type.includes("medication") || type.includes("drug")) return "💊";
    if (type.includes("immunization") || type.includes("vaccine")) return "💉";
    if (type.includes("allergy") || type.includes("intolerance")) return "⚠️";

    // People and organizations
    if (type.includes("patient") || type.includes("person")) return "👤";
    if (type.includes("practitioner") || type.includes("provider")) return "👨‍⚕️";
    if (type.includes("organization") || type.includes("facility")) return "🏢";
    if (type.includes("location") || type.includes("place")) return "📍";

    // Care management
    if (type.includes("care") && type.includes("plan")) return "📋";
    if (type.includes("care") && type.includes("team")) return "👥";
    if (type.includes("goal") || type.includes("target")) return "🎯";
    if (type.includes("encounter") || type.includes("visit")) return "📅";
    if (type.includes("appointment") || type.includes("schedule")) return "🗓️";

    // Documentation and media
    if (type.includes("document") || type.includes("reference")) return "📄";
    if (type.includes("diagnostic") && type.includes("report")) return "📋";
    if (type.includes("imaging") || type.includes("study")) return "🖼️";
    if (type.includes("media") || type.includes("photo")) return "📸";

    // Administrative
    if (type.includes("coverage") || type.includes("insurance")) return "🛡️";
    if (type.includes("account") || type.includes("billing")) return "💰";
    if (type.includes("device") || type.includes("equipment")) return "🔧";
    if (type.includes("family") || type.includes("history")) return "👨‍👩‍👧‍👦";
    if (type.includes("provenance") || type.includes("audit")) return "📜";

    // Requests and workflow
    if (type.includes("request") || type.includes("order")) return "📝";
    if (type.includes("task") || type.includes("workflow")) return "⚡";
    if (type.includes("communication") || type.includes("message")) return "💬";

    // Default for unknown types
    return "📋";
  };

  // ENHANCED: Dynamic tab addition with immediate display and background loading
  const handleAddTab = async (resourceType) => {
    try {
      setShowAddTabModal(false);

      // Check if tab already exists
      if (dynamicTabs.find((tab) => tab.resourceType === resourceType)) {
        console.log(`Tab for ${resourceType} already exists`);
        return;
      }

      console.log("Adding dynamic tab for resource type:", resourceType);

      // Create tab immediately with empty data to show it right away
      const newTabId = `${resourceType.toLowerCase()}-${Date.now()}`;
      const emptyTab = {
        id: newTabId,
        resourceType: resourceType,
        label: resourceType,
        data: [],
        originalData: [],
        schema: [],
        count: 0,
        loading: true, // Flag to show loading state
      };

      // Add tab immediately and switch to it
      setDynamicTabs((prev) => [...prev, emptyTab]);
      setActiveTab(newTabId);

      console.log(`Dynamic tab created immediately: ${resourceType}`);

      // Now load data in the background
      loadTabDataInBackground(newTabId, resourceType);
    } catch (error) {
      console.error("Error adding dynamic tab:", error);
      alert(`Failed to create ${resourceType} tab: ${error.message}`);
    }
  };

  // Background data loading function
  const loadTabDataInBackground = async (tabId, resourceType) => {
    try {
      console.log(`Loading data for ${resourceType} tab in background...`);

      // Get schema and data in parallel for faster loading
      const [schemaResponse, resourceData] = await Promise.all([
        api.getResourceSchema(resourceType, null, 10),
        getResourceDataForTab(resourceType),
      ]);

      const schema = schemaResponse.success
        ? schemaResponse.inferred_schema?.full_column_list || []
        : [];
      setResourceSchemas((prev) => ({ ...prev, [resourceType]: schema }));

      // Transform data to flatten nested structures for table display
      const transformedData = resourceData.map((resource) => {
        const flattened = api.flattenResource(resource, 3);

        return {
          ...flattened,
          id: resource.id || "N/A",
          resourceType: resource.resourceType || resourceType,
          status: resource.status || "unknown",
          date:
            resource.date ||
            resource.effectiveDateTime ||
            resource.authoredOn ||
            resource.issued ||
            resource.recorded ||
            resource.performedDateTime ||
            "N/A",
          display:
            resource.code?.text ||
            resource.code?.display ||
            resource.name ||
            resource.title ||
            resource.type?.text ||
            "N/A",
          patient_reference:
            resource.subject?.reference || resource.patient?.reference || "N/A",
        };
      });

      // Update the tab with loaded data
      setDynamicTabs((prev) =>
        prev.map((tab) =>
          tab.id === tabId
            ? {
                ...tab,
                data: transformedData,
                originalData: resourceData,
                schema: schema,
                count: transformedData.length,
                loading: false,
              }
            : tab
        )
      );

      console.log(
        `Dynamic tab data loaded: ${resourceType} (${transformedData.length} items)`
      );
    } catch (error) {
      console.error(`Error loading data for ${resourceType} tab:`, error);

      // Update tab to show error state
      setDynamicTabs((prev) =>
        prev.map((tab) =>
          tab.id === tabId
            ? { ...tab, loading: false, error: error.message }
            : tab
        )
      );
    }
  };

  // Helper function to get resource data (reuses existing logic)
  const getResourceDataForTab = async (resourceType) => {
    const medicalDataKey = generateMedicalDataKey(resourceType);

    // Check if we already have this data loaded
    if (
      medicalDataKey &&
      medicalData[medicalDataKey] &&
      medicalData[medicalDataKey].length > 0
    ) {
      console.log(`Reusing existing medical data for ${resourceType}`);
      return medicalData[medicalDataKey];
    } else if (
      allResourceData[resourceType] &&
      allResourceData[resourceType].length > 0
    ) {
      console.log(`Reusing cached resource data for ${resourceType}`);
      return allResourceData[resourceType];
    } else {
      // Fetch fresh data from server
      console.log(`Fetching ${resourceType} data from server...`);
      const response = await api.getPatientResources(
        patientId,
        resourceType,
        100
      );

      if (response.success) {
        const resourceData = response.data || [];
        // Cache for future use
        setAllResourceData((prev) => ({
          ...prev,
          [resourceType]: resourceData,
        }));
        return resourceData;
      } else {
        console.warn(`No ${resourceType} data found:`, response.message);
        return [];
      }
    }
  };

  const handleRemoveTab = (tabId) => {
    setDynamicTabs((prev) => prev.filter((tab) => tab.id !== tabId));

    if (activeTab === tabId) {
      setActiveTab("general");
    }
  };

  const getFilteredAvailableResources = () => {
    const existingResourceTypes = dynamicTabs.map((tab) => tab.resourceType);
    return availableResources.filter(
      (resource) => !existingResourceTypes.includes(resource.id)
    );
  };

  const getTabCounts = () => {
    const counts = {};

    // Include counts from already loaded data
    Object.keys(allResourceData).forEach((key) => {
      const resourceData = allResourceData[key];
      if (Array.isArray(resourceData)) {
        counts[key] = resourceData.length;
      }
    });

    // Add counts for available resources
    availableResources.forEach((resource) => {
      if (!counts[resource.id]) {
        counts[resource.id] = 0;
      }
    });

    return counts;
  };

  // Fully dynamic categorization using FHIR category data
  const categorizeObservation = (obs) => {
    // First, try to use FHIR category if available
    if (obs.category && obs.category.length > 0) {
      const category = obs.category[0];
      if (category.coding && category.coding.length > 0) {
        return (
          category.coding[0].display || category.coding[0].code || "Observation"
        );
      } else if (category.text) {
        return category.text;
      }
    }

    // Fallback to using code system if available
    if (obs.code && obs.code.coding && obs.code.coding.length > 0) {
      const coding = obs.code.coding[0];
      if (coding.system) {
        if (coding.system.includes("loinc")) {
          return "LOINC Observation";
        } else if (coding.system.includes("snomed")) {
          return "SNOMED Observation";
        }
      }
    }

    // Final fallback - use display text or 'Observation'
    return obs.code?.text || obs.code_display || "Observation";
  };

  const applyFiltersAndSorting = () => {
    // Apply filters if we have any data to process
    const hasData =
      originalData.observations.length > 0 ||
      originalData.diagnosticReports.length > 0 ||
      originalData.documentReferences.length > 0 ||
      Object.values(originalData.medicalData || {}).some(
        (arr) => Array.isArray(arr) && arr.length > 0
      );

    if (!hasData) return;

    let filteredObservations = [...originalData.observations];
    let filteredDiagnosticReports = [...originalData.diagnosticReports];
    let filteredDocumentReferences = [...originalData.documentReferences];
    let filteredMedicalData = { ...originalData.medicalData };

    // Apply date filter
    if (filters.dateRange.start || filters.dateRange.end) {
      const startDate = filters.dateRange.start
        ? new Date(filters.dateRange.start)
        : new Date("1900-01-01");
      const endDate = filters.dateRange.end
        ? new Date(filters.dateRange.end)
        : new Date("2100-12-31");

      filteredObservations = filteredObservations.filter((item) => {
        const itemDate = new Date(
          item.effectiveDateTime || item.effective_date
        );
        return itemDate >= startDate && itemDate <= endDate;
      });

      filteredDiagnosticReports = filteredDiagnosticReports.filter((item) => {
        const itemDate = new Date(item.effectiveDateTime || item.issued);
        return itemDate >= startDate && itemDate <= endDate;
      });
    }

    // Apply category filter
    if (filters.categories.length > 0) {
      filteredObservations = filteredObservations.filter((item) => {
        const category = categorizeObservation(item);
        return filters.categories.includes(category);
      });
    }

    // Apply status filter
    if (filters.status.length > 0) {
      filteredObservations = filteredObservations.filter((item) =>
        filters.status.includes(item.status)
      );

      filteredDiagnosticReports = filteredDiagnosticReports.filter((item) =>
        filters.status.includes(item.status)
      );
    }

    // Apply search term filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();

      filteredObservations = filteredObservations.filter(
        (item) =>
          (item.code?.text || item.code_display || "")
            .toLowerCase()
            .includes(searchLower) ||
          (item.valueQuantity?.value || item.value_quantity || "")
            .toString()
            .toLowerCase()
            .includes(searchLower)
      );

      filteredDiagnosticReports = filteredDiagnosticReports.filter((item) =>
        (item.code?.text || item.code_display || "")
          .toLowerCase()
          .includes(searchLower)
      );
    }

    // Apply sorting
    if (sortConfig.key) {
      const sortData = (data) => {
        return [...data].sort((a, b) => {
          let aVal = a[sortConfig.key];
          let bVal = b[sortConfig.key];

          // Handle date sorting
          if (
            sortConfig.key.includes("date") ||
            sortConfig.key.includes("Date")
          ) {
            aVal = new Date(aVal || "1900-01-01");
            bVal = new Date(bVal || "1900-01-01");
          }

          // Handle numeric sorting
          if (typeof aVal === "string" && !isNaN(Number(aVal))) {
            aVal = Number(aVal);
            bVal = Number(bVal);
          }

          if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
          if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
          return 0;
        });
      };

      filteredObservations = sortData(filteredObservations);
      filteredDiagnosticReports = sortData(filteredDiagnosticReports);
    }

    // Set filtered data
    setObservations(filteredObservations);
    setDiagnosticReports(filteredDiagnosticReports);
    setDocumentReferences(filteredDocumentReferences);
    setMedicalData(filteredMedicalData);
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const clearFilters = () => {
    setFilters({
      dateRange: { start: "", end: "" },
      categories: [],
      status: [],
      types: [],
      searchTerm: "",
    });
    setSortConfig({ key: null, direction: "asc" });
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  // ENHANCED: Back button with state restoration
  const handleBackClick = () => {
    if (onBackToList) {
      onBackToList();
    } else {
      window.history.back();
    }
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="patient-details-loading">
          <h2>Loading patient data from FHIR server...</h2>
        </div>
      );
    }

    if (error) {
      return (
        <div className="patient-details-error">
          <h2>Unable to Load Patient Data</h2>
          <p>Error: {error}</p>
          <button onClick={() => loadBasicPatientData()}>Try Again</button>
        </div>
      );
    }

    if (!patientData) {
      return <div className="empty-state">Patient data not found</div>;
    }

    const commonProps = {
      onSort: handleSort,
      sortConfig: sortConfig,
      filters: filters,
      onFilterChange: handleFilterChange,
    };

    // Check if it's a dynamic tab
    const dynamicTab = dynamicTabs.find((tab) => tab.id === activeTab);
    if (dynamicTab) {
      return (
        <DynamicResourceTab
          resourceType={dynamicTab.resourceType}
          resourceLabel={dynamicTab.label}
          resourceData={dynamicTab.data}
          originalData={dynamicTab.originalData}
          schema={dynamicTab.schema}
          patientId={patientId}
          onRemoveTab={() => handleRemoveTab(dynamicTab.id)}
          onSort={handleSort}
          sortConfig={sortConfig}
          filters={filters}
          loading={dynamicTab.loading || false}
          error={dynamicTab.error || null}
        />
      );
    }

    // Show loading state for tabs that are currently being loaded
    if (tabLoading[activeTab]) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "400px",
            flexDirection: "column",
            gap: "15px",
          }}
        >
          <div style={{ fontSize: "32px" }}>⏳</div>
          <h3>
            Loading{" "}
            {activeTab === "general"
              ? "General Information"
              : activeTab === "measurements"
              ? "Measurements"
              : activeTab === "labs"
              ? "Laboratory Data"
              : "Notes"}{" "}
            Data
          </h3>
          <p>Fetching data from FHIR server...</p>
        </div>
      );
    }

    // Fixed tabs
    switch (activeTab) {
      case "measurements":
        return (
          <Measurements
            observations={observations}
            patientId={patientId}
            pagination={resourcePagination.observations}
            onPageChange={(newPage) =>
              handleResourcePageChange("Observation", newPage)
            }
            loading={tabLoading.measurements}
            {...commonProps}
          />
        );
      case "labs":
        return (
          <LabsContainer
            observations={observations}
            diagnosticReports={diagnosticReports}
            patientId={patientId}
            pagination={resourcePagination.observations}
            onPageChange={(newPage) =>
              handleResourcePageChange("Observation", newPage)
            }
            loading={tabLoading.labs}
            {...commonProps}
          />
        );
      case "notes":
        return (
          <Notes
            documentReferences={documentReferences}
            diagnosticReports={diagnosticReports}
            patientId={patientId}
            pagination={{
              documentReferences: resourcePagination.documentReferences,
              diagnosticReports: resourcePagination.diagnosticReports,
            }}
            onPageChange={(resourceType, newPage) => {
              const fhirResourceType =
                resourceType === "documentReferences"
                  ? "DocumentReference"
                  : "DiagnosticReport";
              handleResourcePageChange(fhirResourceType, newPage);
            }}
            loading={tabLoading.notes}
          />
        );
      default:
        return (
          <GeneralInformation
            patientData={patientData}
            patientId={patientId}
            {...commonProps}
          />
        );
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f5f5f5",
        }}
      >
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ fontSize: "48px", marginBottom: "20px" }}>⏳</div>
          <h2 style={{ color: "#333", marginBottom: "10px" }}>
            Loading Patient Details
          </h2>
          <p style={{ color: "#666" }}>Fetching data from FHIR server...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f5f5f5",
        }}
      >
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div
            style={{ fontSize: "48px", marginBottom: "20px", color: "#dc3545" }}
          >
            ⚠️
          </div>
          <h2 style={{ color: "#dc3545", marginBottom: "10px" }}>
            Patient Not Found
          </h2>
          <p style={{ color: "#666", marginBottom: "20px" }}>Error: {error}</p>
          <button
            onClick={handleBackClick}
            style={{
              padding: "12px 24px",
              background: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: "500",
              marginRight: "10px",
            }}
          >
            Back to Patient List
          </button>
          <button
            onClick={() => loadBasicPatientData()}
            style={{
              padding: "12px 24px",
              background: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: "500",
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="patient-details">
      {/* ENHANCED Header with Navigation */}
      <div className="patient-details-header">
        <button className="back-button" onClick={handleBackClick}>
          ← Back to Patient List
        </button>
        {patientData && (
          <div>
            <h1>
              {patientData.given_name} {patientData.family_name}
            </h1>
            <p className="patient-id">Patient ID: {patientData.id}</p>
          </div>
        )}
      </div>

      {/* ENHANCED Tabs with Dynamic Resource Support */}
      <div className="tabs-container">
        <div className="tabs">
          {/* Fixed Tabs */}
          <button
            className={`tab ${activeTab === "general" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("general");
              loadTabData("general");
            }}
            disabled={tabLoading.general}
          >
            General Information {tabLoading.general && "⏳"}
          </button>
          <button
            className={`tab ${activeTab === "measurements" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("measurements");
              loadTabData("measurements");
            }}
            disabled={tabLoading.measurements}
          >
            Measurements {tabLoading.measurements && "⏳"}
          </button>
          <button
            className={`tab ${activeTab === "labs" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("labs");
              loadTabData("labs");
            }}
            disabled={tabLoading.labs}
          >
            Labs {tabLoading.labs && "⏳"}
          </button>
          <button
            className={`tab ${activeTab === "notes" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("notes");
              loadTabData("notes");
            }}
            disabled={tabLoading.notes}
          >
            Notes {tabLoading.notes && "⏳"}
          </button>

          {/* Dynamic Tabs */}
          {dynamicTabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab dynamic-tab ${
                activeTab === tab.id ? "active" : ""
              }`}
              onClick={() => setActiveTab(tab.id)}
              style={{ position: "relative" }}
            >
              <span>{tab.label}</span>
              <span
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTab(tab.id);
                }}
                title="Remove tab"
                style={{
                  marginLeft: "8px",
                  padding: "2px 6px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                ×
              </span>
            </button>
          ))}

          {/* Add Tab Button */}
          <button
            className="tab add-tab-btn"
            onClick={() => {
              // Load available resources only when user wants to add a tab
              if (availableResources.length === 0) {
                loadAvailableResources();
              }
              setShowAddTabModal(true);
            }}
            title="Add resource tab"
            style={{
              background: "#28a745",
              color: "white",
              border: "none",
              padding: "0.75rem 1rem",
              cursor: "pointer",
              fontSize: "1.2rem",
              fontWeight: "600",
              transition: "all 0.2s ease",
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="content">{renderTabContent()}</div>

      {/* ENHANCED Add Tab Modal with Schema Support */}
      {showAddTabModal && (
        <AddTabModal
          availableResources={getFilteredAvailableResources()}
          tabCounts={getTabCounts()}
          onAddTab={handleAddTab}
          onClose={() => setShowAddTabModal(false)}
        />
      )}
    </div>
  );
};

export default PatientDetails;
