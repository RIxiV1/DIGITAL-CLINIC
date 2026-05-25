<div align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/activity.svg" alt="Digital Clinic Logo" width="120" />

  # 🏥 Digital Clinic

  **Medical-Grade Patient Health Dashboard**

  <br />

  [![React](https://img.shields.io/badge/React-18.3-blue?style=flat-square&logo=react)](https://react.dev/)
  [![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite)](https://vite.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
  [![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.0-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
  [![Vitest](https://img.shields.io/badge/Vitest-4.1-7E9B4E?style=flat-square&logo=vitest)](https://vitest.dev/)
</div>

---

Digital Clinic is a patient health dashboard that simplifies personal health management by translating complex lab results into easy-to-understand insights, providing diagnostic quizzes, and offering clear visual charts.

## Key Features

- **Health Locker and Report Upload**: Upload digital lab reports (PDF) or scanned images. The app automatically extracts key health indicators (e.g., Cholesterol, Testosterone, Vitamin D) using PDF parsing and OCR.
- **Symptom Quiz**: An interactive questionnaire that assesses symptoms and cross-references them with your lab reports to provide personalized recommendations.
- **Clear Visualizations**: Demystifies medical jargon with plain-English explanations. Includes interactive health scores, color-coded biomarker bars, and trend charts.

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS v4
- **Build & Test**: Vite 6, Vitest
- **Document Parsing**: Tesseract.js (OCR), pdfjs-dist (PDFs)

## Project Structure

- `src/app/components/` - Reusable UI components
- `src/app/contexts/` - Global state management
- `src/app/pages/` - Main application views (Dashboard, Quiz, Reports)
- `src/app/services/` - Core logic (PDF extraction, OCR, API calls)
- `src/app/utils/` - Helper functions

## Getting Started

### Prerequisites

- Node.js (>=20.11.0 <23.0.0)

### Installation

1. Clone the repository and navigate into the directory:
   ```bash
   git clone <repository-url>
   cd "DIGITAL CLINIC"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally

Start the development server:
```bash
npm run dev
```
The app will be available at [http://localhost:5173](http://localhost:5173).

### Testing

Run the test suite:
```bash
npm run test
```

### Production Build

Create an optimized build:
```bash
npm run build
```
Preview the production build locally:
```bash
npm run preview
```
