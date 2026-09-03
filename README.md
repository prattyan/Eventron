# Eventron 🎪

**Eventron** is a modern, high-performance, full-stack event management and discovery platform. Built with **React 19**, **FastAPI (Python)**, and **MongoDB**, Eventron provides a seamless end-to-end experience—from AI-powered event creation and dynamic registration workflows to real-time ticketing, attendance tracking, and vector-based recommendations.

---

## ✨ Key Features

### 🔐 Authentication & Security
- **Multi-Modal Auth**: Sign in via Email/Password, Google OAuth (Firebase Auth), or Phone Number with SMS OTP (Twilio Verify).
- **In-Transit Encryption**: End-to-end AES-256-GCM payload encryption for sensitive client-server data transfer.
- **Role-Based Access Control (RBAC)**: Distinct permissions and views for **Attendees**, **Organizers**, and **Admins**.
- **Rate Limiting & Security Headers**: Built-in sliding-window rate limiter and HTTP security headers (`nosniff`, `DENY`, `XSS protection`).
- **Account Verification**: Secure OTP-protected account deletion and profile verification via Email and SMS.

### 📅 Advanced Event Management
- **AI Content Studio**: Integrated **Google Gemini** for generating event titles, descriptions, marketing copy, and agendas.
- **Registration Models**:
  - **Individual**: Standard single-attendee registration with custom questionnaire support.
  - **Team-Based**: Create teams, invite teammates via unique invite codes, and manage rosters.
- **Collaborator Workflows**: Invite and assign co-organizers to collaborate on events.
- **Organizer Analytics**: Real-time metrics on impressions, views, ticket sales, waitlists, and revenue.

### 🎫 Attendee Experience & Discovery
- **Vector-Based AI Recommendations**: Calculates cosine similarity across past user registrations using **Gemini text embeddings** to deliver personalized recommendations.
- **Digital Holographic Tickets**: Downloadable, printable QR-code entry passes with attendance scanning.
- **Payments & Promos**: Integrated **Razorpay** checkout with server-side HMAC-SHA256 signature verification and usage-limited promo codes.
- **Social & Feedback**: Attendee reviews, star ratings, and event message boards.

