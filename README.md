# ElderSmart 🧓🏽💼

**[View Live Application](https://eldersmart.onrender.com/)** | 🏆 **Winner: INNOGEN 26 Gold Award**

ElderSmart is a cloud-based elder care coordination web application designed to streamline health monitoring, automate medical appointments, and optimize caregiver responsibility allocation. Built using the Rapid Application Development (RAD) methodology, the system addresses critical pain points in family-managed elder care by introducing systematic accountability and tracking.

---

## 🏗️ Core Innovation: Care Management & Task Scheduling

The system is engineered around two distinct user actors—Elders and Caregivers—with its core innovation driven by advanced task scheduling and remote care management functions:

### 1. Algorithmic Fairness Engine (Task Scheduling)
* Dynamically assigns caregivers to upcoming medical appointments and daily tasks to eliminate manual coordination friction.
* Utilizes a weighted distribution model to calculate pending workloads and previously completed shifts, ensuring equitable responsibility allocation and reducing scheduling conflicts.

### 2. Comprehensive Care Management
* **Health Monitoring:** Real-time vital and daily health record logging with direct sync into reactive dashboard charts for historical analysis.
* **Centralized Coordination:** Automated calendar sync specialized for medical appointments, check-ups, and diagnostic schedules.

### 3. Authentication & User Management
* Secured via Firebase Authentication with role-based access for caregivers tracking specific elder profiles.

---

## 🗄️ Database Architecture (Cloud Firestore)

The backend utilizes a NoSQL database schema engineered across 7 core collections, utilizing strict family-unit data isolation protocols:

* **`users`**: Manages authentication profiles and role definitions.
* **`elders`**: Stores primary demographic and medical baseline data for care recipients.
* **`family_groups`**: Enforces strict data isolation by securely linking designated caregivers to specific elders.
* **`health_records`**: Logs daily vital signs and medical metrics, directly related to specific elder profiles.
* **`appointments`**: Stores centralized scheduling details for medical check-ups.
* **`tasks`**: Tracks daily care requirements (e.g., medication, hygiene) and live completion statuses.
* **`workload_logs`**: Feeds the algorithmic fairness engine by tracking historical shift data and assigned weights per caregiver.
## 🛠️ Technology Stack & Infrastructure

* Frontend Environment: Native HTML5, CSS3 (Mobile-responsive UI structures), Vanilla JavaScript (ES6+ Asynchronous Event Handling).
* Backend-as-a-Service (BaaS): Firebase Authentication.
* Database Layer: Cloud Firestore (NoSQL Document-based structural database utilizing real-time listener subscriptions).

---

## 🗂️ Project Status & Implementation Phase

**Status: Completed & Active Maintenance**

The core modules of ElderSmart are fully engineered, functional, and deployed. The system successfully executes real-time data synchronization across all primary collections and handles caregiver scheduling efficiently.

Current development focuses on maintaining the existing infrastructure and iterating on new features, including:
* Ongoing maintenance of the authentication, health monitoring, and appointment scheduling modules.
* Refining and optimizing the algorithmic fairness engine for edge-case scheduling scenarios.
* Prototyping and developing additional features for future iterations to further enhance care management.

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
