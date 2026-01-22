import React, { useState, useEffect } from 'react';
import './App.css';
import { CountyConfig, InputField, ProcessResponse } from '@fndr/types';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

function App() {
  const [counties, setCounties] = useState<CountyConfig[]>([]);
  const [selectedCounty, setSelectedCounty] = useState<CountyConfig | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch available counties
    axios.get(`${API_BASE}/api/counties`)
      .then((response) => {
        setCounties(response.data);
      })
      .catch((err) => {
        console.error('Failed to fetch counties:', err);
        setError('Failed to load counties');
      });
  }, []);

  useEffect(() => {
    // Reset inputs when county changes
    if (selectedCounty) {
      const initialInputs: Record<string, string> = {};
      selectedCounty.inputs.forEach((field) => {
        initialInputs[field.name] = '';
      });
      setInputs(initialInputs);
      setResults(null);
      setError(null);
    }
  }, [selectedCounty]);

  const handleCountyChange = (countyId: string) => {
    const county = counties.find((c) => c.id === countyId);
    setSelectedCounty(county || null);
  };

  const handleInputChange = (name: string, value: string) => {
    setInputs((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const formatDateForInput = (dateStr: string): string => {
    // Convert MM/DD/YYYY to YYYY-MM-DD for date input
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
    return dateStr;
  };

  const formatDateFromInput = (dateStr: string): string => {
    // Convert YYYY-MM-DD to MM/DD/YYYY for backend
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}/${parts[0]}`;
    }
    return dateStr;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCounty) return;

    // Validate required fields
    const missingFields = selectedCounty.inputs
      .filter((field) => field.required && !inputs[field.name])
      .map((field) => field.label);

    if (missingFields.length > 0) {
      setError(`Please fill in required fields: ${missingFields.join(', ')}`);
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    // Format dates if needed
    const formattedInputs: Record<string, string> = { ...inputs };
    selectedCounty.inputs.forEach((field) => {
      if (field.type === 'date' && formattedInputs[field.name]) {
        formattedInputs[field.name] = formatDateFromInput(formattedInputs[field.name]);
      }
    });

    try {
      const response = await axios.post<ProcessResponse>(`${API_BASE}/api/process`, {
        countyId: selectedCounty.id,
        inputs: formattedInputs,
      });

      if (response.data.success) {
        setResults(response.data.results || []);
      } else {
        setError(response.data.error || 'Processing failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  const renderInputField = (field: InputField) => {
    const value = inputs[field.name] || '';

    switch (field.type) {
      case 'date':
        return (
          <input
            type="date"
            id={field.name}
            value={formatDateForInput(value)}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            required={field.required}
            placeholder={field.placeholder}
            className="form-input"
          />
        );
      case 'select':
        return (
          <select
            id={field.name}
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            required={field.required}
            className="form-input"
          >
            <option value="">Select...</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      case 'number':
        return (
          <input
            type="number"
            id={field.name}
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            required={field.required}
            placeholder={field.placeholder}
            className="form-input"
          />
        );
      default:
        return (
          <input
            type="text"
            id={field.name}
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            required={field.required}
            placeholder={field.placeholder}
            className="form-input"
          />
        );
    }
  };

  return (
    <div className="app">
      <div className="container">
        <h1 className="title">Land Records Processor</h1>

        <div className="card">
          <label htmlFor="county-select" className="label">
            Select County
          </label>
          <select
            id="county-select"
            value={selectedCounty?.id || ''}
            onChange={(e) => handleCountyChange(e.target.value)}
            className="form-input"
          >
            <option value="">-- Select a County --</option>
            {counties.map((county) => (
              <option key={county.id} value={county.id}>
                {county.name}, {county.state}
              </option>
            ))}
          </select>
        </div>

        {selectedCounty && (
          <form onSubmit={handleSubmit} className="card">
            <h2 className="subtitle">
              {selectedCounty.name}, {selectedCounty.state}
            </h2>

            {selectedCounty.inputs.map((field) => (
              <div key={field.name} className="form-group">
                <label htmlFor={field.name} className="label">
                  {field.label}
                  {field.required && <span className="required">*</span>}
                </label>
                {renderInputField(field)}
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="submit-button"
            >
              {loading ? 'Processing...' : 'Process'}
            </button>
          </form>
        )}

        {error && (
          <div className="card error-card">
            <p className="error-message">Error: {error}</p>
          </div>
        )}

        {results && (
          <div className="card results-card">
            <h2 className="subtitle">Results</h2>
            <div className="results-content">
              <pre>{JSON.stringify(results, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
