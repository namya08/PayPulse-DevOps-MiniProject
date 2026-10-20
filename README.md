# PayPulse — CI/CD Pipeline, Performance Testing and Real-Time Monitoring for a Digital Payment Application

An educational, **simulated** digital payment service with a React dashboard, wired into a complete DevOps workflow: **Jenkins CI/CD, Docker Compose, Kubernetes, JMeter load testing, Prometheus metrics and Grafana dashboards**.

> ⚠️ This is a college mini project. The API simulates payment outcomes deterministically (same order ID → same status). **No real payment gateway is integrated and no real financial data is processed.** All data lives in an in-memory store and is lost on restart.

---

## 1. Status: implemented / verified / requires setup

| Component | State | Evidence |
|---|---|---|
| Backend API (Express + prom-client) | ✅ Implemented + locally verified | 26/26 Jest+supertest tests pass (`npm test` in `backend/`) |
| React dashboard (Vite) | ✅ Implemented + build verified | `npm run build` succeeds; proxy + nginx paths consistent |
| Automated tests | ✅ Verified on Node v24.18.0 / Windows 11 | `backend/test/*.test.js` |
| Prometheus config + alert rules | ✅ Written (real config, not placeholder) | `monitoring/prometheus/` |
| Grafana provisioning + dashboard | ✅ Written; JSON validated | `monitoring/grafana/` |
| Docker / Compose stack | ✅ Written | **Not executed here** — Docker is not installed on the authoring machine. Requires your Docker Desktop install. |
| Jenkinsfile | ✅ Written | **Not executed here** — requires a Jenkins agent with Node + Docker. |
| Kubernetes manifests | ✅ Written | **Not executed here** — requires Minikube/Kind. Config is real and consistent, apply with `kubectl apply -f k8s --recursive`. |
| JMeter plan + scripts | ✅ Written | **Not executed here** — requires JDK + JMeter. `compare-results.js` tested against sample JTLs. |

Nothing above is claimed to be "running in production". The backend and the frontend build are the parts **verified in this repository**; everything Docker/K8s/Jenkins/JMeter related is complete and ready to run but needs the tools listed in §4.

---

## 2. Architecture

```
Browser (React dashboard)          JMeter (load tests)
        │  :8080 / :5173                   │  HTTP
        ▼                                  ▼
┌──────────────────────────────────────────────────────┐
│  Payment API — Node.js + Express  (port 3000)        │
│  /api/payments  CRUD simulation (in-memory store)    │
│  /healthz  /readyz        /metrics (prom-client)     │
│  structured JSON logs     deterministic outcomes     │
└──────────────┬───────────────────────────────────────┘
               │ scrape every 15 s
               ▼
        Prometheus :9090 ──► Grafana :3001
               ▲                    ▲
               │                    │
        cAdvisor :8082     dashboards + alert rules
      (container CPU/RAM)
```

**Request flow:** UI/JMeter → Express → validation → in-memory store (deterministic status) → JSON response → request log + metrics updated on `finish`.

**Metrics flow:** `prom-client` counters/histograms on the shared registry → scraped at `/metrics` by Prometheus → queried by the provisioned Grafana dashboard (`job="payment-api"`) and by alert rules.

**Simulation rules:** `orderId` is hashed (djb2) into a 0–99 bucket. Buckets `< SIM_FAILURE_PERCENT` → `FAILED`, next `SIM_PENDING_PERCENT` → `PENDING`, rest → `SUCCESS`. Same order ID always produces the same status; duplicate order IDs are rejected with **409**.

### API surface

| Method & path | Success | Errors |
|---|---|---|
| `POST /api/payments` `{orderId, amount, currency, method}` | 201 + transaction | 400 validation, 409 duplicate order ID |
| `GET /api/payments?page=&pageSize=&status=&search=` | 200 `{items, pagination, summary}` | 400 invalid query |
| `GET /api/payments/:id` | 200 transaction | 404 |
| `GET /api/payments/summary` | 200 totals | — |
| `GET /healthz`, `GET /readyz` | 200 | — |
| `GET /metrics` | Prometheus text | — |

Currencies: `INR, USD, EUR, GBP`. Methods: `card, upi, netbanking, wallet`. Statuses: `SUCCESS, FAILED, PENDING`. Errors always use the envelope `{"error":{"code","message","details?"}}`.

### Application metrics (consistent names/labels everywhere)

