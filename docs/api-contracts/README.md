# API Contracts & Interface Definitions

This directory contains the agreed interface contracts between **Person A (Frontend)** and **Person B (Backend)**.

## Collaboration Rules

1. **Contract-First Development:** Person A and Person B establish request/response payloads before backend implementations are finalized.
2. **TypeScript Type Sharing:** Strict TypeScript interfaces representing shared domain entities (Medicine, Pharmacy, InventoryItem, TransferRequest, Alert) will be defined here to ensure zero runtime drift.
3. **Endpoint Namespaces (Proposed):**
   * `/api/v1/medicines` — Search, autocomplete, master catalog
   * `/api/v1/pharmacies` — Profiles, operating hours, geolocation
   * `/api/v1/inventory` — Store stock adjustments, batch records
   * `/api/v1/transfers` — Requisitions, waybills, dispatch, and OTP confirmation
   * `/api/v1/intelligence` — Demand spikes, regional shortage radar, restock analytics
