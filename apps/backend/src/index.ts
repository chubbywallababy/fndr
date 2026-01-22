import express from 'express';
import cors from 'cors';
import { processFayette } from './states/kentucky/fayette';
import { processClark } from './states/nevada/clark';
import { COUNTY_CONFIGS, ProcessRequest, ProcessResponse, CountyId, FayetteInputs, ClarkInputs } from './types';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get county configurations
app.get('/api/counties', (req, res) => {
  res.json(Object.values(COUNTY_CONFIGS));
});

// Get configuration for a specific county
app.get('/api/counties/:countyId', (req, res) => {
  const { countyId } = req.params;
  const config = COUNTY_CONFIGS[countyId as CountyId];
  
  if (!config) {
    return res.status(404).json({ error: 'County not found' });
  }
  
  res.json(config);
});

// Process request endpoint
app.post('/api/process', async (req, res) => {
  try {
    const { countyId, inputs }: ProcessRequest = req.body;

    if (!countyId || !COUNTY_CONFIGS[countyId as CountyId]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid county ID',
      } as ProcessResponse);
    }

    let results;

    switch (countyId) {
      case 'fayette-ky':
        // Validate and cast inputs for Fayette
        if (!inputs.startDate || !inputs.endDate) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: startDate and endDate are required',
          } as ProcessResponse);
        }
        results = await processFayette({
          startDate: inputs.startDate,
          endDate: inputs.endDate,
          cookie: inputs.cookie,
          ignoreAddresses: inputs.ignoreAddresses ? (typeof inputs.ignoreAddresses === 'string' ? JSON.parse(inputs.ignoreAddresses) : inputs.ignoreAddresses) : undefined,
        } as FayetteInputs);
        break;
      case 'clark-nv':
        results = await processClark(inputs as ClarkInputs);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'County processor not implemented',
        } as ProcessResponse);
    }

    res.json({
      success: true,
      results,
    } as ProcessResponse);
  } catch (error: any) {
    console.error('Process error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    } as ProcessResponse);
  }
});

// Start server when this file is executed
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoint: http://localhost:${PORT}/api/counties`);
});

export default app;
