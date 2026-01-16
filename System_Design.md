# System Design Document: VVE Code Runtime

**Version:** 1.2  
**Status:** Phase 2 Complete  
**Last Updated:** January 15, 2026

---

## 1. Project Overview

**Objective:** Build a distributed, collaborative Python IDE that allows multiple users to edit code in real-time and execute it remotely in a secure, isolated environment, specifically designed to operate within the AWS Free Tier constraints.

### Core Features

*   **Real-Time Collaboration:** Multiple users editing the same document simultaneously (Google Docs style) using CRDTs.
*   **Remote Code Execution (RCE):** Users can run Python scripts; execution happens on a remote server via a queuing system.
*   **Security:** User code is executed inside ephemeral, network-isolated Docker containers.

## 2. High-Level Architecture

The system follows a **Hybrid Event-Driven Architecture**:

*   **Synchronous:** HTTP REST API for submitting jobs and polling status.
*   **Asynchronous:** WebSocket for real-time collaboration; Redis Queues for job processing.

### Architecture Diagram

```mermaid
graph LR
    Client[Client (React)] <--> Gateway[Gateway (Node.js)]
    Gateway <--> Redis[Redis]
    Redis <--> Worker[Worker (Python/Docker)]
```

## 3. Technology Stack & Versions

> [!IMPORTANT]
> Strict adherence to versions is required to prevent dependency conflicts.

### 3.1 Frontend (Hosted on Vercel)
*   **Framework:** React v18.3.1
*   **Build Tool:** Vite v5.x
*   **Editor:** `@monaco-editor/react` v4.6.x
*   **Collaboration:** `yjs` v13.x, `y-websocket` v1.5.x

### 3.2 Gateway Service (Hosted on AWS EC2)
*   **Runtime:** Node.js v22 LTS
*   **Web Server:** Express v4.21.x
*   **Rate Limiting:** `express-rate-limit` v7.x
*   **Redis Client:** `ioredis` v5.4.x

### 3.3 Execution Service (Hosted on AWS EC2)
*   **Runtime:** Python 3.12
*   **Container Runtime:** Docker Engine 24.x
*   **Libraries:** `redis` (Python), `docker` (Python SDK)

### 3.4 Infrastructure
*   **Database/Cache:** Redis Stack v7.2
*   **Container Image:** `python:3.12-alpine` (Base image for user code)

## 4. Data Design

### 4.1 Redis Schema

| Key Type | Key Pattern | TTL | Description |
| :--- | :--- | :--- | :--- |
| **List** | `submission_queue` | N/A | Queue of pending job IDs. |
| **String** | `job:{jobId}` | 10 mins | Stores execution status & output. |
| **Pub/Sub** | `collab:room:{roomId}` | N/A | Yjs sync updates channel. |

### 4.2 Job JSON Structure

**Job Object (In Queue):**

```json
{
  "jobId": "uuid-v4-string",
  "sourceCode": "print('hello world')",
  "language": "python",
  "submittedAt": 1705500000000
}
```

## 5. Operational Limits & Guardrails (Crucial)

> [!WARNING]
> To ensure **Zero Cost** and prevent crashing the t2.micro instance, the following limits are hard-coded.

### 5.1 Concurrency Strategy (The Queue)
*   **Max Concurrent Executions:** 2
*   **Logic:** The Python Worker checks active containers. If ≥ 2 are running, it sleeps and does not pop from Redis.
*   **Reasoning:**
    *   Total RAM: 1 GB
    *   OS + Node + Redis overhead: ~500 MB
    *   Available for Docker: ~500 MB
    *   Per Container cost: ~128 MB × 2 = 256 MB (Safe Buffer).

### 5.2 Rate Limiting (The Circuit Breaker)
*   **Limit:** 10 Executions per Minute per IP Address.
*   **Mechanism:** Middleware on the Node.js API (`express-rate-limit`).
*   **Response:** Returns HTTP 429 Too Many Requests.
*   **Reasoning:** Prevents a single user from spamming the queue and degrading performance for others.

### 5.3 Data Limits
*   **Max Code Payload:** 5 KB (Prevent Redis memory bloat).
*   **Max Log Output:** 10 KB (Prevent Network Egress costs).
*   **Logic:** Worker truncates stdout if it exceeds this size before saving to Redis.

## 6. API Specification

### 6.1 REST API (Gateway)

#### `POST /api/execute`
*   **Body:** `{ "code": "string" }`
*   **Validation:**
    *   Check payload size < 5KB.
    *   Check Rate Limit for IP.
*   **Logic:** Push to Redis `submission_queue`. Return `{ "jobId": "..." }`.

#### `GET /api/status/:jobId`
*   **Logic:** Return JSON result from Redis.

### 6.2 WebSocket API

#### `ws://<server-ip>/collab/:roomId`
*   **Logic:** Standard Yjs text synchronization.

## 7. Detailed System Component Design

### 7.1 The Execution Worker (Python)

**Loop Logic:**

1.  Check `docker.containers.list()`. If count ≥ 2, `time.sleep(0.5)`.
2.  `BLPOP` from `submission_queue`.
3.  Write code to `/tmp/{jobId}.py`.
4.  Run Docker:
    ```python
    client.containers.run(
        image="python:3.12-alpine",
        command=f"python /code/{jobId}.py",
        volumes={f"/tmp/{jobId}.py": {'bind': f'/code/{jobId}.py', 'mode': 'ro'}},
        mem_limit="128m",       # HARD LIMIT
        nano_cpus=500000000,    # 0.5 CPU
        network_disabled=True,  # NO INTERNET
        detach=True
    )
    ```
5.  Wait for finish (Timeout: 5s).
6.  Truncate logs to 10KB.
7.  Save to Redis.
8.  **Cleanup:** Remove container & temp file.

## 8. Cost Assurance Strategy (AWS Free Tier)

### 8.1 Infrastructure Configuration
*   **Instance:** t2.micro (750 hours/month). Strictly ONE instance.
*   **Storage:** 30 GB EBS gp2/gp3.
*   **Billing Alarm:** Configure AWS CloudWatch to email if spend > $0.01 USD.

### 8.2 Maintenance Automation
*   **Problem:** Docker images and stopped containers consume disk space rapidly.
*   **Solution:** Setup a Cron Job on EC2 (`crontab -e`):
    ```bash
    0 * * * * docker system prune -f
    ```
    (Runs every hour to delete stopped containers and unused networks).

## 9. Development Plan

### Phase 1: The Editor (Local)
- [x] Setup React + Monaco.
- [x] Setup Node.js WebSocket Server.
- [x] **Goal:** Two browser tabs syncing text.

### Phase 2: The Engine (Local)
- [x] Setup Local Redis.
- [x] Implement Python Worker with concurrency checks (max 2).
- [x] **Goal:** Click "Run", see output in console.

### Phase 3: The Cloud (Deployment)
- [ ] Provision AWS EC2.
- [ ] Configure Billing Alarm (**First Step**).
- [ ] Install Docker & Node.
- [ ] Deploy.
