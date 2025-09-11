import React, { useState, useEffect } from 'react';
import * as api from './api';
import './PatientDetails.css';

const GeneralInformation = ({ patientData, patientId }) => {
  const [activeGeneralTab, setActiveGeneralTab] = useState('personal');
  const [activeMedicalTab, setActiveMedicalTab] = useState('conditions');
  const [medicalData, setMedicalData] = useState({
    conditions: [],
    encounters: [],
    procedures: [],
    medications: [],
    immunizations: [],
    careTeam: [],
    allergies: []
  });
  const [medicalDataLoading, setMedicalDataLoading] = useState(false);
  const [medicalDataLoaded, setMedicalDataLoaded] = useState(false);

  // Function to load medical data for Overview tab
  const loadMedicalData = async () => {
    if (medicalDataLoaded || medicalDataLoading) return;
    
    setMedicalDataLoading(true);
    console.log('Loading medical overview data for Overview tab...');
    
    try {
      const priorityMedicalResources = [
        'Condition', 'Encounter', 'Procedure', 'MedicationRequest', 
        'Immunization', 'CareTeam', 'AllergyIntolerance'
      ];
      
      const medicalPromises = priorityMedicalResources.map(resourceType => 
        api.getPatientResources(patientId, resourceType, 100)
      );
      
      const medicalResults = await Promise.all(medicalPromises);
      const [conditions, encounters, procedures, medications, immunizations, careTeam, allergies] = medicalResults;
      
      const newMedicalData = {
        conditions: conditions?.data || [],
        encounters: encounters?.data || [],
        procedures: procedures?.data || [],
        medications: medications?.data || [],
        immunizations: immunizations?.data || [],
        careTeam: careTeam?.data || [],
        allergies: allergies?.data || []
      };
      
      setMedicalData(newMedicalData);
      setMedicalDataLoaded(true);
      console.log('✅ Medical data loaded successfully');
    } catch (error) {
      console.error('❌ Error loading medical data:', error);
    } finally {
      setMedicalDataLoading(false);
    }
  };

  // Handle tab change with conditional data loading
  const handleTabChange = (tab) => {
    setActiveGeneralTab(tab);
    if (tab === 'overview' && !medicalDataLoaded && !medicalDataLoading) {
      loadMedicalData();
    }
  };

  if (!patientData) {
    return <div className="patient-details-loading">Loading patient data...</div>;
  }

  const renderDataTable = (title, data, columns) => (
    <div className="data-table">
      <h3>{title} ({data?.length || 0})</h3>
      <table>
        <thead>
          <tr>
            {columns.map(col => <th key={col.key}>{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map(item => (
              <tr key={item.id || Math.random()}>
                {columns.map(col => (
                  <td key={col.key}>
                    {col.render ? col.render(item[col.key], item) : (item[col.key] || 'N/A')}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem', color: '#6c757d' }}>
                No {title.toLowerCase()} found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderPersonalInformationTable = () => {
    const personalData = [
      {
        id: 'given_name',
        field: 'Given Name',
        value: patientData.given_name || 'Unknown'
      },
      {
        id: 'family_name',
        field: 'Family Name',
        value: patientData.family_name || 'Unknown'
      },
      {
        id: 'birth_date',
        field: 'Birth Date',
        value: patientData.birth_date || 'Unknown'
      },
      {
        id: 'age',
        field: 'Age',
        value: calculateAge(patientData.birth_date)
      },
      {
        id: 'gender',
        field: 'Gender',
        value: patientData.gender || 'Unknown'
      },
      {
        id: 'city',
        field: 'City',
        value: patientData.city || 'Unknown'
      },
      {
        id: 'state',
        field: 'State',
        value: patientData.state || 'Unknown'
      },
      {
        id: 'postal_code',
        field: 'Postal Code',
        value: patientData.postal_code || 'Unknown'
      },
      {
        id: 'multiple_birth',
        field: 'Multiple Birth',
        value: patientData.multipleBirthBoolean ? 'Yes' : 'No'
      },
      {
        id: 'patient_id',
        field: 'Patient ID',
        value: patientData.id || 'Unknown' // FIXED: Use patientData.id instead of combined_record_id
      }
    ];

    return renderDataTable('Personal Information', personalData, [
      { key: 'field', label: 'Field' },
      { key: 'value', label: 'Value' }
    ]);
  };

  const renderOverview = () => {
    if (medicalDataLoading) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: '300px',
          flexDirection: 'column',
          gap: '15px'
        }}>
          <div style={{ fontSize: '32px' }}>⏳</div>
          <h3>Loading Medical Overview Data</h3>
          <p>Fetching data from FHIR server...</p>
        </div>
      );
    }

    return (
      <div className="patient-details-grid">
        <div className="detail-section" style={{ borderLeft: '4px solid white' }}>
          <h3>Active Conditions</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#000', textAlign: 'center' }}>
            {medicalData?.conditions?.length || 0}
          </div>
          <div style={{ textAlign: 'center', color: '#6c757d' }}>Medical conditions</div>
        </div>
      
      <div className="detail-section" style={{ borderLeft: '4px solid white' }}>
        <h3>Total Encounters</h3>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#000', textAlign: 'center' }}>
          {medicalData?.encounters?.length || 0}
        </div>
        <div style={{ textAlign: 'center', color: '#6c757d' }}>Patient visits</div>
      </div>
      
      <div className="detail-section" style={{ borderLeft: '4px solid white' }}>
        <h3>Procedures</h3>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#000', textAlign: 'center' }}>
          {medicalData?.procedures?.length || 0}
        </div>
        <div style={{ textAlign: 'center', color: '#6c757d' }}>Medical procedures</div>
      </div>
      
      <div className="detail-section" style={{ borderLeft: '4px solid white' }}>
        <h3>Medications</h3>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#000', textAlign: 'center' }}>
          {medicalData?.medications?.length || 0}
        </div>
        <div style={{ textAlign: 'center', color: '#6c757d' }}>Medication requests</div>
      </div>
      
      <div className="detail-section" style={{ borderLeft: '4px solid white' }}>
        <h3>Immunizations</h3>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#000', textAlign: 'center' }}>
          {medicalData?.immunizations?.length || 0}
        </div>
        <div style={{ textAlign: 'center', color: '#6c757d' }}>Vaccinations</div>
      </div>
      
      <div className="detail-section" style={{ borderLeft: '4px solid white' }}>
        <h3>Care Team</h3>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#000', textAlign: 'center' }}>
          {medicalData?.careTeam?.length || 0}
        </div>
        <div style={{ textAlign: 'center', color: '#6c757d' }}>Care team members</div>
      </div>
      
      <div className="detail-section" style={{ borderLeft: '4px solid white' }}>
        <h3>Allergies</h3>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#000', textAlign: 'center' }}>
          {medicalData?.allergies?.length || 0}
        </div>
        <div style={{ textAlign: 'center', color: '#6c757d' }}>Known allergies</div>
      </div>
    </div>
    );
  };

  const renderMedicalSummaryTable = () => {
    const summaryData = [
      {
        id: 'conditions',
        category: 'Active Conditions',
        count: medicalData?.conditions?.length || 0,
        description: 'Medical conditions'
      },
      {
        id: 'encounters',
        category: 'Total Encounters',
        count: medicalData?.encounters?.length || 0,
        description: 'Patient visits'
      },
      {
        id: 'procedures',
        category: 'Procedures',
        count: medicalData?.procedures?.length || 0,
        description: 'Medical procedures'
      },
      {
        id: 'medications',
        category: 'Medications',
        count: medicalData?.medications?.length || 0,
        description: 'Medication requests'
      },
      {
        id: 'immunizations',
        category: 'Immunizations',
        count: medicalData?.immunizations?.length || 0,
        description: 'Vaccinations'
      },
      {
        id: 'careTeam',
        category: 'Care Team',
        count: medicalData?.careTeam?.length || 0,
        description: 'Care team members'
      },
      {
        id: 'allergies',
        category: 'Allergies',
        count: medicalData?.allergies?.length || 0,
        description: 'Known allergies'
      }
    ];

    return renderDataTable('Medical Summary', summaryData, [
      { key: 'category', label: 'Category' },
      { key: 'count', label: 'Count' },
      { key: 'description', label: 'Description' }
    ]);
  };

  const renderConditions = () => {
    // Debug logging for conditions data
    console.log('🏥 GeneralInformation conditions data:', medicalData?.conditions?.length || 0);
    if (medicalData?.conditions?.length > 0) {
      console.log('📊 Sample condition data:', medicalData.conditions.slice(0, 2).map(condition => ({
        id: condition.id,
        code_text: condition.code?.text,
        code_display: condition.code?.coding?.[0]?.display,
        clinicalStatus: condition.clinicalStatus?.coding?.[0]?.display,
        resourceType: condition.resourceType
      })));
    }

    const statusRender = (value) => <span className={`status ${(value || 'unknown').toLowerCase()}`}>{value || 'Unknown'}</span>;
    const dateRender = (value) => {
      if (!value) return 'Unknown';
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return value;
      }
    };
    
    // Render condition name from FHIR code structure
    const conditionNameRender = (value, item) => {
      const conditionName = item.code?.text || 
                           item.code?.coding?.[0]?.display || 
                           item.code?.coding?.[0]?.code || 
                           'Unknown Condition';
      return <strong style={{ color: '#2c3e50' }}>{conditionName}</strong>;
    };
    
    // Render clinical status with proper formatting
    const clinicalStatusRender = (value, item) => {
      const clinicalStatus = item.clinicalStatus?.coding?.[0]?.display || 
                           item.clinicalStatus?.coding?.[0]?.code || 
                           item.status || 'Unknown';
      return <span className={`status ${clinicalStatus.toLowerCase()}`}>{clinicalStatus}</span>;
    };

    // Additional dynamic renderers for rich FHIR fields
    const severityRender = (value, item) => {
      const severity = item.severity?.coding?.[0]?.display || 
                      item.severity?.coding?.[0]?.code || 'Unknown';
      const severityColor = severity.toLowerCase() === 'severe' ? '#e74c3c' : 
                           severity.toLowerCase() === 'mild' ? '#f39c12' : '#95a5a6';
      return <span style={{ color: severityColor, fontWeight: 'bold' }}>{severity}</span>;
    };

    const verificationStatusRender = (value, item) => {
      const verification = item.verificationStatus?.coding?.[0]?.display || 
                          item.verificationStatus?.coding?.[0]?.code || 'Unknown';
      return <span className={`verification ${verification.toLowerCase()}`}>{verification}</span>;
    };

    const categoryRender = (value, item) => {
      const categories = item.category || [];
      const categoryLabels = categories.map(cat => 
        cat.coding?.[0]?.display || cat.coding?.[0]?.code || 'Unknown'
      ).join(', ');
      return categoryLabels || 'Unknown';
    };

    const bodySiteRender = (value, item) => {
      const bodySites = item.bodySite || [];
      const bodySiteLabels = bodySites.map(site => 
        site.coding?.[0]?.display || site.coding?.[0]?.code || 'Unknown'
      ).join(', ');
      return bodySiteLabels || 'N/A';
    };

    const onsetRender = (value, item) => {
      if (item.onsetDateTime) {
        return dateRender(item.onsetDateTime);
      } else if (item.onsetString) {
        return item.onsetString;
      } else if (item.onsetAge?.value) {
        return `Age ${item.onsetAge.value} ${item.onsetAge.unit || 'years'}`;
      }
      return 'Unknown';
    };

    const abatementRender = (value, item) => {
      if (item.abatementDateTime) {
        return dateRender(item.abatementDateTime);
      } else if (item.abatementString) {
        return item.abatementString;
      } else if (item.abatementAge?.value) {
        return `Age ${item.abatementAge.value} ${item.abatementAge.unit || 'years'}`;
      }
      return 'N/A';
    };

    const recorderRender = (value, item) => {
      return item.recorder?.display || item.asserter?.display || 'Unknown';
    };

    return renderDataTable('Active Conditions', medicalData?.conditions, [
      { key: 'code', label: 'Condition Name', render: conditionNameRender },
      { key: 'clinicalStatus', label: 'Clinical Status', render: clinicalStatusRender },
      { key: 'verificationStatus', label: 'Verification', render: verificationStatusRender },
      { key: 'severity', label: 'Severity', render: severityRender },
      { key: 'category', label: 'Category', render: categoryRender },
      { key: 'bodySite', label: 'Body Site', render: bodySiteRender },
      { key: 'onset', label: 'Onset', render: onsetRender },
      { key: 'abatement', label: 'Resolved', render: abatementRender },
      { key: 'recordedDate', label: 'Recorded Date', render: dateRender },
      { key: 'recorder', label: 'Recorded By', render: recorderRender },
      { key: 'id', label: 'ID' }
    ]);
  };

  const renderEncounters = () => {
    // Debug logging for encounters data
    console.log('🏥 Encounters data:', medicalData?.encounters?.length || 0);
    if (medicalData?.encounters?.length > 0) {
      console.log('📊 Sample encounter data:', medicalData.encounters.slice(0, 2).map(enc => ({
        id: enc.id,
        status: enc.status,
        class_display: enc.class?.display,
        type: enc.type?.[0]?.text || enc.type?.[0]?.coding?.[0]?.display,
        period: enc.period
      })));
    }

    const statusRender = (value) => <span className={`status ${(value || 'unknown').toLowerCase()}`}>{value || 'Unknown'}</span>;
    
    const encounterTypeRender = (value, item) => {
      const encounterType = item.type?.[0]?.text || 
                           item.type?.[0]?.coding?.[0]?.display || 
                           'Unknown Type';
      return <strong style={{ color: '#2980b9' }}>{encounterType}</strong>;
    };
    
    const encounterClassRender = (value, item) => {
      return item.class?.display || item.class?.code || 'Unknown';
    };
    
    const dateRender = (value) => {
      if (!value) return 'Unknown';
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return value;
      }
    };

    return renderDataTable('Total Encounters', medicalData?.encounters, [
      { key: 'type', label: 'Encounter Type', render: encounterTypeRender },
      { key: 'class', label: 'Class', render: encounterClassRender },
      { key: 'status', label: 'Status', render: statusRender },
      { key: 'period.start', label: 'Start Date', render: (value, item) => dateRender(item.period?.start) },
      { key: 'period.end', label: 'End Date', render: (value, item) => dateRender(item.period?.end) },
      { key: 'id', label: 'ID' }
    ]);
  };

  const renderProcedures = () => {
    // Debug logging for procedures data
    console.log('⚕️ Procedures data:', medicalData?.procedures?.length || 0);
    if (medicalData?.procedures?.length > 0) {
      console.log('📊 Sample procedure data:', medicalData.procedures.slice(0, 2).map(proc => ({
        id: proc.id,
        status: proc.status,
        code_text: proc.code?.text,
        code_display: proc.code?.coding?.[0]?.display,
        performedDateTime: proc.performedDateTime
      })));
    }

    const statusRender = (value) => <span className={`status ${(value || 'unknown').toLowerCase()}`}>{value || 'Unknown'}</span>;
    
    const procedureNameRender = (value, item) => {
      const procedureName = item.code?.text || 
                           item.code?.coding?.[0]?.display || 
                           item.code?.coding?.[0]?.code ||
                           'Unknown Procedure';
      return <strong style={{ color: '#27ae60' }}>{procedureName}</strong>;
    };
    
    const dateRender = (value) => {
      if (!value) return 'Unknown';
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return value;
      }
    };

    return renderDataTable('Procedures', medicalData?.procedures, [
      { key: 'code', label: 'Procedure Name', render: procedureNameRender },
      { key: 'status', label: 'Status', render: statusRender },
      { key: 'performedDateTime', label: 'Performed Date', render: dateRender },
      { key: 'id', label: 'ID' }
    ]);
  };

  const renderMedications = () => {
    // Debug logging for medications data
    console.log('💊 Medications data:', medicalData?.medications?.length || 0);
    if (medicalData?.medications?.length > 0) {
      console.log('📊 Sample medication data:', medicalData.medications.slice(0, 2).map(med => ({
        id: med.id,
        status: med.status,
        intent: med.intent,
        medicationReference: med.medicationReference,
        medicationCodeableConcept: med.medicationCodeableConcept,
        authoredOn: med.authoredOn
      })));
    }

    const statusRender = (value) => <span className={`status ${(value || 'unknown').toLowerCase()}`}>{value || 'Unknown'}</span>;
    
    const medicationNameRender = (value, item) => {
      const medicationName = item.medicationReference?.display || 
                            item.medicationCodeableConcept?.text || 
                            item.medicationCodeableConcept?.coding?.[0]?.display ||
                            item.medicationCodeableConcept?.coding?.[0]?.code ||
                            'Unknown Medication';
      return <strong style={{ color: '#e74c3c' }}>{medicationName}</strong>;
    };
    
    const dateRender = (value) => {
      if (!value) return 'Unknown';
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return value;
      }
    };

    return renderDataTable('Medication Requests', medicalData?.medications, [
      { key: 'medicationReference', label: 'Medication Name', render: medicationNameRender },
      { key: 'status', label: 'Status', render: statusRender },
      { key: 'intent', label: 'Intent' },
      { key: 'authoredOn', label: 'Authored On', render: dateRender },
      { key: 'id', label: 'ID' }
    ]);
  };

  const renderImmunizations = () => {
    // Debug logging for immunizations data
    console.log('💉 Immunizations data:', medicalData?.immunizations?.length || 0);
    if (medicalData?.immunizations?.length > 0) {
      console.log('📊 Sample immunization data:', medicalData.immunizations.slice(0, 2).map(imm => ({
        id: imm.id,
        status: imm.status,
        vaccineCode: imm.vaccineCode,
        occurrenceDateTime: imm.occurrenceDateTime,
        primarySource: imm.primarySource
      })));
    }

    const statusRender = (value) => <span className={`status ${(value || 'unknown').toLowerCase()}`}>{value || 'Unknown'}</span>;
    
    const vaccineNameRender = (value, item) => {
      const vaccineName = item.vaccineCode?.text || 
                         item.vaccineCode?.coding?.[0]?.display || 
                         item.vaccineCode?.coding?.[0]?.code ||
                         'Unknown Vaccine';
      return <strong style={{ color: '#9b59b6' }}>{vaccineName}</strong>;
    };
    
    const dateRender = (value) => {
      if (!value) return 'Unknown';
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return value;
      }
    };
    
    const booleanRender = (value) => (
      <span style={{ color: value ? '#27ae60' : '#e74c3c', fontWeight: 'bold' }}>
        {value ? 'Yes' : 'No'}
      </span>
    );

    return renderDataTable('Immunizations', medicalData?.immunizations, [
      { key: 'vaccineCode', label: 'Vaccine Name', render: vaccineNameRender },
      { key: 'status', label: 'Status', render: statusRender },
      { key: 'occurrenceDateTime', label: 'Date', render: dateRender },
      { key: 'primarySource', label: 'Primary Source', render: booleanRender },
      { key: 'id', label: 'ID' }
    ]);
  };

  const renderCareTeam = () => {
    console.log('👥 CareTeam data:', medicalData?.careTeam?.length || 0);
    
    const statusRender = (value) => <span className={`status ${(value || 'unknown').toLowerCase()}`}>{value || 'Unknown'}</span>;
    
    const participantRender = (value, item) => {
      const participants = item.participant || [];
      return participants.length > 0 ? `${participants.length} member(s)` : 'No members';
    };

    return renderDataTable('Care Team', medicalData?.careTeam, [
      { key: 'id', label: 'ID' },
      { key: 'status', label: 'Status', render: statusRender },
      { key: 'participant', label: 'Team Members', render: participantRender }
    ]);
  };

  const renderAllergies = () => {
    console.log('🤧 Allergies data:', medicalData?.allergies?.length || 0);
    
    const dateRender = (value) => {
      if (!value) return 'Unknown';
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return value;
      }
    };
    
    const allergenRender = (value, item) => {
      const allergen = item.code?.text || 
                      item.code?.coding?.[0]?.display || 
                      'Unknown Allergen';
      return <strong style={{ color: '#e67e22' }}>{allergen}</strong>;
    };
    
    const criticalityRender = (value) => (
      <span style={{ 
        color: value === 'high' ? '#e74c3c' : value === 'low' ? '#f39c12' : '#95a5a6',
        fontWeight: 'bold',
        textTransform: 'capitalize'
      }}>
        {value || 'Unknown'}
      </span>
    );

    return renderDataTable('Allergies', medicalData?.allergies, [
      { key: 'code', label: 'Allergen', render: allergenRender },
      { key: 'type', label: 'Allergy Type' },
      { key: 'criticality', label: 'Criticality', render: criticalityRender },
      { key: 'recordedDate', label: 'Recorded Date', render: dateRender },
      { key: 'id', label: 'ID' }
    ]);
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return 'Unknown';
    try {
      const today = new Date();
      const birth = new Date(birthDate);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age >= 0 ? `${age} years` : 'Unknown';
    } catch {
      return 'Unknown';
    }
  };

  const renderMedicalSummaryContent = () => {
    switch (activeMedicalTab) {
      case 'conditions':
        return renderConditions();
      case 'encounters':
        return renderEncounters();
      case 'procedures':
        return renderProcedures();
      case 'medications':
        return renderMedications();
      case 'immunizations':
        return renderImmunizations();
      case 'careTeam':
        return renderCareTeam();
      case 'allergies':
        return renderAllergies();
      default:
        return renderMedicalSummaryTable();
    }
  };

  const renderGeneralContent = () => {
    switch (activeGeneralTab) {
      case 'personal':
        return renderPersonalInformationTable();
      default:
        return renderOverview();
    }
  };

  return (
    <div className="labs-container">
      <div className="labs-tabs">
        <button 
          className={`lab-tab ${activeGeneralTab === 'personal' ? 'active' : ''}`}
          onClick={() => handleTabChange('personal')}
        >
          Personal Information
        </button>
        <button 
          className={`lab-tab ${activeGeneralTab === 'overview' ? 'active' : ''}`}
          onClick={() => handleTabChange('overview')}
          disabled={medicalDataLoading}
        >
          Overview {medicalDataLoading && '⏳'}
        </button>
      </div>
      
      <div className="labs-content">
        {renderGeneralContent()}
      </div>
    </div>
  );
};

export default GeneralInformation;