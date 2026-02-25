<p align="center">
  <img src="https://img.shields.io/badge/RoamIQ-Smart%20Travel%20Planner-6d28d9?style=for-the-badge&logo=compass&logoColor=white" alt="RoamIQ" />
</p>

<h1 align="center">🧭 RoamIQ — AI-Powered Smart Travel Planner</h1>

<p align="center">
  <strong>Intelligent itinerary optimization with real-time weather adaptation, crowd analytics, elderly accessibility scoring, child-friendly mode, emergency SOS, and dark mode.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61dafb?logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript" />
  <img src="https://img.shields.io/badge/Vite-5.4-646cff?logo=vite" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi" />
  <img src="https://img.shields.io/badge/Supabase-BaaS-3ecf8e?logo=supabase" />
  <img src="https://img.shields.io/badge/Mapbox-GL-000?logo=mapbox" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-06b6d4?logo=tailwindcss" />
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Scoring Algorithms](#-scoring-algorithms)
- [API Endpoints](#-api-endpoints)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Changelog](#-changelog)

---

## 🌍 Overview

**RoamIQ** is an AI-powered travel planning platform that goes beyond basic itinerary creation. It combines real-time data (weather, crowd levels), intelligent scoring algorithms, and adaptive suggestions to create optimized travel experiences for all types of travelers — including elderly individuals and families with children.

The platform features a **React + TypeScript** frontend with rich animations (Framer Motion), interactive maps (Mapbox GL), and a modular panel-based UI. The backend is powered by **FastAPI (Python)** with integrations to the **BestTime API** for real-time crowd analytics and **Supabase** for authentication, database, and serverless edge functions.

---

## ✨ Features

### 🗺️ Smart Itinerary Management
- **Multi-day trip planning** with drag-and-drop day management
- **Activity cards** with time slots, duration, location, and cost tracking
- **Day-by-day navigation** with pill-based day selector
- **Add/Edit/Delete** activities with real-time sync to Supabase
- **Completion tracking** with actual cost vs estimated cost comparison
- **Budget tracker** with progress bar and over-budget warnings

### 🌦️ Real-Time Weather Integration
- **Current conditions** — temperature, humidity, wind speed, rain probability
- **5-day forecast** with daily min/max temperatures and rain chance
- **Day-specific weather badges** matching selected itinerary day
- Powered by **Supabase Edge Function** → OpenWeatherMap API

### 🗂️ Adaptive Engine (AI Suggestions)
- **Weather-aware suggestions** — automatically proposes indoor alternatives when rain is detected
- **Activity swaps** — suggests replacements for weather-affected activities
- **Timing optimization** — recommends better time slots based on conditions
- **Safety warnings** — alerts for extreme weather or unsafe conditions
- **One-click add** — instantly add suggestions to your itinerary
- Powered by **Supabase Edge Function** → Gemini AI

### 🧭 Explore & Recommendations
- **AI-generated recommendations** for hotels, restaurants, and attractions
- **Category-based browsing** — Hotels, Restaurants, Attractions
- **Smart scheduling** — auto-assigns recommendations to the day with fewest activities
- **Duration parsing** — intelligently converts "2-3 hours" to scheduled time slots
- Powered by **Supabase Edge Function** → Gemini AI

### 📍 Interactive Map View
- **Mapbox GL** integration with custom markers for each activity
- **Geocoded locations** — automatic latitude/longitude resolution
- **Day-filtered view** — shows only the selected day's activities
- **Route visualization** between activity locations
- **Smart geocoding filter** — rejects vague locations ("breakfast", "hotel", etc.) to prevent incorrect markers
- **Distance-validated markers** — only places within **25 km** of the destination are shown (haversine distance)
- **Debug logging** — `[Map] ✓/✗` console logs to trace which locations are accepted/rejected
- Powered by **Mapbox Geocoding API**

### ⚡ Traffic-Aware Route Optimization
- **Mapbox Optimization API v1** — finds the **quickest order** to visit all waypoints per day (“Traveling Salesman”)
- **`driving-traffic` profile** — real-time traffic data for accurate travel times
- **Per-segment congestion** — each leg between stops is rated: 🟢 Low, 🟡 Moderate, 🔴 Heavy
- **Traffic-colored route lines** — green/amber/red polylines on the map per leg
- **Segment breakdown panel** — scrollable list showing distance, duration, and congestion per leg
- **⚡ Optimized badge** — appears when waypoints were reordered for a faster route
- **Auto-refresh on changes** — routes re-compute when tasks are completed, reordered, or edited
- **Fallback to Directions API** — if >12 waypoints or Optimization API fails

### 🚨 Emergency SOS
- **SOS Button** — large animated panic button that triggers `tel:112` (universal emergency)
- **Quick Dial Grid** — one-tap call cards for Police (100), Ambulance (108), Fire (101), Emergency (112)
- **Nearby Police Stations** — auto-located via Mapbox POI search, sorted by distance
- **Nearby Hospitals** — auto-located via Mapbox POI search with distance badges
- **Interactive Emergency Map** — Mapbox dark map with blue (police) and red (hospital) markers, user location pulse
- **Google Maps Navigation** — one-click "Navigate" opens directions to any emergency service
- **Dual access** — available as 5th "SOS" tab in trip detail + standalone `/emergency` page
- **Location-aware** — uses browser geolocation first, falls back to trip destination coordinates

### 🖼️ AI Destination Images
- **Curated photos** for 30+ popular destinations (Paris, Tokyo, Mumbai, Goa, Bali, etc.) via Unsplash
- **Mapbox satellite fallback** — aerial/satellite view for destinations not in the curated list
- **Gradient fallback** — vibrant destination-colored gradient with initial letter when no image available
- **Shimmer loading skeleton** — smooth loading animation while images fetch
- **Fade-in animation** — images appear with a smooth opacity transition
- **"✨ AI" badge** — indicates auto-fetched images vs manually uploaded ones
- **Module-level caching** — avoids re-fetching images for the same destination

### 🌙 Dark Mode
- **One-click toggle** — sun/moon icon in the Trips page header
- **Full theme support** — all components, cards, maps, and panels adapt to dark theme
- **Persistent preference** — theme choice saved via `next-themes` (localStorage)
- **System detection** — respects OS-level dark mode preference on first visit

### 📊 Crowd Insights Panel
- **Real-time crowd analysis** using the BestTime API
- **Predicted crowd analysis** when live data is unavailable — uses a prediction engine based on:
  - **Venue type classification** (beach, temple, restaurant, station, hotel, monument, park, etc.)
  - **Hourly busyness curves** — e.g., beaches peak at sunset, temples at morning prayers
  - **Day-of-week multipliers** — weekends are 15-20% busier for tourist spots
- **Busyness percentage bar** (0-100%) with color coding (green/amber/red)
- **"Predicted" badge** — distinguishes estimated vs live data
- **Optimization tips** — context-specific suggestions per venue

### ❤️ Elderly Mode
- **Toggle-based activation** — enable/disable elderly-friendly analysis
- **Per-activity scoring** with detailed breakdown:
  - Crowd Score, Walkability Score, Accessibility Score
  - Estimated steps and walking distance
- **Overall Elderly Score** (0-100) with circular gauge
- **AI-powered analysis** with contextual warnings and recommendations
- **"Optimize" button** — auto-removes high-effort activities from itinerary
- **Fallback scoring** — works even without BestTime API using heuristic analysis

### 👶 Child Mode
- **Toggle-based activation** — enable kid-friendly trip analysis
- **Per-activity fun scoring** with breakdown:
  - Fun Score, Safety Score, Engagement Score
- **Overall Fun Score** (0-100) with circular gauge
- **Kid-friendly alternatives** — suggests replacements for boring/adult activities
- **"Make it Fun!" button** — auto-removes boring activities from itinerary
- **Emoji-rich UI** with colorful fuchsia/violet theme

### 💰 Budget Tracker
- **Estimated vs actual spending** comparison
- **Budget progress bar** with remaining balance
- **Over-budget warnings** with exact overage amount
- **Per-activity cost tracking** via completion flow

### 🔐 Authentication
- **Supabase Auth** with email/password sign-up and sign-in
- **Protected routes** — all trip data is user-scoped
- **Session management** with automatic token refresh
- **Premium Auth page** — full-bleed travel background, glassmorphism card, animated transitions
- **Split layout** — branding panel on desktop, responsive mobile stack
- **Tab-style toggle** — animated Sign In / Sign Up switcher

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI framework with hooks and functional components |
| **TypeScript 5.8** | Type safety across the entire frontend |
| **Vite 5** | Fast dev server with HMR and optimized builds |
| **TailwindCSS 3.4** | Utility-first styling with custom design tokens |
| **Framer Motion** | Smooth animations, transitions, and gesture support |
| **Shadcn/UI + Radix** | Accessible, composable UI primitives (dialogs, switches, tabs, etc.) |
| **Mapbox GL + react-map-gl** | Interactive maps with custom markers and geocoding |
| **Lucide React** | Modern icon library with 460+ icons |
| **React Router DOM** | Client-side routing (Auth, Trips, TripDetail, Emergency, etc.) |
| **React Hook Form + Zod** | Form handling with schema validation |
| **TanStack React Query** | Server state management and caching |
| **next-themes** | Dark/light mode theming with system detection |
| **Recharts** | Data visualization (charts and graphs) |
| **date-fns** | Date formatting and manipulation |

### Backend (Python)
| Technology | Purpose |
|---|---|
| **FastAPI 0.115** | High-performance async API framework |
| **Uvicorn** | ASGI server with hot-reload for development |
| **Pydantic 2.9** | Data validation and serialization |
| **HTTPX** | Async HTTP client for external API calls |
| **python-dotenv** | Environment variable management |

### Backend-as-a-Service
| Technology | Purpose |
|---|---|
| **Supabase** | PostgreSQL database, authentication, and edge functions |
| **Supabase Edge Functions** (Deno) | Serverless functions for AI/weather/geocoding |

### External APIs
| API | Purpose |
|---|---|
| **BestTime API** | Real-time venue crowd data and foot traffic forecasts |
| **OpenWeatherMap** (via Supabase) | Weather data and 5-day forecasts |
| **Mapbox Geocoding** (via Supabase) | Location name → lat/lng resolution |
| **Google Gemini AI** (via Supabase) | Recommendations, adaptive suggestions, itinerary generation |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                       │
│                                                                  │
│  Pages: Auth → Trips → TripDetail → Emergency                   │
│              (Itinerary / Map / Explore / Overview / SOS)         │
│                                                                  │
│  Panels: Weather │ Adaptive │ Crowd │ Elderly │ Child │ Budget   │
│          Emergency SOS │ AI Destination Images │ Dark Mode Toggle │
└────────────┬────────────────────────┬─────────────────────────────┘
             │                        │
     ┌───────▼────────┐      ┌───────▼────────┐
     │ FastAPI Backend │      │ Supabase BaaS  │
     │ (Port 8000)     │      │                │
     │                 │      │ • Auth          │
     │ Routers:        │      │ • PostgreSQL DB │
     │ • /api/crowd    │      │ • Edge Functions│
     │ • /api/elderly  │      │   - weather     │
     │ • /api/child    │      │   - geocode     │
     │ • /api/foursquare│     │   - recommend   │
     │                 │      │   - adaptive    │
     │ Services:       │      │   - itinerary   │
     │ • BestTime API  │      │                │
     │ • CrowdPredictor│      └────────────────┘
     │ • ElderlyScorer │
     │ • ChildScorer   │
     │ • RouteVenues   │
     └────────────────┘
```

---

## 📐 Scoring Algorithms

### Elderly Mode Scoring Formula

The **Elderly Score** evaluates how suitable an activity is for elderly travelers. It uses three sub-scores combined with weighted averaging:

```
Overall Elderly Score = (Crowd Score × 0.35) + (Walkability Score × 0.40) + (Accessibility Score × 0.25)
```

#### 1. Crowd Score (0-100)
Measures how comfortable the crowd level is for elderly visitors.

```
Crowd Score = 100 - busyness_percentage
```

- Busyness is fetched from BestTime API at the planned hour, or predicted using the Crowd Predictor engine
- Lower crowds = higher score (elderly prefer less crowded venues)

#### 2. Walkability Score (0-100)
Estimates the physical demand based on distance, steps, duration, venue type, and activity description.

```
Base Score = 70.0

Penalties:
  Distance > 5 km  → -35    │  Distance > 3 km  → -25
  Distance > 2 km  → -15    │  Distance > 1 km  → -8
  
  Steps > 8,000    → -35    │  Steps > 5,000    → -20
  Steps > 3,000    → -10    │  Steps > 1,500    → -5
  
  Outdoor activity  → -10
  Duration > 180 min → -20  │  Duration > 120 min → -12  │  Duration > 60 min → -5
  
  High-effort type (hiking, trek, climbing, etc.)  → -25
  Low-effort type (museum, cafe, restaurant, etc.) → +15
  
  Description keyword hits (hike, climb, steep, etc.) → -8 per hit
```

**Distance and steps** are estimated from duration and activity type:

| Venue Type | Walking Speed | Steps/Min |
|---|---|---|
| High-effort (hiking, trek) | 3.5 km/h | 90 steps/min |
| Outdoor general | 3.0 km/h | 70 steps/min |
| Indoor general | 1.5 km/h | 30 steps/min |
| Low-effort (cafe, museum) | 0.5 km/h | 20 steps/min |

#### 3. Accessibility Score (0-100)

```
Base Score = 60.0
  Indoor venue     → +20
  Has seating      → +10
  Low-effort type  → +10
```

#### Recommendation Tiers

| Score Range | Label |
|---|---|
| 75-100 | ✅ Highly Recommended |
| 55-74 | 🟦 Suitable |
| 35-54 | 🟡 Use Caution |
| 0-34 | 🔴 Not Recommended |

---

### Child Mode Scoring Formula

The **Child Score** evaluates how fun and suitable an activity is for children. It uses three sub-scores combined with weighted averaging:

```
Overall Child Score = (Fun Score × 0.45) + (Safety Score × 0.25) + (Engagement Score × 0.30)
```

#### 1. Fun Score (0-100)
Measures how enjoyable the activity is for kids.

```
Base Score = 50.0

Bonuses:
  Each "super fun" keyword hit (amusement park, zoo, playground, etc.)  → +12
  Kid-friendly venue type (amusement_park, zoo, aquarium, beach, etc.) → +20
  Outdoor activity    → +5
  Short duration (≤60 min) → +5

Penalties:
  Each "boring" keyword hit (wine, bar, spa, meditation, etc.) → -15
  Long duration (>120 min) → -10
```

**Super Fun Keywords**: amusement, zoo, aquarium, playground, trampoline, carnival, roller coaster, water slide, ice cream, arcade, mini golf, bowling, laser tag, go kart, ferris wheel

**Boring Keywords**: wine, bar, pub, nightclub, brewery, spa, massage, meditation, yoga retreat, business conference

#### 2. Safety Score (0-100)
Evaluates how safe the environment is for children.

```
Base Score = 70.0

Bonuses:
  Indoor venue → +10
  Safe types (restaurant, hotel, museum, cinema, mall) → +10

Penalties:
  Each "risky" keyword (bungee, paragliding, scuba, rock climbing, etc.) → -20
  Water/height types (beach, waterfall, viewpoint) → -5
```

#### 3. Engagement Score (0-100)
Measures how engaging and interactive the activity is for children.

```
Base Score = 50.0

Bonuses:
  Highly engaging types (zoo, aquarium, amusement park, playground, museum) → +30
  Moderately engaging (park, beach) → +15
  Super fun keyword hits → +15

Penalties:
  Boring types (temple, monument) → -5
  Boring keyword hits → -20
```

#### Recommendation Tiers

| Score Range | Label |
|---|---|
| 75-100 | 🌟 Super Fun! |
| 55-74 | 👍 Good for Kids |
| 35-54 | 😐 Okay |
| 0-34 | ❌ Not for Kids |

Activities scoring below 55 get **suggested alternatives** — for example, a temple visit suggests "Visit a children's art workshop nearby" or "Explore the temple gardens and feed birds".

---

### Crowd Prediction Formula

When the BestTime API has no data for a venue, the **Crowd Predictor** generates estimated busyness:

```
busyness = hourly_curve[venue_type][hour] × day_of_week_multiplier
```

| Venue Type | Peak Hours | Peak Busyness |
|---|---|---|
| Beach | 16:00-18:00 (sunset) | 75-80% |
| Temple | 06:00-08:00, 17:00-19:00 | 65-70% |
| Restaurant | 12:00-13:00, 19:00-21:00 | 80-85% |
| Market | 10:00-12:00, 17:00-19:00 | 75-80% |
| Park | 07:00-09:00, 16:00-18:00 | 60-65% |

**Day-of-week multipliers** (tourist-adjusted):
| Day | Multiplier |
|---|---|
| Mon-Thu | 0.85–0.95 |
| Friday | 1.00 |
| Saturday | 1.15 |
| Sunday | 1.10 |

---

## 🔌 API Endpoints

### FastAPI Backend (`http://localhost:8000`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/crowd/analyze-itinerary` | Analyze crowd levels for itinerary activities |
| `POST` | `/api/elderly/optimize-itinerary` | Score activities for elderly suitability |
| `POST` | `/api/elderly/suggestions` | Get elderly-friendly venue suggestions |
| `POST` | `/api/child/optimize-itinerary` | Score activities for child-friendliness |
| `GET` | `/api/foursquare/nearby` | Search nearby venues via Foursquare |
| `GET` | `/` | Health check |
| `GET` | `/docs` | Swagger/OpenAPI documentation |

### Supabase Edge Functions

| Function | Purpose |
|---|---|
| `get-weather` | Fetch weather data for a destination |
| `geocode` | Convert location names to lat/lng coordinates |
| `get-recommendations` | AI-generated hotel/restaurant/attraction suggestions |
| `get-adaptive-suggestions` | Weather-aware activity swap suggestions |
| `generate-itinerary` | AI-generated full itinerary from scratch |

---

## 📁 Project Structure

```
roamiq/
├── src/                          # Frontend (React + TypeScript)
│   ├── pages/
│   │   ├── Auth.tsx              # Login / Sign-up page
│   │   ├── Index.tsx             # Landing / Dashboard
│   │   ├── Trips.tsx             # Trip list with dark mode toggle
│   │   ├── TripDetail.tsx        # Main trip view (tabs: Itinerary/Map/Explore/Overview/SOS)
│   │   ├── EmergencySOSPage.tsx  # Standalone Emergency SOS page (/emergency)
│   │   └── NotFound.tsx          # 404 page
│   ├── components/
│   │   ├── TripItineraryView.tsx  # Day-by-day activity timeline
│   │   ├── TripMapView.tsx        # Interactive Mapbox map
│   │   ├── EmergencySOSPanel.tsx   # Emergency SOS dashboard (button, map, services)
│   │   ├── AdaptiveEnginePanel.tsx # AI weather-aware suggestions
│   │   ├── CrowdInsightsPanel.tsx  # Crowd analytics & predictions
│   │   ├── ElderlyModePanel.tsx    # Elderly accessibility scoring
│   │   ├── ChildModePanel.tsx      # Child-friendly fun scoring
│   │   ├── RecommendationsPanel.tsx# Hotels/Restaurants/Attractions
│   │   ├── TrafficInsightsPanel.tsx# Traffic insights & route data
│   │   ├── CreateTripDialog.tsx    # New trip creation form
│   │   ├── AddItineraryItemDialog.tsx # Add activity dialog
│   │   ├── EditItineraryItemDialog.tsx # Edit activity dialog
│   │   ├── ActivityCard.tsx        # Single activity display card
│   │   ├── TripCard.tsx            # Trip card with AI destination images
│   │   └── ui/                     # Shadcn/Radix UI primitives (49 components)
│   ├── hooks/
│   │   ├── useTripRoutes.ts       # Geocoding, routes, distance-validated markers
│   │   ├── useNearbyEmergency.ts  # Emergency POI search (police/hospitals)
│   │   ├── useDestinationImage.ts # AI destination image fetching + caching
│   │   └── use-toast.ts           # Toast notification hook
│   ├── integrations/supabase/     # Supabase client & type definitions
│   └── data/                      # Mock data for demo
│
├── backend/                       # Backend (Python FastAPI)
│   ├── main.py                    # App initialization, CORS, router registration
│   ├── routers/
│   │   ├── crowd.py               # Crowd analysis endpoints
│   │   ├── elderly.py             # Elderly mode endpoints
│   │   ├── child.py               # Child mode endpoints
│   │   └── foursquare.py          # Foursquare venue search
│   ├── services/
│   │   ├── besttime.py            # BestTime API client wrapper
│   │   ├── crowd_predictor.py     # Crowd prediction engine (fallback)
│   │   ├── elderly_scorer.py      # Elderly scoring algorithm
│   │   ├── child_scorer.py        # Child scoring algorithm
│   │   ├── route_venues.py        # Route venue matching
│   │   └── foursquare.py          # Foursquare API client
│   ├── requirements.txt           # Python dependencies
│   └── .env                       # API keys (BestTime)
│
├── supabase/functions/            # Supabase Edge Functions (Deno)
│   ├── get-weather/               # Weather API integration
│   ├── geocode/                   # Location geocoding
│   ├── get-recommendations/       # AI recommendations
│   ├── get-adaptive-suggestions/  # AI adaptive suggestions
│   └── generate-itinerary/        # AI itinerary generation
│
├── package.json                   # Frontend dependencies
├── tailwind.config.ts             # TailwindCSS theme configuration
├── vite.config.ts                 # Vite build configuration
└── index.html                     # HTML entry point
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **Supabase** project (for auth, database, and edge functions)

### 1. Frontend Setup

```bash
# Install dependencies
npm install

# Start dev server (port 8080)
npm run dev
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server (port 8000)
python -m uvicorn main:app --port 8000 --reload
```

### 3. Open in Browser

Navigate to `http://localhost:8080`, sign up or log in, and start planning your trip!

---

## 🔑 Environment Variables

### Frontend (`.env` in root)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Backend (`backend/.env`)

```env
BESTTIME_API_KEY_PRIVATE=pri_xxxxx
BESTTIME_API_KEY_PUBLIC=pub_xxxxx
```

### Supabase Edge Functions (set in Supabase dashboard)

```
OPENWEATHER_API_KEY=your-openweather-key
MAPBOX_TOKEN=your-mapbox-token
GEMINI_API_KEY=your-gemini-key
```

---

## 📝 Changelog

### v1.1.0 — Latest Updates

#### 🚨 Emergency SOS Feature
- Added **SOS panic button** with pulse animation and `tel:112` emergency call
- **Quick dial grid** for Police (100), Ambulance (108), Fire (101), Emergency (112)
- **Nearby emergency services** — auto-locates police stations and hospitals via Mapbox POI search
- **Emergency map** with color-coded markers (blue = police, red = hospital) and user location
- **Google Maps integration** — one-click navigation to any emergency service
- Accessible as **5th "SOS" tab** in trip detail + standalone `/emergency` page

#### 🖼️ AI Destination Images
- Replaced deprecated `source.unsplash.com` with curated Unsplash photo library (30+ cities)
- **Mapbox satellite** aerial view fallback for uncurated destinations
- **Shimmer loading**, fade-in animations, gradient fallback with destination initial
- **"✨ AI" badge** on auto-fetched images

#### 🌙 Dark Mode
- Wired `next-themes` ThemeProvider for full dark/light mode switching
- **Sun/Moon toggle** in Trips page header
- Persists user preference in localStorage

#### 🗺️ Map Accuracy Improvements
- Reduced geocoding bounding box from ±1° (~111 km) to ±0.3° (~33 km)
- Added **haversine distance validation** — markers must be within **25 km** of destination
- **Vague location filter** — skips generic items like "Breakfast", "Hotel", "Airport"
- **Item type awareness** — meal/transport items require specific location names (≥15 chars)
- **Console debug logging** — `[Map] ✓/✗` traces for accepted/rejected locations

#### 🔧 Other Improvements
- Updated backend port from 8001 → **8000**
- Added **SOS shortcut button** (🛡️) in Trips page header
- Added Foursquare venue search router in backend

#### ⚡ Traffic-Aware Route Optimization
- Integrated **Mapbox Optimization API v1** with `driving-traffic` profile
- Waypoints reordered for **quickest path** (Traveling Salesman)
- **Per-segment congestion coloring** — green/amber/red route lines on map
- **Scrollable segment breakdown panel** — shows distance, duration, and congestion per leg
- **⚡ Optimized badge** in route stats overlay
- Routes **auto-refresh** on task completion, reorder, or edit

#### 🎨 Redesigned Auth Page
- **Full-bleed travel background** — AI-generated tropical beach photo
- **Glassmorphism card** — frosted glass login form with `backdrop-blur-xl`
- **Split layout** — branding + tagline on left, form on right (desktop)
- **Tab-style Sign In / Sign Up toggle** with animated transitions
- **Teal-to-emerald gradient CTA** button with glow shadow
- **Feature pills** — Weather Aware, Crowd Analytics, Elderly Mode, Child Mode, Emergency SOS
- **Floating animated icons** — subtle drifting travel icons in background

---

<p align="center">
  <strong>Built with ❤️ for NextGen Hackathon 2026</strong>
</p>
