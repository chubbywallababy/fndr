# Option 1: Autonomous County Onboarding Agent

## The Problem

Currently, adding a new county requires a human to:
1. Google "{County} {State} recorder" or "lis pendens records"
2. Navigate the county website to find the document search
3. Figure out how to search for Lis Pendens specifically
4. Understand the results format and how to get PDFs
5. Write custom scraping code for that county's structure

**Goal**: An AI agent that does steps 1-4 autonomously, given only a county name.

## The Solution: Research Agent

An autonomous agent that can:
1. **Search the web** to find the county recorder/clerk website
2. **Explore the site** to understand the Lis Pendens search process
3. **Document the process** or generate a scraper configuration
4. **Validate** by running a test search

```
┌─────────────────────────────────────────────────────────────┐
│  Input: "Jefferson County, Kentucky"                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Web Search                                          │
│  "Jefferson County Kentucky lis pendens records"             │
│  → Finds: https://jeffersoncountyclerk.org/                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Site Exploration                                    │
│  - Navigate to land records / document search                │
│  - Identify how to filter by document type                   │
│  - Find date range inputs                                    │
│  - Locate search button and results format                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Process Documentation                               │
│  Agent writes step-by-step instructions OR                   │
│  generates a JSON config for your scraper framework          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Validation                                          │
│  Run a test search, verify PDFs can be downloaded            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Output: Working scraper config + documentation              │
└─────────────────────────────────────────────────────────────┘
```

## Approaches

### Approach A: OpenClaw + Coding Agent

