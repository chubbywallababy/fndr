import express from 'express';
import cors from 'cors';
import { processFayette } from './states/kentucky/fayette';
import { processClark } from './states/nevada/clark';
import { COUNTY_CONFIGS, ProcessRequest, ProcessResponse, CountyId, FayetteInputs, ClarkInputs } from '@fndr/types';

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
        results = await processFayette(inputs as FayetteInputs);
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

// Only start server if not imported as a module
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
  });
}

export default app;
