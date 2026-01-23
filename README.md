# Land Records Processor

An Nx monorepo application for processing land records from various counties. The project consists of a React frontend and a Node.js/Express backend, both written in TypeScript.

## Project Structure

```
fndr/
├── apps/
│   ├── backend/          # Node.js/Express API server
│   │   └── src/
│   │       ├── states/    # Organized by state/county
│   │       │   ├── kentucky/
│   │       │   │   └── fayette/  # Fayette County, KY processor
│   │       │   └── nevada/
│   │       │       └── clark/    # Clark County, NV processor (placeholder)
│   │       ├── types.ts  # Shared types and county configurations
│   │       └── index.ts  # Express server
│   └── frontend/          # React application
│       └── src/
│           ├── App.tsx    # Main application component
│           └── types.ts   # Frontend types
├── netlify.toml           # Netlify deployment configuration
└── package.json
```

## Features

- **Dynamic County Selection**: Frontend automatically adapts input fields based on selected county
- **State/County Organization**: Backend processors organized by state and county
- **TypeScript**: Full TypeScript support across frontend and backend
- **Netlify Ready**: Configured for Netlify deployment

## Supported Counties

### Fayette County, Kentucky
- **Inputs**: Start Date, End Date (MM/DD/YYYY format), Optional Session Cookie
- **Functionality**: Scrapes land records from fayettedeeds.com and extracts addresses from PDFs

### Clark County, Nevada
- **Status**: Placeholder implementation (to be completed)

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Make sure you install OCR depedencies here - https://github.com/yakovmeister/pdf2image/blob/HEAD/docs/gm-installation.md

### Installation

```bash
npm install
```

### Development

Start the backend server:
```bash
npm run start:backend
```

In another terminal, start the frontend:
```bash
npm run start:frontend
```

The frontend will be available at `http://localhost:3000`
The backend API will be available at `http://localhost:3001`

### Building

Build both applications:
```bash
npm run build
```

Build individually:
```bash
npm run build:backend
npm run build:frontend
```

## API Endpoints

### `GET /api/counties`
Returns list of all available counties and their input configurations.

### `GET /api/counties/:countyId`
Returns configuration for a specific county.

### `POST /api/process`
Processes a request for a specific county.

**Request Body:**
```json
{
  "countyId": "fayette-ky",
  "inputs": {
    "startDate": "01/13/2026",
    "endDate": "01/30/2026",
    "cookie": "PHPSESSID=..." // optional
  }
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "document-id",
      "addresses": ["123 Main St", "456 Oak Ave"],
      "pdfUrl": "https://..."
    }
  ]
}
```

## Adding a New County

1. Create a new directory under `apps/backend/src/states/[state]/[county]/`
2. Create an `index.ts` file with:
   - Input interface (e.g., `CountyInputs`)
   - Result interface (e.g., `CountyResult`)
   - Processing function (e.g., `processCounty`)
3. Add county configuration to `apps/backend/src/types.ts`:
   - Add county ID to `CountyId` type
   - Add configuration to `COUNTY_CONFIGS` object
4. Update the switch statement in `apps/backend/src/index.ts` to handle the new county

## Netlify Deployment

The project is configured for Netlify deployment. The `netlify.toml` file includes:
- Build commands
- Redirect rules for API routes
- SPA fallback routing

For production, you may need to:
1. Deploy the backend as a separate service or use Netlify Functions
2. Update the frontend API base URL via environment variable `VITE_API_BASE`

## License

MIT