| Metric | Type | Labels |
|---|---|---|
| `http_requests_total` | counter | `method`, `route`, `status` |
| `http_request_duration_seconds` | histogram (10 buckets, 5 ms–5 s) | `method`, `route`, `status` |
| `http_errors_total` (status ≥ 400) | counter | `method`, `route`, `status` |
| `payment_transactions_total` | counter | `status` |
| `payment_amount_total` | counter | `status`, `currency` |
| `payment_transactions_stored` | gauge | `status` |
| + Node default metrics (`process_*`, `nodejs_*`) | — | `app="payment-api"` |

---

## 3. Repository layout

```
├── backend/                     Express API + Jest tests + Dockerfile
│   ├── src/                     app, config, logger, routes, store, metrics, middleware
│   └── test/                    26 automated tests
├── frontend/                    React (Vite) dashboard + nginx Dockerfile
├── docker-compose.yml           Primary demo: app + Prometheus + Grafana + cAdvisor
├── k8s/                         Deployment/Service/ConfigMap/HPA + monitoring manifests
├── monitoring/
│   ├── prometheus/              prometheus.yml + alerts.yml
│   └── grafana/                 datasource/dashboard provisioning + dashboard JSON
├── performance/
│   ├── payment-load-test.jmx    one reusable, property-driven JMeter plan
│   ├── run-load-tests.ps1       multi-level runner (+ optional docker stats capture)
│   └── compare-results.js       JTL → Markdown comparison table
├── docs/PERFORMANCE_REPORT_TEMPLATE.md
├── Jenkinsfile                  checkout → install → test → build → deploy
└── README.md
```

---

## 4. Prerequisites

| Tool | Needed for | Install (PowerShell) | Notes |
|---|---|---|---|
| Node.js 20+ & npm | backend, frontend, tests | already present (verified v24.18.0) | `node -v` |
| Git | version control | already present (verified 2.55.0) | — |
| Docker Desktop | Compose demo, images, Jenkins-in-Docker | `winget install Docker.DockerDesktop` | enable **WSL2 backend**, restart. Verify: `docker run hello-world` |
| JDK 17/21 | JMeter | `winget install EclipseAdoptium.Temurin.21.JRE` | `java -version` |
| Apache JMeter 5.x | load tests | `winget install Apache.JMeter` or download zip, then `$env:JMETER_HOME='C:\path\apache-jmeter-5.6.3'` | `jmeter -v` |
| kubectl + Minikube | K8s demo | `winget install Kubernetes.kubectl` + `winget install Kubernetes.minikube` | Minikube driver: docker (works on Windows 11 Home via WSL2) |
| Jenkins | CI/CD demo | run as container (§8) | no native install needed |

Port map (keep consistent across compose, scripts, docs):

| Port | Service |
|---|---|
| 3000 | Payment API |
| 5173 | Vite dev server (proxies `/api` → 3000) |
| 8080 | Dashboard (nginx in Compose/K8s) |
| 9090 | Prometheus |
| 3001 | Grafana |
| 8082 | cAdvisor |
| 8081 | Jenkins (if you map it there, see §8) |
| 30080/30090 | K8s NodePorts (frontend/Grafana) |

---

## 5. Run locally without Docker (fastest path)

```powershell
# Terminal 1 — API
cd D:\DevOps_MiniProj\backend
npm install
npm start                    # http://localhost:3000

# Terminal 2 — tests
cd D:\DevOps_MiniProj\backend
npm test                     # 26 tests

# Terminal 3 — dashboard
cd D:\DevOps_MiniProj\frontend
npm install
npm run dev                  # http://localhost:5173 (proxies /api to :3000)
```

Smoke checks (PowerShell 5.1 has no curl alias — use `curl.exe`):

```powershell
curl.exe http://localhost:3000/healthz
curl.exe -Method POST http://localhost:3000/api/payments `
  -ContentType "application/json" `
  -Body '{"orderId":"ORD-DEMO-1","amount":499.50,"currency":"INR","method":"upi"}'
curl.exe http://localhost:3000/api/payments
curl.exe http://localhost:3000/metrics | Select-String http_requests_total
```

Try the same `orderId` twice — the second call returns **409 DUPLICATE_ORDER_ID**. Change `SIM_FAILURE_PERCENT` / `SIM_PENDING_PERCENT` env vars to shift the outcome mix.

---

## 6. Primary demo: Docker Compose

```powershell
cd D:\DevOps_MiniProj
docker compose up -d --build
docker compose ps              # wait for backend: healthy
```

| URL | What |
|---|---|
| http://localhost:8080 | Payment dashboard |
| http://localhost:3000/api/payments | API |
| http://localhost:3000/metrics | Raw Prometheus metrics |
| http://localhost:9090 | Prometheus (Status → Targets: `payment-api` UP) |
| http://localhost:3001 | Grafana (login `admin` / `admin`, dashboard auto-provisioned under **DevOps Mini Project → Payment API Dashboard**) |
| http://localhost:8082 | cAdvisor (feeds the CPU/memory panels) |

