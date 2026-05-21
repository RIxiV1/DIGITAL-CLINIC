# Digital Clinic — High-Fidelity Health Dashboard

[![React](https://img.shields.io/badge/React-18.3-blue?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite)](https://vite.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.0-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-4.1-7E9B4E?style=flat-square&logo=vitest)](https://vitest.dev/)

A premium, medical-grade patient health dashboard designed with clinical clarity, visual excellence, and user empathy. This application simplifies personal health management by translating complex lab results into plain-English insights, providing diagnostic quizzes, and offering interactive visualizations.

---

## Key Features

### Health Locker and Report Upload
- **Smart PDF Parser and OCR:** Upload digital lab reports or scanned images. The dashboard parses text directly using `pdfjs-dist` and applies OCR using `Tesseract.js` for image-based uploads.
- **Biomarker Extraction:** Automatic identification of key health indicators (such as Cholesterol, Testosterone, Vitamin D, HbA1c) and extraction of their values, units, and reference ranges.
- **Manual Data Entry:** Provides a fallback interface allowing patients to manually input or fine-tune biomarker metrics when automated extraction is not used.

### Symptom Quiz and Diagnostics
- **Interactive Scoring Flow:** An evidence-based questionnaire assessing dynamic symptoms across physical, cognitive, and metabolic indicators.
- **Context-Aware Recommendations:** Automatically cross-references quiz results with user lab reports to pinpoint potential health concerns and recommend target lab panels.

### Medical Translation and Visualization
- **Plain-English Explanations:** Demystifies complex medical jargon. Every biomarker includes tooltips, normal ranges, and explanations of what high or low levels mean for general health.
- **Dynamic UI Elements:**
  - **Health Rings:** Interactive SVG visualization showcasing overall metabolic/hormonal score.
  - **Biomarker Bars:** Color-coded status bars detailing where a user falls in the clinical range (Low, Optimal, High).
  - **Sparklines and Trends:** Inline mini-charts that display historical changes of biomarkers over time.

---

## Tech Stack

| Technology | Purpose | Key Benefits |
| :--- | :--- | :--- |
| **React 18.3** | Frontend Library | Component-driven UI architecture, fast rendering via Virtual DOM. |
| **Vite 6.0** | Build Tool & Dev Server | Lightning-fast Hot Module Replacement (HMR) and optimized production bundles. |
| **TypeScript 5.6** | Programming Language | Strong compile-time typing, reducing runtime errors and improving code reliability. |
| **Tailwind CSS v4** | CSS Framework | Modern styling engine with native CSS variable integration and high-performance builds. |
| **Framer Motion** | Animation Library | Smooth micro-animations, slide-ins, and modal transitions for a premium feel. |
| **Vitest** | Testing Framework | High-performance unit testing matching Vite's bundling pipeline. |
| **Tesseract.js** | Optical Character Recognition | In-browser OCR to scan, extract, and parse text from images of paper lab documents. |
| **pdfjs-dist** | PDF Parsing | Extract text directly from digital PDF lab reports. |


---


## Getting Started

### Prerequisites

Ensure you have Node.js installed.
- **Node.js**: `>=20.11.0 <23.0.0`
- **npm**: Compatibility is bundled with Node.js

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd "DIGITAL CLINIC"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

### Running Locally

To launch the project in development mode:
```bash
npm run dev
```
The server will boot at [http://localhost:5173](http://localhost:5173). The interface supports HMR (Hot Module Replacement)—any code changes will update in the browser instantly.

### Running Tests

To run the unit tests suite (Vitest):
```bash
npm run test
```

To run the tests in interactive watch mode:
```bash
npm run test:watch
```

### Production Build

To compile TypeScript, run unit tests, and bundle the React code into optimized, production-ready static assets:
```bash
npm run build
```
This generates the output files inside the `dist` directory.

### Preview Production Build

To preview the generated production files locally:
```bash
npm run preview
```

---

## Testing Strategy

The application leverages **Vitest** for unit and integration testing. Key areas covered by tests:
1. **PDF Parser (`pdfParser.test.ts`):** Validates text extraction, regex parsing, and confidence scoring rules on sample document shapes.
2. **Biomarkers Data (`biomarkers.test.ts`):** Verifies correct classification (high/low/optimal) against various clinical test inputs.

Run tests regularly during development using `npm run test` to verify your changes.

---

## License

This project is proprietary and confidential. All rights reserved.