**OpenClaw** (https://docs.openclaw.ai/) is a gateway that connects messaging platforms to AI coding agents. The relevant piece here is the **coding agent** (Pi) that can:
- Browse the web
- Write and execute code
- Iterate on solutions

**How it would work:**

1. You message the agent (via Slack, Discord, or CLI):
   > "Onboard Jefferson County, Kentucky for Lis Pendens scraping"

2. The agent:
   - Searches for the county recorder website
   - Opens a browser and explores the site
   - Documents what it finds
   - Generates a scraper config or code
   - Tests it and reports back

**Setup with OpenClaw:**

```bash
# Install OpenClaw
npm install -g openclaw@latest

# Run the onboarding wizard
openclaw onboard --install-daemon

# Start the gateway
openclaw gateway
```

**Example conversation:**

```
You: Onboard Jefferson County, Kentucky for lis pendens scraping

Agent: I'll research Jefferson County, Kentucky's land records system.

[Agent searches web, navigates to site]

Agent: Found the Jefferson County Clerk website. Their land records 
are at https://jeffersoncountyclerk.org/landrecords/. 

I've identified the search process:
1. Navigate to Document Search
2. Select "Lis Pendens" from document type dropdown
3. Enter date range in MM/DD/YYYY format
4. Click "Search"
5. Results appear in a table with PDF links

I've generated a scraper config. Should I create the implementation file?
```

**Pros:**
- Conversational interface - can ask clarifying questions
- Can iterate ("that didn't work, try this instead")
- Integrates with your existing Slack notifications

**Cons:**
- Requires running the OpenClaw gateway
- Agent quality depends on underlying LLM
- May need human guidance for complex sites

---

### Approach B: Autonomous Browser Agent (Fully Automated)

A standalone agent that runs without human interaction during the research phase.

**Tools:**

1. **[Agent-E](https://github.com/EmergenceAI/Agent-E)** - Autonomous web agent
2. **[LaVague](https://github.com/lavague-ai/LaVague)** - Large Action Model for web automation
3. **[Skyvern](https://github.com/Skyvern-AI/skyvern)** - AI agent for browser workflows
4. **Custom agent** using browser-use + web search APIs

**Example with Skyvern:**

Skyvern is specifically designed for automating browser workflows with AI. It can:
- Navigate complex websites
- Fill forms based on natural language
- Extract structured data

```python
from skyvern import Skyvern

client = Skyvern(api_key="...")

# Define the research task
task = client.create_task(
    url="https://google.com",
    navigation_goal="""
    1. Search for "Jefferson County Kentucky lis pendens land records"
    2. Find the official county recorder/clerk website
    3. Navigate to their document search or land records section
    4. Figure out how to search for Lis Pendens documents by date range
    5. Document the exact steps needed to perform this search
    6. Identify: 
       - The search URL
       - Required form fields (date inputs, document type selector)
       - How results are displayed
       - How to get PDF links from results
    """,
    data_extraction_goal="""
    Extract:
    - Base URL for the land records search
    - Form field selectors or names
    - Document type value for "Lis Pendens"
    - Results table structure
    - PDF link pattern
    """,
)

result = client.get_task_result(task.id)
print(result.extracted_data)
```

**Pros:**
- Fully autonomous - no human in the loop
- Can batch process multiple counties
- Purpose-built for web research

**Cons:**
- Less flexible than conversational agent
- May fail silently on unusual sites
- Hosted service cost (or self-host complexity)

---

### Approach C: Multi-Agent Research System

Use multiple specialized agents that collaborate:

1. **Research Agent**: Finds and explores county websites
2. **Documentation Agent**: Writes structured process docs
3. **Code Generation Agent**: Creates scraper implementation
4. **Validation Agent**: Tests the generated scraper

**Framework options:**
- **[CrewAI](https://github.com/crewAIInc/crewAI)** - Multi-agent orchestration
- **[AutoGen](https://github.com/microsoft/autogen)** - Microsoft's multi-agent framework
- **[LangGraph](https://github.com/langchain-ai/langgraph)** - Stateful agent workflows

**Example with CrewAI:**

```python
from crewai import Agent, Task, Crew
from crewai_tools import BrowserTool, SerperDevTool

# Tools
search_tool = SerperDevTool()  # Web search
browser_tool = BrowserTool()    # Browser automation

# Agents
researcher = Agent(
    role="County Records Researcher",
    goal="Find and understand county land records systems",
    tools=[search_tool, browser_tool],
    backstory="Expert at navigating government websites and understanding record systems"
)

documenter = Agent(
    role="Technical Documenter", 
    goal="Create structured documentation of web scraping processes",
    backstory="Creates clear, actionable technical documentation"
)

# Tasks
research_task = Task(
    description="""
    Research {county_name}, {state} land records:
    1. Find the official county recorder/clerk website
    2. Locate the document search for Lis Pendens
    3. Document the search process step by step
    4. Identify all required inputs and their formats
    5. Note how results are displayed and how to get PDFs
    """,
    agent=researcher,
    expected_output="Detailed research notes on the county's Lis Pendens search process"
)

documentation_task = Task(
    description="""
    Based on the research, create a JSON configuration file with:
    - County ID and name
    - Search URL
    - Form field mappings
    - Document type selector value
    - Results parsing instructions
    - PDF URL pattern
    """,
    agent=documenter,
    expected_output="JSON configuration for the county scraper"
)

# Run
crew = Crew(
    agents=[researcher, documenter],
    tasks=[research_task, documentation_task]
)

result = crew.kickoff(inputs={
    "county_name": "Jefferson County",
    "state": "Kentucky"
})
```

**Pros:**
- Separation of concerns (research vs documentation vs coding)
- Can add human review steps between agents
- Highly customizable workflow

**Cons:**
- More complex to set up
- Multiple LLM calls = higher cost
- Debugging multi-agent systems is harder

---

### Approach D: Hybrid Human-AI Workflow

An agent does the research, human approves, agent implements.

**Workflow:**

```
┌─────────────────────────────────────────────────────────────┐
│  1. Human: "Research Franklin County, Ohio"                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Agent researches autonomously (5-10 minutes)             │
│     - Finds website                                          │
│     - Explores document search                               │
│     - Takes screenshots                                      │
│     - Documents process                                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Agent presents findings for human review                 │
│     "I found their records at franklincountyohio.gov/...     │
│      Here's how to search for Lis Pendens: [screenshots]     │
│      Proposed config: [JSON]                                 │
│      Should I proceed with implementation?"                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Human: "Looks good, implement it"                        │
│     OR "The document type is actually called 'LP', fix that" │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Agent generates and tests scraper                        │
└─────────────────────────────────────────────────────────────┘
```

**This is where OpenClaw shines** - the conversational interface makes the review/correction loop natural.

---

## Comparison

| Approach | Automation Level | Setup Complexity | Cost/County | Best For |
|----------|------------------|------------------|-------------|----------|
| A: OpenClaw + Agent | Semi-auto | Medium | ~$0.50-2 | Iterative onboarding |
| B: Skyvern/LaVague | Fully auto | Low | ~$1-5 | Batch processing |
| C: Multi-Agent | Fully auto | High | ~$2-10 | Complex workflows |
| D: Hybrid | Semi-auto | Medium | ~$0.50-2 | Quality assurance |

## Recommendation

**Start with Approach D (Hybrid) using OpenClaw:**

1. Fastest to get working
2. Human stays in the loop for edge cases
3. Builds a library of working configs you can reference
4. Can automate further once patterns emerge

**Long-term, move toward Approach B or C:**

Once you've onboarded 10-20 counties manually-ish, you'll have:
- A set of example configs
- Understanding of common patterns
- Edge cases documented

Then build a fully autonomous system that uses your examples as few-shot prompts.

---

## Implementation Plan

### Phase 1: OpenClaw Setup (Day 1)

```bash
# Install
npm install -g openclaw@latest
openclaw onboard --install-daemon

# Configure to use your preferred LLM
# Edit ~/.openclaw/openclaw.json
```

### Phase 2: Create Onboarding Prompt Template

Create a reusable prompt that guides the agent through county research:

```markdown
# County Onboarding Task

Research **{COUNTY}, {STATE}** for Lis Pendens document scraping.

## Steps

1. **Find the county recorder/clerk website**
   - Search: "{COUNTY} {STATE} recorder land records"
   - Find the official .gov or county website

2. **Locate document search**
   - Look for: "Land Records", "Document Search", "Official Records"
   - Navigate to the search interface

3. **Understand the search process**
   - How do you filter by document type? (dropdown, checkbox, text field?)
   - What's the value for Lis Pendens? (may be "LP", "LIS PENDENS", etc.)
   - How are dates entered? (MM/DD/YYYY, YYYY-MM-DD, date picker?)
   - Is authentication required?

4. **Document the results format**
   - How are results displayed? (table, list, cards?)
   - Where are the PDF links?
   - Is there pagination?

5. **Generate config**
   Create a JSON config following this template:
   ```json
   {
     "countyId": "jefferson-ky",
     "name": "Jefferson County",
     "state": "Kentucky",
     "searchUrl": "https://...",
     "requiresAuth": false,
     "formFields": {
       "documentType": { "selector": "...", "value": "LP" },
       "startDate": { "selector": "...", "format": "MM/DD/YYYY" },
       "endDate": { "selector": "...", "format": "MM/DD/YYYY" }
     },
     "resultsSelector": "...",
     "pdfLinkPattern": "..."
   }
   ```

6. **Test**
   - Run a search for the last 7 days
   - Verify at least one result appears
   - Confirm PDF links work
```

### Phase 3: Onboard Counties

Use the agent to research counties one by one, review the configs, and build your library.

### Phase 4: Automate Further

Once you have 10+ working configs, create a fully autonomous pipeline that:
1. Takes a list of counties
2. Runs research agent on each
3. Generates configs
4. Human reviews batch
5. Approved configs get deployed

---

## Alternative: Build Your Own Agent

If you want more control, here's a minimal implementation using browser-use + Serper:

```typescript
// apps/backend/src/agents/county-researcher.ts

import { Agent } from "browser-use";  // or stagehand
import { SerperClient } from "serper";

interface CountyConfig {
  countyId: string;
  name: string;
  state: string;
  searchUrl: string;
  requiresAuth: boolean;
  formFields: Record<string, { selector: string; value?: string; format?: string }>;
  resultsSelector: string;
  pdfLinkPattern: string;
}

export async function researchCounty(
  countyName: string,
  state: string
): Promise<CountyConfig> {
  const serper = new SerperClient(process.env.SERPER_API_KEY);
  
  // Step 1: Find the county website
  const searchResults = await serper.search({
    q: `${countyName} ${state} recorder land records lis pendens`,
    num: 5
  });
  
  // Filter for .gov or official county sites
  const officialSite = searchResults.organic.find(r => 
    r.link.includes('.gov') || 
    r.link.includes('county') ||
    r.title.toLowerCase().includes('official')
  );
  
  if (!officialSite) {
    throw new Error(`Could not find official site for ${countyName}, ${state}`);
  }
  
  // Step 2: Explore the site with browser agent
  const agent = new Agent({
    task: `
      You are on the ${countyName}, ${state} recorder website.
      
      Find the document search for Lis Pendens records and identify:
      1. The exact URL for the search page
      2. How to select "Lis Pendens" as document type
      3. The date input format
      4. How results are displayed
      5. Where PDF download links are
      
      Return your findings as JSON.
    `,
    startUrl: officialSite.link,
  });
  
  const findings = await agent.run();
  
  // Step 3: Generate config from findings
  const config: CountyConfig = {
    countyId: `${countyName.toLowerCase().replace(/\s+/g, '-')}-${state.toLowerCase().substring(0, 2)}`,
    name: countyName,
    state: state,
    searchUrl: findings.searchUrl,
    requiresAuth: findings.requiresAuth || false,
    formFields: findings.formFields,
    resultsSelector: findings.resultsSelector,
    pdfLinkPattern: findings.pdfLinkPattern,
  };
  
  return config;
}

// Usage
const config = await researchCounty("Jefferson County", "Kentucky");
console.log(JSON.stringify(config, null, 2));
```

---

## Resources

- **OpenClaw**: https://docs.openclaw.ai/
- **Skyvern**: https://github.com/Skyvern-AI/skyvern
- **Browser-Use**: https://github.com/browser-use/browser-use
- **CrewAI**: https://github.com/crewAIInc/crewAI
- **Serper** (web search API): https://serper.dev/
