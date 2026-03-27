<p align="center">
  <img src="icon.png" alt="Runthroo Logo" width="80" />
</p>

<h1 align="center">Runthroo</h1>

<p align="center">
  <strong>Build pixel-perfect, interactive product demos in seconds.</strong><br>
  Capture any web page, draw click zones, and export self-contained HTML presentations — no recording, no cloud, no lag.
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#-chrome-extension-setup">Chrome Extension</a> •
  <a href="#-building-from-source">Build from Source</a> •
  <a href="#-creating-the-mac-installer">Create Installer</a>
</p>

---

## ✨ What is Runthroo?

Runthroo is a free, open-source desktop tool that lets you create **interactive click-through demos** for any website or web application. Think of it like a lightweight alternative to tools like Navattic, Reprise, or Storylane — but completely local, free, and under your full control.

### Key Features

| Feature | Description |
|---|---|
| 🖥️ **Full-Page Capture** | Capture entire web pages with perfect CSS fidelity using the Chrome extension. |
| 🎯 **Invisible Click Zones** | Draw circular click zones over any element. They stay completely invisible during playback to maintain the illusion of a real app. |
| 🚀 **One-File HTML Export** | Export your entire demo as a single, self-contained `.html` file. No dependencies, no server — just open it in any browser. |
| 🔒 **100% Local** | Your data never leaves your machine. No accounts, no analytics, no cloud uploads. |
| ✏️ **Wrong-Click Guidance** | When a viewer clicks in the wrong spot during a demo, a subtle animated pulse guides them to the correct target. |
| 📜 **Scroll-Aware Positioning** | Click zones remain perfectly anchored to their target elements, even when the user scrolls the page during playback. |

---

## 📦 Quick Start

### Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later
- **Google Chrome** (for the capture extension)
- **macOS** (the desktop app is currently built for Mac)

### 1. Clone the Repository

```bash
git clone https://github.com/AissaM7/Runthroo.git
cd Runthroo
```

### 2. Install Dependencies

```bash
npm install
npm run rebuild
```

> The `rebuild` command recompiles `better-sqlite3` for your local Electron version.

### 3. Run the Desktop App

```bash
npm run dev
```

This launches the Runthroo editor in development mode. You'll see the main Capture Library window.

---

## 🔌 Chrome Extension Setup

The Chrome extension is required to capture web pages from your browser and send them to the desktop app.

### Installation (Developer Mode)

Since we haven't published to the Chrome Web Store yet, you'll install the extension manually. This takes about 15 seconds:

1. Open **Google Chrome** and navigate to `chrome://extensions`.
2. Toggle **"Developer mode"** ON in the top-right corner.
3. Click **"Load unpacked"**.
4. Navigate to the `extension/` folder inside this repository and select it.

You should now see the **Runthroo Capture** extension icon in your Chrome toolbar.

### Using the Extension

1. Navigate to any web page you want to capture.
2. Click the **Runthroo Capture** extension icon.
3. Click **"Capture Current Page"**. The extension will clone the full DOM and CSS of the page.
4. The captured page will automatically appear in the Runthroo desktop app's **Capture Library**.

> **Tip:** Capture multiple pages to build a multi-step demo flow. For example, capture a landing page, then a dashboard, then a settings panel.

---

## 🧩 How It Works

Runthroo follows a simple 4-step workflow:

### Step 1: Capture Pages
Use the Chrome extension to capture any number of web pages. Each capture preserves the full HTML and CSS exactly as it appears in your browser.

### Step 2: Build a Flow
In the desktop app, go to **"Demos"** and create a new demo. Add your captured pages as sequential steps in the flow. Reorder them by dragging.

### Step 3: Draw Click Zones
For each step, switch to the **Flow Editor** and draw a **circular click zone** over the element you want the viewer to interact with (e.g., a button, a link, a menu item). The click zone will be invisible during playback.

- Click zones are **scroll-aware** — if the target element is below the fold, the zone stays locked to it regardless of scrolling.
- If the viewer clicks in the wrong area, a **subtle pulsing animation** appears at the correct location to guide them.

### Step 4: Export
Click **"Export"** to generate a single, self-contained `.html` file. This file includes:
- All captured pages embedded as hidden templates
- The interactive click-zone logic
- A step counter and smooth cursor animations

You can share this `.html` file with anyone — they just open it in their browser. No installation needed on their end.

---

## 🏗️ Building from Source

### Development

```bash
npm run dev          # Start the app in development mode
npm run build        # Compile the production bundle
```

### Project Structure

```
Runthroo/
├── electron/                # Electron main process
│   ├── main.ts              # App entry, window management, IPC
│   └── services/
│       └── exportEngine.ts  # HTML demo export logic
├── src/                     # React renderer process
│   ├── App.tsx              # Root layout
│   ├── components/          # Reusable UI components
│   │   ├── TopBar.tsx       # Navigation header
│   │   ├── CaptureCard.tsx  # Capture thumbnail card
│   │   ├── ClickZoneOverlay.tsx  # Click zone drawing canvas
│   │   └── PageRenderer.tsx # Iframe-based page preview
│   ├── views/               # Full-page views
│   │   ├── CaptureLibrary.tsx
│   │   ├── DemosLibrary.tsx
│   │   ├── FlowEditor.tsx
│   │   ├── ExportView.tsx
│   │   └── Preview.tsx
│   └── stores/              # Zustand state management
├── extension/               # Chrome extension source
│   ├── manifest.json
│   ├── popup/               # Extension popup UI
│   ├── content/             # DOM capture agent
│   └── background/          # Service worker
└── package.json
```

### Tech Stack

| Layer | Technology |
|---|---|
| Desktop Shell | Electron 30 |
| Frontend | React 19 + TypeScript |
| State Management | Zustand |
| Styling | Tailwind CSS |
| Local Database | better-sqlite3 |
| Image Processing | Sharp |
| Build Tool | electron-vite |

---

## 💿 Creating the Mac Installer

To package the app as a distributable `.dmg` file:

```bash
npm run dist
```

This will:
1. Compile the production frontend and backend bundles.
2. Package them with Electron into a native macOS `.app`.
3. Generate a `.dmg` installer with a "Drag to Applications" window.

The output will be in the `dist/` folder (e.g., `dist/Runthroo-1.0.0-arm64.dmg`).

### Code Signing and Notarization (Optional)

If you have an Apple Developer account, you can notarize the app so macOS trusts it without security warnings:

```bash
export APPLE_ID="your@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
npm run dist
```

---

## 🤝 Contributing

Contributions are welcome! Feel free to open issues, submit pull requests, or suggest new features.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open sourced under the [MIT License](LICENSE).

---

<p align="center">
  Built with ❤️ by the Runthroo team.
</p>
