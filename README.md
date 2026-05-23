# ElderSmart 🧓🏽💼

ElderSmart is a cloud-based elder care coordination web application designed to streamline health monitoring, streamline medical appointments,
and optimize caregiver responsibility allocation. Built using the Rapid Application Development (RAD) methodology, 
the system addresses critical pain points in family-managed elder care by introducing systematic accountability and tracking.

---

## 🏗️ Core System Architecture & Modules

The system is engineered around two distinct user actors—Elders and Caregivers—and operates across highly decoupled functional modules managed via a unified cloud state:

### 1. Authentication & User Management
* Secured via Firebase Authentication.
* Role-based initialization for caregivers tracking specific elder profiles.

### 2. Caregiver Turn Management (Core Engine)
* Dynamically calculates and identifies which caregiver is responsible for upcoming medical appointments.
* Establishes clear ownership lines to eliminate coordination friction or missed care dates.

### 3. Health Monitoring Management
* Real-time vital and daily health record logging.
* Direct sync into reactive dashboard charts for visual historical analysis.

### 4. Appointment & Care Scheduling
* Centralized calendar coordination specialized for medical appointments, check-ups, and diagnostic schedules.

---

## 🛠️ Technology Stack & Infrastructure

* Frontend Environment: Native HTML5, CSS3 (Mobile-responsive UI structures), Vanilla JavaScript (ES6+ Asynchronous Event Handling).
* Backend-as-a-Service (BaaS): Firebase Authentication.
* Database Layer: Cloud Firestore (NoSQL Document-based structural database utilizing real-time listener subscriptions).

---

## 🗂️ Project Status & Implementation Phase

The repository contains the critical Core Functionality Phase, capturing structural development objectives:
* Complete user authentication lifecycle.
* Elder profile structural creation and relational viewing engines.
* Daily health record persistence management.
* Core Caregiver Turn Identification logic embedded directly into the scheduling flows.

---

## ⚙️ Local Installation & Deployment

Follow these steps to deploy a local development instance of the platform:

### Prerequisites
* A modern web browser.
* A Firebase Project initialized via the Google Cloud Console.

### Setup Instructions

1. Clone the project locally:
   ```bash
   git clone [https://github.com/AqifDani/ElderSmart.git](https://github.com/AqifDani/ElderSmart.git)
   cd ElderSmart

2. Initialize your local environment variables by setting up your Firebase configuration object within your application initialization script:
```bash
   const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

3. Serve the directory using a local development server (Live Server in VS Code

🔒 Security & Database Rules
Database access is restricted using native Firestore Security Rules to guarantee complete data privacy between different family/caregiver groups.
Review the rules deployed in production via the firestore.rules configuration file in this repository.