Notes:
- If `cadvisor` cannot pull its image in your network, run the rest of the stack and accept that the two resource panels stay empty:
  `docker compose up -d backend frontend prometheus grafana`
- Set a real Grafana password for anything beyond a laptop demo: create `.env` with `GRAFANA_ADMIN_PASSWORD=yourpassword` before `docker compose up` (`.env` is git-ignored).
- Watch structured logs: `docker compose logs -f backend`.

**Screenshots for your report:** dashboard with transactions, Grafana dashboard (request rate + latency panels) during a load test, Prometheus Targets page, `docker compose ps` healthy states.

---

## 7. Load testing (JMeter)

One plan — `performance/payment-load-test.jmx` — drives the real API: `GET /api/payments` (list) → `POST /api/payments` (unique order ID per iteration) → `GET /api/payments/:id` (read-after-write), with response-code assertions.

```powershell
# API must be running, e.g.: docker compose up -d backend
$env:JMETER_HOME = 'C:\tools\apache-jmeter-5.6.3'   # adjust to your install

# 3 levels (10, 25, 50 VUs), 10s ramp-up, 60s steady state, + docker stats capture
powershell -File performance\run-load-tests.ps1 -Levels 10,25,50 -RampUp 10 -Duration 60 -CollectDockerStats

# Or a single ad-hoc run:
& "$env:JMETER_HOME\bin\jmeter.bat" -n -t performance\payment-load-test.jmx `
  -Jhost localhost -Jport 3000 -Jthreads 25 -Jrampup 10 -Jduration 60 `
  -l performance\results\load-25.jtl -j performance\results\load-25.log
```

Properties: `threads`, `rampup`, `duration`, `thinkMs`, `host`, `port`.

Outputs: `performance/results/load-<VUs>.jtl` + optional `docker-stats-<VUs>.csv`, and `comparison.md` (avg / p50 / p90 / p95 / p99 / max latency, throughput req/s, error %) generated by `compare-results.js`. Record only real numbers — fill `docs/PERFORMANCE_REPORT_TEMPLATE.md` from your runs and cross-check Grafana (`nodejs_eventloop_lag_seconds` is good evidence for bottleneck claims).

Expected discussion points (verify with your own data): rising p95 vs throughput plateau indicates saturation; error % should stay near the rate of assertion failures only — a healthy stack shows 0% at 10–25 VUs on a modern machine.

---

## 8. CI/CD with Jenkins

The `Jenkinsfile` runs: **Checkout → Install Dependencies → Automated Tests → Frontend Build → Docker Image Build → Deploy (manual gate)**.

**Agent requirements:** Linux agent (or Linux container) with Node 20+, Docker CLI + running daemon, Docker Compose v2. No credentials are hardcoded in the repo.

Quick start with Jenkins in Docker (map 8081 to avoid clashing with the dashboard on 8080):

```powershell
docker volume create jenkins_home
docker run -d --name jenkins -p 8081:8080 -p 50000:50000 `
  -v jenkins_home:/var/jenkins_home `
  -v /var/run/docker.sock:/var/run/docker.sock `
  jenkins/jenkins:lts-jdk17
```

> Running Jenkins-in-Docker with the host socket requires the Docker daemon on the **same** host and gives the container full Docker control — acceptable for a local lab, not for production. On Windows the `/var/run/docker.sock` path refers to Docker Desktop's Linux VM socket; this works when Jenkins itself runs as a Linux container inside that VM.

Job setup:
1. Open http://localhost:8081, unlock with the password from `docker logs jenkins`.
2. Install suggested plugins; add **NodeJS** tool if you want `npm` on the agent path (the pipeline just calls `npm`, so the agent needs it on PATH).
3. New Item → **Pipeline**, set *Pipeline script from SCM*, point at your GitHub repo, script path `Jenkinsfile`.
   - With a plain Pipeline-from-SCM job, `BRANCH_NAME` is unset, so tick **Build with Parameters → DEPLOY_ON_ANY_BRANCH = true** to enable the Deploy stage (or use a Multibranch Pipeline where `branch 'main'` matches).
4. Build (optionally "Build with Parameters"); the **Deploy** stage asks for confirmation before `docker compose up -d --build`, then health-checks the API and dashboard.
5. If you later push images to Docker Hub/GHCR: add a *Username/Password* credential in Jenkins (id e.g. `registry-creds`) and add a `docker login` step — never commit tokens.

---

## 9. Kubernetes demonstration (secondary path)

Requires Minikube (or Kind) + kubectl + locally built images.

```powershell
minikube start --driver=docker --cpus=2 --memory=4096
minikube addons enable metrics-server     # needed for the HPA to actually scale

