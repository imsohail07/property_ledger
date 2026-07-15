# Property Ledger

A modern, secure, responsive, mobile-optimized cloud-based Property Rental Management System for landlords. Built to run entirely within the free tiers of Firebase Services.

---

## 🚀 Features

- **Multi-Property & Unit Management**: Manage multiple properties, houses, and commercial shops.
- **Dynamic Billing Cycles**: Automatically generate monthly payments and handle continuing tenant contracts.
- **Tenant Management**: Store tenant details, pricing terms, security deposits, and upload vital documents (Agreement, Aadhaar, PAN).
- **Payment Ledger Timeline**: View payment history in a table (on desktop) or a compact list of interactive cards (on mobile).
- **Manual Backfill**: Manually add past or forgotten billing months to catch up on entries.
- **Professional Exports**: Generate and download professional PDF ledgers instantly (using safe standard fonts).
- **Strict Light Mode**: Beautiful, distraction-free modern typography and user interface.
- **Zero-Cost Architecture**: Operates fully on Firebase free-tiers.

---

## 🛠️ Technology Stack

- **Core**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **PDF Generation**: jsPDF, jspdf-autotable
- **Database & Serverless**:
  - Firebase Authentication (Email/Password & Google Login)
  - Cloud Firestore (Production Mode - Memory Only Cache)
  - Firebase Storage (Profile photos & Lease agreements)
  - Firebase Hosting (Static Assets caching & SPA Rewrites)

---

## 📂 Project Architecture

```
/
├── .env.example          # Environment variables template
├── .firebaserc           # Firebase target config
├── firebase.json         # Firebase services mapping & rewrite configuration
├── firestore.rules       # Firestore document security rules
├── storage.rules         # Firebase Storage uploads security rules
├── firestore.indexes.json# Database indexes config
├── src/
│   ├── components/       # Reusable components (Header, ui/Button, ui/Input, etc.)
│   ├── context/          # React Auth context
│   ├── hooks/            # Firestore React hooks (useProperties, useUnits, usePayments)
│   ├── pages/            # Page components (Login, Dashboard, PropertyDetails, TenantLedger)
│   ├── services/         # Third-party integrations (Firebase initialize, PDF generator)
│   ├── App.tsx           # Route guards and router config
│   ├── index.css         # Styling system base variables
│   └── main.tsx          # App entrypoint
```

---

## 🔒 Firebase Security Rules

### Firestore Rules (`firestore.rules`)
Ensures that all client operations are authenticated and restricted strictly to the user's namespace (`users/{userId}`). Users can never query or manipulate another landlord's data.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Storage Rules (`storage.rules`)
Ensures uploaded profile photos and contract agreements are private. Read and write access is restricted only to the authenticated uploader.

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 🗄️ Firestore Database Schema

- **Landlord Account Profile**:
  `users/{userId}`

- **Properties Subcollection**:
  `users/{userId}/properties/{propertyId}`
  - Properties: `name`, `location`, `address`, `coverPhoto`, `type`, `lastUpdated`

- **Property Rental Units Subcollection**:
  `users/{userId}/properties/{propertyId}/units/{unitId}`
  - Properties: `unitNumber`, `type`, `area`, `floor`, `notes`, `occupancyStatus`, `tenant: { name, phone, email, startDate, endDate, isContinuing, rent, maintenance, advance, deposit, photoURL, documentURLs: { agreement, aadhaar, pan } }`

- **Ledger Billing Payments Subcollection**:
  `users/{userId}/properties/{propertyId}/units/{unitId}/payments/{month}` (month is the document ID in `YYYY-MM` format)
  - Properties: `id`, `month`, `expectedRent`, `maintenance`, `negotiationDiscount`, `lateFee`, `finalRent`, `amountReceived`, `paymentDate`, `paymentMethod`, `remarks`, `status`, `isFinalized`

- **Audit Logs Subcollection**:
  `users/{userId}/activityLog/{logId}`
  - Properties: `action`, `details`, `timestamp`

---

## ⚙️ Setup & Deployment Instructions

### 1. Prerequisites
Install [Node.js](https://nodejs.org/) (v18+) and the Firebase CLI globally:
```bash
npm install -g firebase-tools
```

### 2. Installation
Clone the repository and install npm packages:
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file at the root of the project:
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_USE_PRODUCTION_FIREBASE=true
```

### 4. Running Locally
Run the Vite development server locally:
```bash
npm run dev
```

### 5. Build for Production
Create an optimized production bundle inside `dist/`:
```bash
npm run build
```

### 6. Deploy to Firebase
Authenticate with your Firebase account and select your project:
```bash
# Log in to your Google Account
firebase login

# Set active project target
firebase use --add

# Deploy hosting, database rules, and storage rules
firebase deploy
```

No manual edits should be required.
