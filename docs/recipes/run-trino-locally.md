# Recipe — Run a local Trino dev cluster (and populate the dashboards)

The observability dashboards (Cluster Sağlığı, Hatalar, Düğümler, Performans, Resource Group
Performansı) show **only what the collector has gathered from a Trino cluster**. If they are empty,
it is almost always one of:

1. The **active environment** (topbar switcher) is not the one with a Trino API URL. Only an
   environment whose `trinoBaseUrl` is set is collected. Select **`local-trino`**.
2. The data is **older than the selected time range** — widen the range (24h / 7d) or collect fresh.
3. The **Trino cluster is unreachable / mis-configured**, so the collector gets nothing.

## The local Trino container

A local Trino (image `trinodb/trino:481`) runs as container **`trino-secure-trino`**, host port
**8085**, bind-mounting the host directory **`trino/etc` → `/etc/trino`**.

> **Gotcha (detached bind mount):** if the host `trino/etc` directory is deleted while the container
> runs, the mount detaches — the container's `/etc/trino` points at a now-deleted inode, so it can
> neither be read nor written (files created on the host are invisible; `docker exec … > /etc/trino/…`
> fails with ENOENT). Symptom: `/v1/query` → HTTP 500 (`File does not exist: /etc/trino/rules.json`),
> while `/v1/info` and `/v1/status` still work (cached in-memory). **Fix:** recreate `trino/etc` on the
> host with the full config below, then `docker restart trino-secure-trino` so the mount re-attaches.

### `trino/etc/` config (committed)

- `node.properties` — `node.environment=dev`, `node.id=trino-secure-coordinator`, `node.data-dir=/data/trino`
- `config.properties` — single-node coordinator, `http-server.http.port=8080`, `discovery.uri=http://localhost:8080`
- `jvm.config` — standard Trino JVM flags
- `access-control.properties` — `access-control.name=file`, `security.config-file=/etc/trino/rules.json`, `security.refresh-period=5s`
- `rules.json` — file-based system access control (permissive for dev; catalogs/queries allow all)
- `catalog/tpch.properties` — `connector.name=tpch`
- `catalog/memory.properties` — `connector.name=memory`

Health check:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H 'X-Trino-User: nizam' http://localhost:8085/v1/query   # 200
```

> `/v1/node` returns 404 on this single-node setup (failure-detector route not exposed); the collector
> is fault-tolerant and still collects `/v1/query` + `/v1/status`.

## Generate query activity (so Errors/Performance have data)

The dashboards need real queries. Run a mix of succeeding + failing queries via the REST API:

```bash
run_query() {  # user, source, sql
  local resp next; resp=$(curl -s -X POST http://localhost:8085/v1/statement \
    -H "X-Trino-User: $1" -H "X-Trino-Source: $2" --data "$3")
  next=$(echo "$resp" | python3 -c "import sys,json;print(json.load(sys.stdin).get('nextUri',''))")
  while [ -n "$next" ]; do resp=$(curl -s -H "X-Trino-User: $1" "$next");
    next=$(echo "$resp" | python3 -c "import sys,json;print(json.load(sys.stdin).get('nextUri',''))"); done
}
run_query ali.veli adhoc "SELECT count(*) FROM tpch.tiny.orders"
run_query ayse.kaya etl  "SELECT * FROM tpch.sf1.orders LIMIT 1000"
run_query mehmet reports "SELECT 1/0"                       # USER_ERROR
run_query svc_etl etl    "SELECT * FROM tpch.tiny.no_table" # USER_ERROR
```

## Collect the metrics

`COLLECTOR_TOKEN` is unset locally, so the trigger is open:

```bash
curl -s -X POST http://localhost:3110/api/collect          # collects every env with a trinoBaseUrl
# …or the standalone scheduler on an interval:
npm run collect
# …or click "Şimdi topla" on any dashboard.
```

Then open a dashboard, **select `local-trino`** in the topbar, and pick a recent range (1h works if
you just collected). Data appears.

> Named resource groups (etl/adhoc/reports with limits) need a Trino resource-group manager
> (`etc/resource-groups.properties` + `resource-groups.json`); without it every query lands in the
> default **`global`** group, which is what the RG dashboards then show.