### ⚡ Real-Time & Communications
- **Real-Time Sockets**: Bidirectional **Socket.io** notifications for instant event updates, registration approvals, and messages.
- **Web Push Notifications**: Browser push notifications powered by VAPID (`pywebpush`).
- **Omnichannel Alerts**: Automated confirmation and notification emails via SMTP and Twilio Comms.
- **Persistent Disk Caching**: Query caching and event poster image proxy caching using **DiskCache** for low-latency delivery.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/), [Lucide React](https://lucide.dev/) |
| **Backend** | [Python 3.11](https://www.python.org/), [FastAPI](https://fastapi.tiangolo.com/), [Uvicorn](https://www.uvicorn.org/), [python-socketio](https://python-socketio.readthedocs.io/) (ASGI) |
| **Database** | [MongoDB Atlas](https://www.mongodb.com/atlas) via [PyMongo](https://pymongo.readthedocs.io/) with automated indexing |
| **AI & ML** | [Google Gemini](https://ai.google.dev/) (`models/text-embedding-004` & `gemini-2.5-flash`), [NumPy](https://numpy.org/) |
| **Auth & Third-Party** | [Firebase Auth](https://firebase.google.com/), [Twilio Verify & SMS](https://www.twilio.com/), [Razorpay](https://razorpay.com/), [DiskCache](https://grantjenks.com/docs/diskcache/) |
| **Deployment** | [Render](https://render.com/) (Single-service unified ASGI + SPA architecture) |

---

## 📂 Project Structure

```text
EventHorizon/
├── backend/                  # Python FastAPI Backend
│   ├── config.py             # Environment configuration & fallbacks
│   ├── database.py           # MongoDB connection pool & automated indexing
│   ├── encryption.py         # AES-256-GCM data encryption/decryption
│   ├── main.py               # FastAPI app, Socket.IO, API endpoints & SPA serving
│   ├── notifications.py      # Web Push (VAPID) notification handlers
│   ├── requirements.txt      # Python dependencies
│   └── security.py           # Data sanitization & permission guards
├── frontend/                 # React 19 + TypeScript + Vite Frontend
│   ├── components/           # UI components (AdminDashboard, Scanner, Modals, etc.)
│   ├── services/             # Client services (storageService, geminiService, etc.)
│   ├── App.tsx               # Primary application routing and views
│   ├── firebaseConfig.ts     # Firebase client SDK initialization
│   ├── index.html            # Single Page Application entry HTML
│   ├── package.json          # Frontend dependencies & build scripts
│   └── vite.config.ts        # Vite configuration & dev proxy
├── .node-version             # Node.js 20.10.0 runtime pin for Render
├── .python-version           # Python 3.11.9 runtime pin for Render
├── package.json              # Root scripts (concurrent dev runner)
├── pyrightconfig.json        # Python typing & virtualenv configuration
├── render.yaml               # Render Infrastructure-as-Code Blueprint
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or `v18.x`
- **Python**: `3.11.x`
- **MongoDB Atlas**: A cloud cluster with a database (e.g. `event_horizon`)
- **Firebase Project**: For client-side Google & Email authentication
- **Gemini API Key**: From [Google AI Studio](https://aistudio.google.com/)

---

### Installation & Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/EventHorizon.git
   cd EventHorizon
   ```

2. **Set up Python Virtual Environment**
   ```bash
   # Windows (PowerShell)
   python -m venv .venv
   .venv\Scripts\activate

   # Linux / macOS
   python3.11 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install All Dependencies**
   Install both frontend and backend dependencies using the root helper script:
   ```bash
   npm run install:all
   ```
   *(Or manually install via `pip install -r backend/requirements.txt` and `npm install --prefix frontend`).*

4. **Configure Environment Variables**
   Create a `.env` file in the project root directory:

   ```env
   # --- Server Configuration ---
   PORT=5005
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB_NAME=event_horizon

   # --- Security / AES-256-GCM Payload Encryption ---
   ENCRYPTION_KEY=Your32CharacterSecretEncryptionKey!
   VITE_ENCRYPTION_KEY=Your32CharacterSecretEncryptionKey!

   # --- Google Gemini AI ---
   GEMINI_API_KEY=your_gemini_api_key
   VITE_GEMINI_API_KEY=your_gemini_api_key

   # --- Firebase Client Authentication ---
   FIREBASE_API_KEY=your_firebase_api_key
   FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_STORAGE_BUCKET=your-app.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   FIREBASE_APP_ID=your_app_id

   # --- Razorpay Payment Gateway ---
   RAZORPAY_KEY_ID=rzp_test_YourKeyId
   RAZORPAY_KEY_SECRET=YourKeySecret
   VITE_RAZORPAY_KEY_ID=rzp_test_YourKeyId

   # --- Twilio SMS & Phone Verification ---
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_CUSTOM_APP_NAME=Eventron
   TWILIO_FROM_EMAIL=verified_email@yourdomain.com
   TWILIO_FROM_NAME=Eventron

   # --- SMTP Email Alerts ---
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-gmail-app-password
   SMTP_FROM=your-email@gmail.com

   # --- Web Push (VAPID) Notifications ---
   VAPID_SUBJECT=mailto:admin@eventron.com
   VAPID_PRIVATE_KEY=your_vapid_private_key
   VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
   ```

5. **Start the Development Servers**
   Run the backend (port `5005`) and frontend (port `3000`) concurrently:
   ```bash
   npm run dev
   ```
   - **Frontend App**: [http://localhost:3000](http://localhost:3000)
   - **Backend API & Swagger Docs**: [http://localhost:5005/docs](http://localhost:5005/docs)

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs both the FastAPI backend and Vite frontend concurrently |
| `npm run server` | Starts only the Python FastAPI backend server |
| `npm run frontend` | Starts only the Vite frontend development server |
| `npm run build` | Compiles the React frontend for production into `frontend/dist` |
| `npm run install:all` | Installs frontend dependencies and Python virtualenv packages |
| `npm run cache:clear` | Manually clears the backend DiskCache |
| `npm run cache:stats` | Returns current DiskCache hit/size statistics |

---

## ☁️ Deployment on Render

This project is configured as a single unified service on [Render](https://render.com/). FastAPI builds and serves the React single-page app and handles all APIs and WebSockets from a single port.

### Option A: Via Render Blueprint (Recommended)
1. Push your repository to GitHub.
2. Go to **Render Dashboard** > **New +** > **Blueprint**.
3. Select your repository. Render will automatically detect [`render.yaml`](render.yaml) and configure the service.
4. Fill in the required environment variables from your `.env` and click **Apply**.

### Option B: Manual Web Service Setup
- **Environment**: `Python`
- **Build Command**:
  ```bash
  npm install --prefix frontend && npm run build --prefix frontend && pip install -r backend/requirements.txt
  ```
- **Start Command**:
  ```bash
  uvicorn backend.main:combined_app --host 0.0.0.0 --port $PORT
  ```
- **Environment Variables**: Add `PYTHON_VERSION=3.11.9`, `NODE_VERSION=20.10.0`, and your `.env` keys.

---

## 👥 Team Members

| Name | Role | LinkedIn | GitHub |
| :--- | :--- | :--- | :--- |
| **Prattyan Ghosh** | Team Lead + Backend Developer | [![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?style=flat&logo=linkedin)](https://www.linkedin.com/in/prattyanghosh/) | [![GitHub](https://img.shields.io/badge/GitHub-black?style=flat&logo=github)](https://github.com/prattyan) |
| **Ashis Mahato** | Frontend Developer | [![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?style=flat&logo=linkedin)](https://www.linkedin.com/in/ashis-mahato-9733332b8/) | [![GitHub](https://img.shields.io/badge/GitHub-black?style=flat&logo=github)](https://github.com/Ashis-404) |
| **Arnab Ghosh** | Developer | [![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?style=flat&logo=linkedin)](https://www.linkedin.com/in/arnab-ghosh-854854289/) | [![GitHub](https://img.shields.io/badge/GitHub-black?style=flat&logo=github)](https://github.com/arnabg2005) |
| **Aritra Debnath** | Ideation & Design | [![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?style=flat&logo=linkedin)](https://www.linkedin.com/in/aritradeb07/) | [![GitHub](https://img.shields.io/badge/GitHub-black?style=flat&logo=github)](https://github.com/AritraDeb05) |
| **Arka Karmakar** | QA & Operations | [![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?style=flat&logo=linkedin)](https://www.linkedin.com/in/arka-karmakar-733b7729a/) | [![GitHub](https://img.shields.io/badge/GitHub-black?style=flat&logo=github)](https://github.com/Arkakarmakar123) |

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more details.
