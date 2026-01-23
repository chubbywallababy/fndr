# Coding Agent Prompt (Nx Backend Cronjob)

## Context

You are working in an **Nx monorepo** with an existing **backend Node/TypeScript app**.  
There is already a function that scrapes emails for a given date range.

---

## Goal

Add a **cronjob runner** inside the existing backend app that:
- Runs on a schedule
- Calls the existing email-scraping function
- Can also be run manually

---

## Requirements

### 1. Location & Structure

- Do **not** create a new Nx app
- Add a new folder inside the backend app, for example:

