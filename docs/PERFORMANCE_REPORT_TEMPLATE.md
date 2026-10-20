# Performance test report — template

Fill this in with **real measurements** from your machine. Never paste numbers you did not observe.

## Test environment

| Item | Value |
|---|---|
| Date / time | _(e.g. 2026-10-18 14:00 IST)_ |
| Machine | _(OS, CPU, RAM)_ |
| Docker Desktop | _(version / WSL2 backend: yes-no)_ |
| App under test | `docker compose up -d backend` (image `payment-api:1.0`) |
| JMeter | _(version, e.g. 5.6.3)_ |
| Load levels | 10 / 25 / 50 virtual users |
| Ramp-up | 10 s (all levels) |
| Duration | 60 s steady state per level |
| Think time | 0 ms |
| Simulation settings | SIM_FAILURE_PERCENT=20, SIM_PENDING_PERCENT=10 |

## How results were produced

```powershell
docker compose up -d backend
powershell -File performance\run-load-tests.ps1 -Levels 10,25,50 -RampUp 10 -Duration 60 -CollectDockerStats
```

Raw results: `performance/results/load-<VUs>.jtl`, resource snapshots: `performance/results/docker-stats-<VUs>.csv`.

## Results table (auto-generated)

Paste the table from `performance/results/comparison.md` here:

| VUs | Requests | Errors | Error % | Avg (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) | Throughput (req/s) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | | | | | | | | | | |
| 25 | | | | | | | | | | |
| 50 | | | | | | | | | | |

## Resource utilization during the same window

Summarize `docker-stats-*.csv` (CPU % and memory for `payment-api`):

| VUs | Avg CPU % | Peak CPU % | Avg memory | Peak memory |
|---:|---:|---:|---:|---:|
| 10 | | | | |
| 25 | | | | |
| 50 | | | | |

## Analysis

Answer these from the numbers above:

1. **Latency degradation** — how did avg and p95 change from 10 → 25 → 50 VUs? Is growth linear or does it spike?
2. **Throughput** — did requests/s keep rising with VUs, or plateau (saturation point)?
3. **Errors** — error % at each level. Which responses failed (see JTL `responseCode` column: 5xx = server trouble, 4xx = client/assertion issues)?
4. **Resource bottleneck** — did CPU or memory hit a ceiling on the backend container at the highest level? Does that correlate with the latency/throughput change?
5. **Event-loop evidence** (optional but strong) — Grafana/Prometheus: `nodejs_eventloop_lag_seconds` and `nodejs_eventloop_lag_p99_seconds` during the same window. Rising lag under load supports a CPU/event-loop bottleneck claim.

## Notes / anomalies

- Restart the backend before each measurement campaign (`docker compose restart backend`) if you need a clean in-memory store.
- The store is in-memory: memory grows with transaction count. A long test run accumulates records — note the count at the end of each run.
