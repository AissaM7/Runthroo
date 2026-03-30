<p align="center">
  <img src="icon.png" alt="Runthroo Logo" width="80" />
</p>

<h1 align="center">Runthroo</h1>

<p align="center">
  <strong>Build pixel-perfect, interactive product demos in seconds.</strong><br>
  Capture any web application with full fidelity, build non-linear interactive journeys, and export self-contained HTML files anyone can open.
</p>

<p align="center">
  <video src="https://github.com/AissaM7/Runthroo/raw/main/landing/demo.webm" muted autoplay loop playsinline controls width="100%"></video>
</p>

<p align="center">
  <a href="#what-is-runthroo">Overview</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#how-it-works">How It Works</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#building-from-source">Build from Source</a>
</p>

---

## What is Runthroo?

Runthroo is a free, open-source macOS desktop application that lets you create **interactive click-through demos** of any website or web application. It is a fully local, privacy-first alternative to tools like Navattic, Reprise, and Storylane — with no accounts, no cloud uploads, and no vendor lock-in.

Unlike screen recorders or screenshot stitchers, Runthroo works by **serializing the actual DOM and CSS** of live web pages. This produces crisp, infinitely scalable replicas that look and behave identical to your real product.

---

## Features

### Capture Engine

| Capability | Description |
|---|---|
| **True DOM Serialization** | The Chrome extension captures the full HTML structure, computed styles, fonts, and images of any page — not a screenshot or video. |
| **CORS Bypass** | Built-in declarative net request rules automatically handle cross-origin assets (fonts, stylesheets, images) so captures render correctly. |
| **Platform Tagging** | Organize captures by product or platform name for easy retrieval across large libraries. |
| **Automatic Thumbnails** | Every capture generates a high-quality thumbnail preview for visual browsing. |

### Flow Editor

| Capability | Description |
|---|---|
| **Interactive Click Zones** | Draw rectangular click targets over any element. When viewers click the correct area, they advance to the next step. Wrong clicks trigger a subtle guidance pulse. |
| **Non-Linear Branching** | Build demos with multiple clickable paths per step so users can explore different product flows organically. |
| **Native Data Redaction** | Apply frosted-glass blur overlays to sensitive PII or proprietary data directly within the editor, without degrading the surrounding page fidelity. |
| **Inline Text Editing** | Modify any visible text content on captured pages — change names, values, or labels to personalize demos for specific prospects. |
| **Custom Cursor Animation** | Configure animated cursor movement between steps for a polished, guided experience during playback. |
| **Auto-Play Delays** | Set timed transitions between steps for hands-free, kiosk-style presentations. |
| **Step Reordering** | Drag-and-drop steps in the timeline to restructure demo flows instantly. |
| **Scroll-Aware Positioning** | Click zones remain perfectly anchored to their target elements regardless of page scroll position. |

### Export

| Capability | Description |
|---|---|
| **Single-File HTML Export** | Export your entire demo as one self-contained `.html` file. All pages, styles, click logic, and transitions are embedded inline. |
| **Zero Dependencies** | Exported files run in any modern browser with no server, no installation, and no internet connection required. |
| **Share Anywhere** | Send the exported file via email, Slack, or any file-sharing service. Recipients just double-click to open. |

### Application

| Capability | Description |
|---|---|
| **First-Launch Walkthrough** | A built-in 4-step onboarding guide walks new users through installing the extension, capturing pages, and building their first demo. |
| **100% Local and Private** | All data is stored on your machine in a local SQLite database. Nothing is transmitted externally. |
| **Code Signed** | The macOS application is signed with a valid Developer ID for a smooth installation experience. |

---

## Quick Start

### Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later
- **Google Chrome** (for the capture extension)
- **macOS** (the desktop app is currently built for Mac)

### 1. Download the Pre-Built Application

