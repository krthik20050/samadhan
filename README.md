# 🚌 SAMADHAN

### **Smart Assistance & Management for Automated Depot Handling and Network Grievances**

> **A digital grievance-management platform for public transport that lets passengers report issues in under a minute — through the web or Telegram — while automatically routing complaints to the right depot, calculating SLAs, storing evidence, and giving operators a real-time management dashboard.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge\&logo=vercel)](https://frontend-ruddy-seven-46.vercel.app/)
[![Backend](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=for-the-badge\&logo=supabase\&logoColor=white)](https://supabase.com/)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?style=for-the-badge\&logo=react\&logoColor=black)](https://react.dev/)
[![Language](https://img.shields.io/badge/TypeScript-6.x-3178C6?style=for-the-badge\&logo=typescript\&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-FastAPI-009688?style=for-the-badge\&logo=fastapi\&logoColor=white)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=for-the-badge\&logo=postgresql\&logoColor=white)](https://www.postgresql.org/)

---

## 🚨 The Problem

Public-transport complaints are often fragmented across:

* verbal complaints
* phone calls
* paper forms
* social media
* messaging applications
* depot-level reporting

This makes complaints difficult to **track, route, prioritize and resolve**.

Passengers often don't know:

* Where their complaint went
* Who is responsible for it
* When it will be resolved
* Whether anyone is actually handling it

At the same time, transport authorities lack a unified view of:

* complaint volume
* recurring problems
* SLA breaches
* escalations
* depot performance
* passenger-submitted evidence

### SAMADHAN brings the entire process into one system.

```text
Passenger
   │
   ├── Web
   │
   └── Telegram
          │
          ▼
   ┌─────────────────────┐
   │   SAMADHAN API      │
   │  Supabase Edge Fn   │
   └──────────┬──────────┘
              │
              ▼
       PostgreSQL RPCs
              │
      ┌───────┼────────┐
      ▼       ▼        ▼
   Validate  Route     SLA
             Depot
              │
              ▼
        Complaint DB
              │
       ┌──────┴──────┐
       ▼             ▼
 Passenger       Admin /
 Tracking        Depot Dashboard
```

---

# ✨ What SAMADHAN Does

SAMADHAN is not just a complaint form.

It provides an end-to-end grievance workflow:

### 👤 For passengers

* File complaints from the web
* File complaints through Telegram
* Upload ticket photographs
* Automatically extract ticket information
* Submit voice complaints
* Attach photos/videos as evidence
* Track complaints using a reference ID
* View previous complaints
* Link a phone number to a Telegram account
* Reuse frequently travelled routes
* Receive depot routing and SLA information

### 🏢 For transport authorities

* Centralized complaint database
* Automatic depot resolution
* SLA calculation
* SLA breach detection
* Escalation tracking
* Complaint categorization
* Operational dashboard
* Complaint filtering
* Anonymous/public analytics
* Admin/depot authentication
* Evidence preservation

---

# 🧠 Key Features

| Feature                  | Description                                                                |
| ------------------------ | -------------------------------------------------------------------------- |
| 📝 Fast Complaint Filing | File a complaint through web or Telegram                                   |
| 🤖 Telegram Bot          | Conversational complaint filing without opening a website                  |
| 📸 Ticket OCR            | Extract bus number, route, date and ticket information from a ticket photo |
| 🎙️ Voice Complaints     | Convert voice messages into complaint descriptions                         |
| 🗺️ Smart Route Matching | Match passenger-entered routes against the KSRTC dataset                   |
| 🏢 Depot Routing         | Automatically identify the responsible depot                               |
| ⏱️ SLA Management        | Calculate response/resolution deadlines                                    |
| 🚨 Escalations           | Detect overdue complaints and escalate them                                |
| 📎 Evidence              | Store ticket photos, images and videos securely                            |
| 🔖 Reference IDs         | Every complaint receives a trackable reference number                      |
| 📊 Dashboard             | Monitor complaint volume, categories, statuses and SLA breaches            |
| 👤 Account Linking       | Connect Telegram users to their phone number                               |
| 🚌 Saved Trips           | Remember frequently used routes and buses                                  |
| 🔍 Complaint Tracking    | Track complaint status from web or Telegram                                |
| 🔐 Role-Based Access     | Separate passenger and admin/depot experiences                             |
| 🌐 Multilingual-ready UI | Language provider architecture for future localization                     |

---

# 🤖 Telegram Workflow

One of the main features of SAMADHAN is its **Telegram-first complaint workflow**.

The Telegram bot acts as a conversational interface over the same backend used by the website.

```text
                    Telegram
                       │
                       ▼
              Telegram Bot API
                       │
                       ▼
             Telegram Webhook
                       │
                       ▼
       Supabase Edge Function
          /api/v1/telegram/webhook
                       │
                       ▼
             Conversation State
                 in PostgreSQL
                       │
          ┌────────────┼─────────────┐
          ▼            ▼             ▼
      Ticket OCR    Route Match   Voice STT
        Groq        Dataset/RPC     Sarvam
          │            │             │
          └────────────┼─────────────┘
                       ▼
                 Review & Confirm
                       │
                       ▼
              app_file_complaint()
                       │
                       ▼
                 PostgreSQL
                       │
            ┌──────────┴─────────┐
            ▼                    ▼
       Web Dashboard       Telegram Reply
```

The important architectural decision is that **Telegram does not create a separate complaint system**.

Telegram ultimately calls the same complaint filing logic used by the website.

This means:

> **Web complaint + Telegram complaint → same database → same tracking → same dashboard → same SLA pipeline**

The hosted backend explicitly exposes:

```text
POST /api/v1/telegram/webhook
```

and routes the Telegram flow into the same `app_file_complaint` and `app_track_complaint` database functions used elsewhere in the application.

---

## 📲 Telegram User Journey

### 1. Start

The passenger sends:

```text
/start
```

SAMADHAN responds with the main menu.

Available actions include:

```text
🚨 File a complaint
📋 My complaints
🔗 Link account
❓ Help
```

---

### 2. Start a complaint

The passenger sends:

```text
/complain
```

The bot asks for a ticket photograph.

```text
📸 Send a photo of your ticket.

I will read the bus number, route and date
from it automatically.

No ticket handy? Skip.
```

---

### 3. Ticket extraction

If a ticket photo is uploaded:

```text
Telegram
   │
   ▼
Download Telegram file
   │
   ▼
Store original image
   │
   ▼
Groq Vision
   │
   ▼
Structured ticket data
```

The system can extract information such as:

* Bus number
* Origin
* Destination
* Travel date
* Travel time
* Ticket number
* PNR
* Depot
* Service type
* Trip code
* Depot phone
* Boarding landmark
* QR presence

The extracted information is shown back to the passenger for confirmation.

---

### 4. Select complaint category

The passenger can select from:

```text
🧹 Cleanliness
⚠️ Unsafe driving
👥 Overcrowding
🛑 Missed stop
🎟️ Concession denied
🎫 Ticketing
🗣️ Staff behaviour
🚌 Bus condition
📝 Other
```

---

### 5. Route resolution

The passenger can enter something like:

```text
Guruvayur to Kozhikode
```

SAMADHAN searches the route dataset and suggests matching routes.

The passenger can:

* choose the matching route
* use their original text
* skip the route

Unknown routes are not blindly guessed.

---

### 6. Describe the problem

The passenger can type the complaint.

For example:

```text
The bus was extremely overcrowded and
the conductor refused to allow passengers
to board at the stop.
```

The system validates the description before continuing.

---

### 7. Voice complaint

The passenger can also send a voice note.

```text
Telegram Voice
      │
      ▼
Sarvam STT
      │
      ▼
Text transcript
      │
      ▼
Complaint description
```

The transcription is then inserted into the complaint flow.

If Sarvam is unavailable, SAMADHAN falls back to normal text input instead of breaking the entire complaint workflow.

---

### 8. Add proof

Passengers can attach:

* photos
* videos
* ticket images

Evidence is stored in the Supabase `evidence` storage bucket and linked to the complaint.

---

### 9. Review

Before submission, the passenger receives a final summary:

```text
🧾 FINAL REPORT

Category: Overcrowding
Route: Guruvayur → Kozhikode
Bus number: KL-XX-XXXX
Travel date: 24-09-2026
Problem: Bus was extremely overcrowded
Proof attached: 2 files
```

They can:

```text
✅ Submit complaint
✏️ Edit details
❌ Cancel
```

---

### 10. Complaint creation

After confirmation:

```text
Telegram
    │
    ▼
app_file_complaint()
    │
    ├── Validate
    ├── Resolve route
    ├── Identify depot
    ├── Calculate SLA
    ├── Store complaint
    ├── Store evidence
    └── Add status history
             │
             ▼
        PostgreSQL
```

The bot then returns:

```text
✅ Complaint filed and live on the website.

🔖 Reference: KSRTC-2026-XXXXXX
🏢 Depot: ADOOR
📎 Proof stored: 2
⏱️ SLA due: ...

Track: /track KSRTC-2026-XXXXXX
Your complaints: /my
```

This is the same database consumed by the web dashboard.

---

# 📋 Telegram Commands

| Command              | Purpose                   |
| -------------------- | ------------------------- |
| `/start`             | Start SAMADHAN            |
| `/complain`          | File a new complaint      |
| `/my`                | View recent complaints    |
| `/track <REFERENCE>` | Track a complaint         |
| `/link`              | Link phone number/account |
| `/unlink`            | Remove account link       |
| `/help`              | Show help                 |
| `/cancel`            | Cancel the current flow   |

The bot also supports inline buttons so users don't have to remember commands.

---

# 🔗 Account Linking

A passenger can choose:

```text
🔗 Link account
```

and share their phone number using Telegram's contact-sharing button.

Once linked:

* the phone number can be used by the depot for callbacks
* frequently used trips can be remembered
* future complaints become faster
* the passenger can access their previous complaints

The phone number is operational information and is not exposed in the anonymized dashboard.

---

# 🚌 Saved Trips

For returning passengers, SAMADHAN can remember frequently used trips.

Instead of entering everything again:

```text
Which trip had the issue?

🚌 Guruvayur → Kozhikode · KL-XX-XXXX
🚌 Thrissur → Ernakulam · KL-XX-XXXX
🆕 Different trip
```

This turns repeated complaint filing into a much shorter interaction.

---

# 🏗️ Architecture

SAMADHAN currently uses a **Supabase-first hosted architecture**.

```text
                         ┌───────────────────────┐
                         │       Passenger       │
                         └───────────┬───────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
             React Web App                      Telegram Bot
              Vite + TS                            API
                    │                                 │
                    └────────────────┬────────────────┘
                                     ▼
                         ┌────────────────────────┐
                         │ Supabase Edge Function │
                         │       /api              │
                         └────────────┬───────────┘
                                      │
                           Thin HTTP / Auth Layer
                                      │
                                      ▼
                         ┌────────────────────────┐
                         │   PostgreSQL RPC Layer │
                         │                        │
                         │ Validation             │
                         │ Route Resolution       │
                         │ Depot Resolution       │
                         │ SLA Calculation        │
                         │ Complaint Creation     │
                         │ Tracking                │
                         │ Dashboard Analytics    │
                         └────────────┬───────────┘
                                      │
                                      ▼
                              PostgreSQL / Storage
                                      │
                         ┌────────────┴───────────┐
                         ▼                        ▼
                  Passenger Views            Admin Dashboard
```

The Edge Function intentionally acts as a thin router while the core business logic lives in PostgreSQL RPCs.

---

# 🧩 Technology Stack

## Frontend

* React 19
* TypeScript
* Vite
* Tailwind CSS
* React Router
* Framer Motion
* Lucide React
* Clerk authentication

The current frontend is a Vite/React application rather than the older Next.js structure described by the original README.

---

## Backend

### Hosted

* Supabase Edge Functions
* Deno
* PostgreSQL RPCs
* Supabase Storage

### Local development / testing

* Python
* FastAPI
* Pydantic
* PostgreSQL
* Pytest

The FastAPI implementation remains as a local development and testing harness while the hosted deployment uses the Supabase Edge Function.

---

## AI / Intelligence Layer

### 🧠 Groq Vision

Used for:

```text
Ticket image
     ↓
Vision model
     ↓
Structured ticket information
```

It extracts structured information from uploaded KSRTC tickets.

### 🎙️ Sarvam AI

Used for:

```text
Voice message
      ↓
Sarvam STT
      ↓
Text
      ↓
Complaint description
```

The implementation uses the `saaras:v3` speech-to-text model.

---

## Database

PostgreSQL through Supabase stores:

* complaints
* status history
* routes
* depots
* route mappings
* SLA rules
* users
* Telegram conversation state
* Telegram passenger links
* saved trips
* evidence references
* analytics data

Business logic is implemented using PostgreSQL functions/RPCs so the same logic can be called from multiple interfaces.

---

# 🗺️ Route Intelligence

SAMADHAN uses a real transport dataset rather than relying entirely on user-provided text.

For example:

```text
User input:
"Guruvayoor to Kozhikode"

             ↓

Normalization
             ↓

Alias resolution
             ↓

Canonical route
             ↓

Verified depot mapping
             ↓

Responsible depot
```

The system supports aliases and passenger-style route spellings.

If there is ambiguity, SAMADHAN can fall back to:

```text
needs_triage
```

instead of making an unsafe routing guess.

---

# ⏱️ SLA & Escalation

Every complaint can receive an SLA deadline based on:

```text
Complaint Category
        +
Priority
        ↓
SLA Rule
        ↓
Response / Resolution Deadline
```

The database contains SLA logic and a scheduled sweep can identify overdue complaints.

Conceptually:

```text
Complaint submitted
       │
       ▼
SLA deadline calculated
       │
       ▼
Complaint remains open
       │
       ▼
Deadline exceeded?
     /     \
   NO       YES
   │         │
   ▼         ▼
Continue   SLA breach
             │
             ▼
         Escalation
```

The hosted architecture uses `app_sla_sweep()` and can schedule it through PostgreSQL `pg_cron`.

---

# 📊 Dashboard

The system provides separate experiences for passengers and operators.

### Passenger

```text
Home
 ├── File Complaint
 ├── Voice Complaint
 ├── Track Complaint
 ├── My Account
 └── Public Dashboard
```

### Depot / Admin

```text
Admin Dashboard
 ├── Complaints
 ├── Escalations
 └── Notifications
```

The current frontend routing includes protected admin/depot routes and public passenger routes.

---

# 🔐 Security & Privacy

SAMADHAN is designed around the principle that operational data and public analytics should be separated.

### Staff endpoints

Protected using:

```text
Authorization: Bearer <ADMIN_API_TOKEN>
```

### Telegram webhook

Protected using:

```text
X-Telegram-Bot-Api-Secret-Token
```

### User authentication

Clerk sessions are cryptographically verified before account information is associated with a complaint.

### Service-role credentials

Supabase service-role credentials remain server-side inside the Edge Function and are never exposed to the frontend.

### Public dashboard

The public-facing analytics layer is designed to avoid exposing direct passenger identity information.

---

# 📁 Project Structure

```text
samadhan/
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── schemas/
│   │   └── services/
│   │
│   ├── scripts/
│   │   └── setup_telegram_webhook.py
│   │
│   ├── tests/
│   └── requirements.txt
│
├── database/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_seed_sla_rules.sql
│   │   ├── 003_*.sql
│   │   ├── 004_lookup_hardening.sql
│   │   └── 005_supabase_rpcs.sql
│   │
│   └── seeds/
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATABASE.md
│   ├── DEVELOPMENT.md
│   ├── DEMO.md
│   ├── DECISIONS.md
│   └── PROJECT_CHECKLIST.md
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── lib/
│   │   └── pages/
│   │       ├── admin/
│   │       ├── Home.tsx
│   │       ├── FileComplaint.tsx
│   │       ├── VoiceComplaint.tsx
│   │       ├── TrackComplaint.tsx
│   │       └── MyAccount.tsx
│   │
│   └── package.json
│
├── supabase/
│   ├── functions/
│   │   └── api/
│   │       └── index.ts
│   ├── config.toml
│   └── README.md
│
├── .env.example
├── PROJECT_STATUS.md
├── render.yaml
└── README.md
```

---

# 🚀 Live Demo

### 🌐 Web Application

**https://frontend-ruddy-seven-46.vercel.app/**

The deployed frontend connects to the hosted Supabase API.

### 🤖 Telegram

The repository contains a fully implemented Telegram bot integration through the Supabase Edge Function.

Bot configuration is handled using:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_SECRET_TOKEN
```

The webhook endpoint is:

```text
/api/v1/telegram/webhook
```

---

# ⚙️ Local Development

## 1. Clone

```bash
git clone https://github.com/krthik20050/samadhan.git
cd samadhan
```

---

## 2. Backend

```powershell
cd backend

py -m venv .venv

.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

Create the root `.env` file:

```powershell
copy ..\.env.example ..\.env
```

Start FastAPI:

```powershell
py -m uvicorn app.main:app --reload --port 8000
```

Health check:

```text
http://localhost:8000/health
```

Expected:

```json
{
  "status": "ok"
}
```

---

# 🎨 Frontend

```powershell
cd frontend

npm install
```

Create:

```text
frontend/.env.local
```

with:

```env
VITE_API_URL=http://localhost:8000
```

Run:

```powershell
npm run dev
```

The Vite development server will provide the local frontend URL.

---

# 🗄️ Database

SAMADHAN can use Supabase PostgreSQL for the hosted setup.

The migrations are applied in order:

```text
001_initial_schema.sql
002_seed_sla_rules.sql
003_*.sql
004_lookup_hardening.sql
005_supabase_rpcs.sql
```

The database becomes the source of truth for complaint data and the core business workflow.

---

# ☁️ Supabase Deployment

Install Supabase CLI:

```bash
npm install -g supabase
```

Login:

```bash
supabase login
```

Deploy the Edge Function:

```bash
supabase functions deploy api \
  --project-ref YOUR_PROJECT_REF
```

Set secrets:

```bash
supabase secrets set \
  ADMIN_API_TOKEN=... \
  TELEGRAM_BOT_TOKEN=... \
  TELEGRAM_SECRET_TOKEN=... \
  GROQ_API_KEY=... \
  SARVAM_API_KEY=... \
  CLERK_ISSUER=... \
  CLERK_SECRET_KEY=...
```

`SUPABASE_URL` and the service-role key are injected into the Edge Function environment by Supabase.

---

# 🤖 Configure Telegram

Set:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_SECRET_TOKEN=your_random_secret
```

Then register the webhook:

```powershell
backend/.venv/Scripts/python backend/scripts/setup_telegram_webhook.py `
  set https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/api
```

The script automatically appends:

```text
/api/v1/telegram/webhook
```

to the base URL.

Check the current configuration:

```powershell
py backend/scripts/setup_telegram_webhook.py info
```

Remove the webhook:

```powershell
py backend/scripts/setup_telegram_webhook.py delete
```

---

# 🔑 Environment Variables

The main configuration includes:

```env
# Database
DATABASE_URL=

# Backend
BACKEND_PORT=8000
FRONTEND_URL=

# Staff
ADMIN_API_TOKEN=

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Authentication
CLERK_ISSUER=
CLERK_SECRET_KEY=

# Frontend
VITE_API_URL=

# AI
GROQ_API_KEY=
GROQ_MODEL=
SARVAM_API_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_SECRET_TOKEN=

# Optional WhatsApp integration
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
```

Never commit real API keys, service-role keys, bot tokens or secrets.

---

# 🧪 Testing

Backend:

```bash
cd backend
pytest -q
```

Frontend:

```bash
cd frontend
npm run build
```

CI automatically runs backend tests and frontend checks on pushes and pull requests.

---

# 🔌 API Overview

### Health

```http
GET /health
```

### Create complaint

```http
POST /api/v1/complaints
```

### Track complaint

```http
GET /api/v1/complaints/{reference_id}
```

### Routes

```http
GET /api/v1/routes?q=&limit=
```

### Depots

```http
GET /api/v1/depots?q=&limit=
```

### Dashboard summary

```http
GET /api/v1/dashboard/summary
```

### Dashboard complaints

```http
GET /api/v1/dashboard/complaints
```

### Ticket extraction

```http
POST /api/v1/extract/ticket
```

### Voice transcription

```http
POST /api/v1/voice/transcribe
```

### Telegram

```http
POST /api/v1/telegram/webhook
```

The hosted Edge Function implements these routes while delegating the core operations to PostgreSQL RPC functions.

---

# 🔄 End-to-End Complaint Lifecycle

```text
                PASSENGER
                    │
          ┌─────────┴─────────┐
          │                   │
        WEB                TELEGRAM
          │                   │
          └─────────┬─────────┘
                    ▼
             Complaint API
                    │
                    ▼
               Validation
                    │
                    ▼
             Route Matching
                    │
                    ▼
              Depot Lookup
                    │
                    ▼
              SLA Creation
                    │
                    ▼
             PostgreSQL
                    │
          ┌─────────┼─────────┐
          │         │         │
          ▼         ▼         ▼
       Tracking  Dashboard  Escalation
          │         │         │
          └─────────┴─────────┘
                    │
                    ▼
             Resolution
```

---

# 🧠 Design Philosophy

SAMADHAN follows a few important architectural principles.

### 1. One complaint pipeline

Web and Telegram should not have different business logic.

```text
Web ────────┐
            ├──> Same complaint engine
Telegram ───┘
```

### 2. AI is an accelerator, not the source of truth

AI is used for:

* ticket extraction
* voice transcription
* convenience

Core operations such as:

* validation
* route matching
* depot resolution
* SLA calculation
* persistence

remain deterministic and database-backed.

### 3. Fail gracefully

If Groq is unavailable:

```text
Ticket photo
    ↓
Stored as proof
    ↓
Manual complaint flow
```

If Sarvam is unavailable:

```text
Voice
  ↓
Fallback to text
```

The core complaint workflow should not collapse just because an optional AI service is unavailable.

### 4. One source of truth

```text
Telegram ─┐
Web ──────┼──> PostgreSQL
Admin ────┘
```

This keeps all interfaces synchronized.

---

# 🛠️ Development Tools

SAMADHAN was developed with a combination of conventional engineering tools and AI-assisted development workflows.

### AI-assisted development

* **OpenCode** — used as an AI-assisted coding/development environment
* **FreeBuf** — used as part of the development workflow and project-building process

### Core engineering tools

* Git & GitHub
* VS Code / development environment
* Supabase
* Vercel
* Python
* FastAPI
* React
* TypeScript
* PostgreSQL
* Tailwind CSS

The goal was not simply to generate code, but to use these tools to accelerate architecture, implementation, debugging, documentation and iteration.

---

# 🏆 Hackathon Demo Flow

A strong live demonstration can follow this sequence:

### 01 — Show the problem

Explain how traditional complaints become fragmented and difficult to track.

### 02 — Open the passenger portal

Show:

```text
File Complaint
Track Complaint
My Account
Public Dashboard
```

### 03 — Submit through Telegram

Open the Telegram bot.

```text
/complain
```

Upload a real ticket.

### 04 — Demonstrate ticket intelligence

Show the bot extracting:

```text
Bus
Route
Date
Ticket information
```

### 05 — Submit the complaint

Show the generated:

```text
KSRTC-2026-XXXXXX
```

### 06 — Open the web dashboard

The same complaint appears in the dashboard.

### 07 — Demonstrate tracking

Use:

```text
/track KSRTC-2026-XXXXXX
```

or the web tracking page.

### 08 — Demonstrate SLA

Show:

```text
SLA deadline
↓
Breach
↓
Escalation
```

### 09 — Show the architecture

Finish with:

```text
Telegram / Web
      ↓
Edge Function
      ↓
PostgreSQL RPCs
      ↓
Complaint + SLA + Depot
      ↓
Dashboard
```

---

# 📈 Why This Architecture?

Instead of building multiple disconnected systems:

```text
Telegram Bot
    +
Web App
    +
Admin Panel
    +
Separate Database
```

SAMADHAN uses:

```text
                  ┌── Web
                  │
Passenger ────────┼── Telegram
                  │
                  └── Future channels
                         │
                         ▼
                Shared Complaint API
                         │
                         ▼
                    PostgreSQL
```

This makes additional channels easier to add later without rebuilding the grievance-management core.

---

# 🛣️ Future Roadmap

The architecture leaves room for additional channels and intelligence layers.

### Planned / extensible

* 📞 IVR voice complaints
* 💬 WhatsApp integration
* 📄 Ticket/document OCR
* 🌍 More Indian languages
* 📊 Advanced trend detection
* 🗺️ Complaint heatmaps
* 🔁 Duplicate complaint detection
* 📱 Mobile application
* 🔔 Push/SMS notifications
* 🧠 More advanced AI-assisted complaint classification
* 🏢 Deeper depot-level analytics

The key principle remains:

```text
New Channel
     ↓
Adapter
     ↓
Same Complaint Pipeline
```

---

# 📚 Documentation

Additional documentation is available inside [`docs/`](docs/):

| Document                                            | Purpose                   |
| --------------------------------------------------- | ------------------------- |
| [`ARCHITECTURE.md`](docs/ARCHITECTURE.md)           | System architecture       |
| [`API.md`](docs/API.md)                             | API contract              |
| [`DATABASE.md`](docs/DATABASE.md)                   | Database design           |
| [`DEVELOPMENT.md`](docs/DEVELOPMENT.md)             | Development setup         |
| [`DEMO.md`](docs/DEMO.md)                           | Hackathon demo flow       |
| [`DECISIONS.md`](docs/DECISIONS.md)                 | Architecture decisions    |
| [`PROJECT_CHECKLIST.md`](docs/PROJECT_CHECKLIST.md) | Implementation checklist  |
| [`supabase/README.md`](supabase/README.md)          | Hosted backend deployment |

---

# 👨‍💻 Built For

**Hackathon Project — SAMADHAN**

Designed around a simple idea:

> **A passenger should not have to understand the transport department's internal structure to report a problem.**

They should simply be able to say:

```text
"This happened."
```

SAMADHAN handles the rest.

---

# ⭐ Project

**Repository:**
https://github.com/krthik20050/samadhan

**Live application:**
https://frontend-ruddy-seven-46.vercel.app/

---

## ❤️ SAMADHAN

### **Report it. Track it. Resolve it.**

---

# 🛡️ Production Hardening (September 2026)

The codebase has undergone a full production-readiness pass. Highlights:

- **Idempotent filing** — double-clicks and network retries return the same
  complaint instead of creating duplicates (`X-Idempotency-Key` +
  `app_file_complaint` v6 with a unique partial index).
- **Audit trail** — every filing/upload writes an `audit_log` row (actor,
  channel, request ID); request IDs echo on API responses.
- **Security** — WhatsApp webhook now verifies `X-Hub-Signature-256` (fail
  closed); chat-keyed account endpoints are bound to a verified identity
  (IDOR closed); CORS is origin-pinned via the `SITE_URL` secret; Telegram
  file downloads are size-capped before fetch.
- **One filing pipeline** — the FastAPI harness now delegates to the same
  authoritative Postgres RPC the Edge Function uses; provenance is stamped
  via `complaints.source_channel`.
- **52 passing tests** (HMAC security suite, reference-ID invariants, live
  E2E journey), clean typecheck/build, code-split bundles.

Full details: [`docs/architecture/AUDIT.md`](docs/architecture/AUDIT.md) ·
[`docs/architecture/API_GAPS.md`](docs/architecture/API_GAPS.md) ·
[`docs/architecture/KNOWN_LIMITATIONS.md`](docs/architecture/KNOWN_LIMITATIONS.md) ·
[`docs/database/DATABASE_ARCHITECTURE.md`](docs/database/DATABASE_ARCHITECTURE.md) ·
[`docs/workflows/COMPLAINT_WORKFLOW.md`](docs/workflows/COMPLAINT_WORKFLOW.md) ·
[`docs/workflows/TELEGRAM_WORKFLOW.md`](docs/workflows/TELEGRAM_WORKFLOW.md) ·
[`docs/operations/DEPLOYMENT.md`](docs/operations/DEPLOYMENT.md) ·
[`docs/operations/OBSERVABILITY.md`](docs/operations/OBSERVABILITY.md).

**Operator note:** apply `database/migrations/011_production_hardening.sql`
(already applied to the dev database) and redeploy the Edge Function with
`SITE_URL` set — see the deployment runbook.
