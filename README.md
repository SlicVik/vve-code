# VVE Code

A collaborative Python editor that abstracts away the complexity of environment setup. No installation required—create a room, share the Room ID, and start building together.

![Python](https://img.shields.io/badge/Python-3.12-blue)
![React](https://img.shields.io/badge/React-18-61DAFB)

## Features

- **Real-time Collaboration** — Multiple users can edit code simultaneously with live cursor tracking
- **Instant Execution** — Run Python code in a secure, sandboxed Docker environment
- **No Setup Required** — 50+ popular Python libraries pre-installed and ready to use
- **Plot Support** — Matplotlib visualizations render directly in the browser
- **File Upload** — Import CSV, JSON, and other data files for analysis

## Tech Stack

### Frontend
- **React 18** with Vite for fast development
- **Monaco Editor** — The same editor that powers VS Code
- **Yjs** — CRDT-based real-time collaboration

### Backend
- **Node.js + Express** — API Gateway with WebSocket support
- **Redis** — Job queue for code execution
- **Python Worker** — Executes code in isolated Docker containers
- **Docker** — Sandboxed runtime for secure code execution

### Infrastructure
- **AWS EC2** — Cloud compute (t3.micro, Free Tier eligible)
- **Vercel** — Frontend hosting with automatic deployments
- **Cloudflare Tunnel** — HTTPS access without a domain

## Project Structure

```
vve-code/
├── client/           # React frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── lib/          # API and collaboration logic
│   │   └── hooks/        # Custom React hooks
│   └── package.json
├── gateway/          # Node.js API server
│   ├── routes/       # API endpoints
│   ├── middleware/   # Rate limiting
│   └── server.js
├── worker/           # Python execution engine
│   └── worker.py
└── allowlist.txt     # Approved Python packages
```

## Quick Start (Local Development)

### Prerequisites
- Node.js 22+
- Python 3.12+
- Docker
- Redis

### 1. Clone and Install

```bash
git clone https://github.com/SlicVik/vve-code.git
cd vve-code

# Install frontend dependencies
cd client && npm install

# Install backend dependencies
cd ../gateway && npm install
```

### 2. Start Services

```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start Gateway
cd gateway && npm run dev

# Terminal 3: Start Worker
cd worker && python3 worker.py

# Terminal 4: Start Frontend
cd client && npm run dev
```

### 3. Open in Browser
Visit `http://localhost:5173`

## Deployment

- **Frontend** — Hosted on Vercel with automatic deployments from GitHub
- **Backend** — AWS EC2 instance running the API gateway and Python workers

## Supported Libraries

VVE Code comes with 50+ pre-approved Python libraries including:

| Category | Libraries |
|----------|-----------|
| Data Science | pandas, numpy, scipy, scikit-learn |
| Visualization | matplotlib, seaborn, plotly |
| Machine Learning | tensorflow, torch, xgboost |
| Utilities | requests, beautifulsoup4, pillow |

See [allowlist.txt](./allowlist.txt) for the complete list.

## License

© 2026 VVE Code. All rights reserved.
