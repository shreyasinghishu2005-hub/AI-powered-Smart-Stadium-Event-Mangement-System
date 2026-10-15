# Smart Stadium Command Center

A hackathon-ready MVP for an AI-powered smart stadium and tournament operations platform.

Open `index.html` in a browser to run it. No install step or API key is required.

## What It Demonstrates

- Live stadium digital twin with simulated crowd density, gate waits, and route recommendations
- Security monitoring with camera and access-control alerts
- Predictive analytics for attendance, parking, food, merchandise, staffing, and inventory
- AI ticketing mockup with seat recommendation and fraud checks
- Tournament scheduling optimizer and generated operations summary
- Fan assistant for navigation, food, seats, restrooms, merchandise, and match info
- Sustainability management for lighting, HVAC, waste, carbon, and smart bins

## Demo Flow

1. Use the scenario selector to switch between normal flow, gates opening, halftime surge, rain delay, and security incident.
2. Click a stadium zone to see the recommended operational action.
3. Press `Dispatch` to simulate sending an instruction to operations teams.
4. Open Ticketing to recommend seats and scan sample ticket codes.
5. Open Tournament Ops and run `Optimize`.
6. Open Fan Assistant and ask about gates, food, seats, restrooms, merchandise, or emergency exits.
7. Open Sustainability and run `Optimize energy`.

## Future Integrations

- Computer vision: YOLO/OpenCV event detection from real camera feeds
- IoT: MQTT ingestion from ESP32 counters, bin sensors, occupancy sensors, and smart meters
- Backend: FastAPI or Node.js APIs for simulation, persistence, and integrations
- Database: PostgreSQL tables for events, zones, tickets, vendors, fixtures, incidents, and sensor readings
- AI: LLM-based assistant, report generator, schedule explainer, and anomaly triage
