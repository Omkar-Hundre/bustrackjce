# College Bus Tracker Web Application - Detailed Plan

## Overview

A real-time bus tracking system with three dashboards (Admin, Driver, Student) for monitoring bus locations, managing fleet data, and viewing notifications.

---

## Tech Stack

- Frontend : HTML, CSS, JS
- Backend : JS
- Realtime Database : Firebase/Supabase
- Map : Leaflet JS

---

## Core Features

### 1. **Authentication Flow**

- **Login Pages** for Admin/Driver (Students have public access).
- Credentials stored in **local storage** for persistent sessions.
- Protected routes using JWT token validation.

---

### 2. Admin Dashboard

#### Key Features:

- **Stats Panel**: Total/Online/Offline buses (calculated via driver location sharing status).
- **Sidebar** (Fixed):
  - Search bar to filter buses by name/number.
  - List of all buses with:
    - Online/Offline status indicator (green/red dot).
    - Actions: Edit (name/number), Track (focus on map), Remove.
  - **Add Bus** button/form:
    - Fields: Bus Name, Bus Number.
    - Default location: College's hardcoded coordinates.
- **Driver Management Table**:
  - Columns: Driver Image, Name, Phone, Assigned Bus.
- **Live Map**:
  - Real-time bus markers (online buses only).
  - Color-coded routes (predefined per bus).
  - Popup on marker click/hover: Bus Name/Number.

---

### 3. Driver Dashboard

#### Key Features:

- **Bus Selection**: Dropdown of buses added by admin.
- **Location Sharing**:
  - **Start Sharing** button: Enables GPS tracking, sets bus status to "online".
  - **Stop Sharing** button: Ends tracking, sets status to "offline".
  - Background location updates (handled via `navigator.geolocation.watchPosition` + Service Workers).
- **Route Map**:
  - Predefined stops marked (loaded from bus route data).
  - Live location polyline drawn as the bus moves.
- **Bus Full Toggle**:
  - Button to mark bus as full/not full.
  - Triggers notification visible across all dashboards.

---

### 4. Student Dashboard

#### Key Features:

- **Stats Panel**: Same as admin (total/online/offline buses).
- **Read-Only Bus List**:
  - Search and filter buses.
  - Track button to focus on a single bus (hides others on map).
- **Driver Details**: Read-only table (same as admin).
- **Live Map**:
  - All online buses displayed.
  - Clicking "Track" on a bus highlights its route and hides others.

---

### 5. Notifications

- **Panel** on all dashboards showing:
  - "Bus Full" status changes (e.g., "Bus 12 is full").
  - Updated via WebSocket broadcasts or polling.

---

## Project Structure & Data Models

### Simple Project Structure

college-bus-tracker/
├── index.html
├── css/
│ ├── style.css
│ ├── admin.css
│ ├── driver.css
│ └── student.css
├── js/
│ ├── config/
│ │ └── firebase-config.js
│ ├── auth.js
│ ├── map.js
│ ├── admin.js
│ ├── driver.js
│ └── student.js
├── assets/
│ └── images/
└── README.md

### Firebase Data Models

1. **users**
   {
   "uid": "string", // Firebase Auth UID
   "role": "string", // 'admin' or 'driver'
   "name": "string",
   "phone": "string",
   "image": "string" // URL
   }

2. **buses**
   {
   "id": "string",
   "name": "string",
   "number": "string",
   "location": {
   "lat": "number",
   "lng": "number"
   },
   "isOnline": "boolean",
   "isFull": "boolean",
   "driverId": "string", // Reference to user UID
   "route": [{
   "name": "string",
   "lat": "number",
   "lng": "number"
   }]
   }

3. **notifications**
   {
   "id": "string",
   "busId": "string",
   "message": "string",
   "timestamp": "number"
   }

### Pages

- `index.html` - Landing page with login
- `admin.html` - Admin dashboard
- `driver.html` - Driver dashboard
- `student.html` - Student dashboard

### Key JavaScript Files

- `auth.js` - Handles Firebase authentication
- `map.js` - Leaflet map setup and functions
- `admin.js` - Admin dashboard logic
- `driver.js` - Driver location sharing and status updates
- `student.js` - Student view functionality

---