cd D:\DevOps_MiniProj
docker build -t payment-api:1.0 ./backend
docker build -t payment-frontend:1.0 ./frontend
minikube image load payment-api:1.0
minikube image load payment-frontend:1.0

kubectl apply -f k8s --recursive

# Dashboard (NodePort 30080):
minikube service frontend -n payment-app --url
# Grafana (NodePort 30090) and Prometheus (port-forward):
kubectl port-forward -n payment-app svc/grafana 3001:3000
kubectl port-forward -n payment-app svc/prometheus 9090:9090

kubectl get pods -n payment-app -w
kubectl get hpa -n payment-app
```

The Grafana dashboard ConfigMap is generated from the single source JSON (never duplicated by hand):

```powershell
powershell -File k8s\monitoring\generate-dashboard-configmap.ps1
kubectl apply -f k8s\monitoring\grafana-dashboard-configmap.yaml
```

Manifests include: Namespace, ConfigMap, backend Deployment (2 replicas, readiness `/readyz`, liveness `/healthz`, CPU/memory requests+limits, non-root security context), frontend Deployment, Services (frontend NodePort **30080**), CPU HPA (2–5 pods @ 70%), Prometheus + Grafana deployments with the same metric names/labels as the Compose stack. The frontend nginx proxies `/api/` to the `backend` Service — same config file works in Compose and K8s.

Cleanup:

```powershell
kubectl delete namespace payment-app
minikube delete
```

---

## 10. GitHub

The repo works fully offline/local. To publish:

```powershell
cd D:\DevOps_MiniProj
git add .
git commit -m "PayPulse: payment API + dashboard + DevOps stack"
git branch -M main
git remote add origin https://github.com/<your-username>/DevOps_MiniProj.git
git push -u origin main
```

Then point the Jenkins Pipeline job at this remote. (Jenkins GitHub webhook trigger is optional; "Poll SCM" or manual builds are fine for a mini project.)

---

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| `docker compose up` fails pulling `cadvisor` | Start the other services explicitly (see §6 note) |
| Port already in use (3000/8080/9090/3001) | Stop the conflicting process or edit the **left side** of the port mapping in `docker-compose.yml` |
| Grafana dashboard empty | Wait for the first 15 s scrape; check Prometheus **Status → Targets** shows `payment-api` UP; check datasource URL is `http://prometheus:9090` |
| Grafana CPU/memory panels empty | cAdvisor not running or not scrapeable — see above |
| 409 in JMeter results | Plan uses `__UUID()` order IDs; 409 means the assertion failed — check the JTL `responseMessage` |
| `npm ci` fails in Docker build | Commit `package-lock.json` (both apps have one); rebuild with `--no-cache` |
| Jenkins "npm: not found" | Agent lacks Node — install Node 20+ or use a Node tool configuration |
| Jenkins can't talk to Docker | Ensure the agent can run `docker version`; on Jenkins-in-Docker mount the socket (§8) |
| Minikube image not found (`ImagePullBackOff`-ish) | `minikube image load payment-api:1.0` (both images), confirm `imagePullPolicy: IfNotPresent` |
| HPA shows `<unknown>` targets | `minikube addons enable metrics-server` |
| Backend tests fail after pulling the repo | `cd backend; npm install; npm test` — no other setup needed |

## 12. Cleanup

```powershell
docker compose down              # stop stack
docker compose down -v           # also delete Prometheus/Grafana volumes
docker rmi payment-api:1.0 payment-frontend:1.0
kubectl delete namespace payment-app
minikube delete
docker rm -f jenkins; docker volume rm jenkins_home
Remove-Item -Recurse -Force backend\node_modules, frontend\node_modules, frontend\dist
```

## 13. Project report checklist

1. Architecture diagram (§2) + short description of the deterministic simulation.
2. Screenshots: dashboard create/list/filter, duplicate-order 409, Prometheus targets, Grafana panels (request rate, p95, error %, payment outcomes, CPU/mem).
3. Test evidence: `npm test` output (26 passed).
4. CI/CD: Jenkinsfile stage screenshot + successful pipeline run.
5. Performance: filled-in `docs/PERFORMANCE_REPORT_TEMPLATE.md` with **your measured** numbers + `comparison.md`.
6. K8s: `kubectl get pods` (all Ready), HPA line, NodePort dashboard screenshot.

---

*Educational simulation — in-memory data, no real payments, no authentication by design. Keep it on localhost.*