Download the latest release from the [Releases](https://github.com/AissaM7/Runthroo/releases) page:

- **Runthroo-2.0.0-arm64.dmg** — macOS application (Apple Silicon)
- **runthroo-extension.zip** — Chrome capture extension

### 2. Or Clone and Run from Source

```bash
git clone https://github.com/AissaM7/Runthroo.git
cd Runthroo
npm install
npm run rebuild
npm run dev
```

> The `rebuild` command recompiles `better-sqlite3` for your local Electron version.

---

## User Guide

This guide covers everything from installing the capture extension to building and exporting your first interactive demo.

### 1. Installation

Runthroo consists of two parts: the macOS desktop application (where you build demos) and the Chrome capture extension (how you clone pages).

**Desktop App:**
Download the latest `.dmg` from the [Releases](https://github.com/AissaM7/Runthroo/releases) page and drag it to your Applications folder.

**Chrome Extension:**

1. Download `runthroo-extension.zip` from the [Releases](https://github.com/AissaM7/Runthroo/releases) page and extract the folder.
2. Open Google Chrome and go to `chrome://extensions`.
3. Toggle **Developer mode** ON in the top right.
4. Click **Load unpacked** and select the extracted folder.

<p align="center">
  <img src="https://github.com/AissaM7/Runthroo/raw/main/landing/install-guide.gif" alt="Extension Install Guide" width="100%">
</p>

### 2. Capturing Pages

With the desktop app running, you can capture full-fidelity replicas of any web page.

**Single Page Capture**  
Navigate to any page, click the Runthroo extension icon, and select **Capture Current Page**. 

<p align="center">
  <img src="https://github.com/AissaM7/Runthroo/raw/main/landing/docs-ss-single-shot.png" alt="Single Page Capture" width="100%">
</p>

**Recording Multi-Step Demos**  
To capture a full flow, click **Start Recording**. As you navigate your app normally, Runthroo will automatically capture every page you visit. Click **Stop Recording** when finished.

<p align="center">
  <img src="https://github.com/AissaM7/Runthroo/raw/main/landing/docs-ss-recording.png" alt="Multi-Step Recording" width="100%">
</p>

### 3. The Library & Editor

**Library**  
All your captured pages automatically appear in the desktop app's Library, organized by platform.

<p align="center">
  <img src="https://github.com/AissaM7/Runthroo/raw/main/landing/docs-ss-library.png" alt="Capture Library" width="100%">
</p>

**Interactive Editor**  
Create a new Demo and add your captured pages. In the editor, you can:
- **Draw Click Zones:** Define interactive areas that link to the next step
- **Redact Data:** Add frosted glass blurs over sensitive PII
- **Edit Text:** Change any names or values on the page to personalize the demo

<p align="center">
  <img src="https://github.com/AissaM7/Runthroo/raw/main/landing/docs-ss-editor.png" alt="Interactive Flow Editor" width="100%">
</p>

### 4. Branching Logic

If your product flow isn't strictly linear, you can add multiple interactive paths to a single step so viewers can organically explore different features.

<p align="center">
  <img src="https://github.com/AissaM7/Runthroo/raw/main/landing/docs-ss-branching.png" alt="Branching Logic" width="100%">
</p>

### 5. Export and Share

When your demo is ready, just click **Export**. 

Runthroo generates a single, self-contained `.html` file containing the entire interactive replica of your app. Send it via email, Slack, or host it anywhere — viewers simply double-click to open it in their browser with zero dependencies required.

<p align="center">
  <img src="https://github.com/AissaM7/Runthroo/raw/main/landing/docs-ss-presentation.png" alt="Presentation Mode" width="100%">
</p>

---

## Building from Source

### Development

```bash
npm run dev          # Launch the app in development mode with hot reload
npm run build        # Compile the production bundle
```

### Project Structure

```
Runthroo/
├── electron/                  # Electron main process
│   ├── main.ts                # App entry, window management, IPC handlers
│   ├── preload.ts             # Context bridge for renderer
│   └── services/
│       ├── database.ts        # SQLite database (better-sqlite3)
│       ├── captureServer.ts   # Local HTTP server receiving captures from the extension
│       ├── exportEngine.ts    # Single-file HTML demo export logic
│       ├── fileManager.ts     # Capture file I/O
│       ├── htmlProcessor.ts   # DOM post-processing
│       └── thumbnailGenerator.ts  # Capture thumbnail generation (Sharp)
├── src/                       # React renderer process
│   ├── App.tsx                # Root layout
│   ├── components/
│   │   ├── TopBar.tsx         # Navigation header
│   │   ├── CaptureCard.tsx    # Capture thumbnail cards
│   │   ├── ClickZoneOverlay.tsx   # Click zone drawing canvas
│   │   ├── PageRenderer.tsx   # Iframe-based page preview
│   │   └── OnboardingWalkthrough.tsx  # First-launch tutorial
│   ├── views/
│   │   ├── CaptureLibrary.tsx # Capture browsing and management
│   │   ├── DemosLibrary.tsx   # Demo listing and creation
│   │   ├── FlowEditor.tsx     # Step sequencing and interaction editing
│   │   ├── ExportView.tsx     # Export configuration
│   │   └── Preview.tsx        # Full-screen demo preview
│   └── stores/                # Zustand state management
├── extension/                 # Chrome extension source
│   ├── manifest.json          # Manifest V3 configuration
│   ├── rules/                 # Declarative net request CORS rules
│   ├── popup/                 # Extension popup UI
│   ├── content/               # DOM serialization agent
│   └── background/            # Service worker
├── landing/                   # Public landing page (runthroo.vercel.app)
├── scripts/                   # Build and maintenance scripts
└── package.json
```

### Tech Stack

| Layer | Technology |
|---|---|
| Desktop Shell | Electron 30 |
| Frontend | React 19, TypeScript |
| State Management | Zustand |
| Styling | Tailwind CSS |
| Local Database | better-sqlite3 (SQLite) |
| Image Processing | Sharp |
| Build Tooling | electron-vite, Vite 5 |
| Extension | Chrome Manifest V3 |

---

## Creating the Mac Installer

To package the app as a distributable `.dmg` file:

```bash
npm run dist
```

This will:
1. Compile the production frontend and backend bundles.
2. Package them with Electron into a native macOS `.app`.
3. Code sign the application with your Developer ID certificate.
4. Generate a `.dmg` installer with a drag-to-Applications layout.

The output will be in the `dist/` folder (e.g., `dist/Runthroo-2.0.0-arm64.dmg`).

### Notarization (Optional)

If you have an Apple Developer account, you can notarize the app so macOS trusts it without security warnings:

```bash
export APPLE_ID="your@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
npm run dist
```

---

## Contributing

Contributions are welcome. Feel free to open issues, submit pull requests, or suggest new features.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). It is free for personal and non-commercial use. Any commercial use, resale, or incorporation into a paid product requires a separate commercial license — contact aissamamdouh14@gmail.com directly.
