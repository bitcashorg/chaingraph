# ChainGraph: Real-Time GraphQL Toolkit for EOSIO/Antelope

ChainGraph provides performant GraphQL APIs for blockchain applications featuring state of art subscriptions, advanced filtering, sorting, pagination and aggregations across multiple blockchains.

> 🚧 Note: This project is in active development - feel free to explore and contribute! 🏗️

## Features

- **Real-Time GraphQL Subscriptions** – Subscribe to blockchain state and transactions/instructions/actions
- **Advanced Data Operations** – Powerful search, filtering, sorting and aggregation capabilities
- **Blockchain RPC Facade** – Push through guarantees for reliable data access
- **Multi-Blockchain Support** – Read data from multiple contracts, tables and blockchains on a single request
- **Microfork Handling** – Subscribe to state on the clients not to deltas
- **Developer Tools** – CLI with high quality application starters to speed up go-to-market

## Architecture

<img src="./assets/chaingraph-diagram.svg" alt="ChainGraph Architecture" />

Hasura is a high-performance GraphQL engine that exposes the GraphQL schema and optimizes subscriptions. It includes an API authentication service and real-time data indexing services, which are currently written in NodeJS.

For more information on scaling, read this blog post: [Scaling to 1 Million Active GraphQL Subscriptions](https://hasura.io/blog/1-million-active-graphql-subscriptions/)


## Project Structure

### Apps
- [__apps/chaingraph.io__](./apps/chaingraph.io/README.md) - Main website
- [__apps/supabase__](./apps/supabase/README.md) - Supabase support ( experimental )
- [__apps/hasura__](./apps/hasura/README.md) - GraphQL engine and database migrations using Hasura
- [__apps/indexer__](./apps/indexer/README.md) - Multi-threaded NodeJS service for real-time data deserialization and indexing

### Packages

- [__packages/genql__](./packages/genql/README.md) - GenQL client for type-safe GraphQL queries
- [__packages/mappings__](./packages/mappings/README.md) - Data mappings for indexing ( temporary )
- [__packages/tsconfig__](./packages/tsconfig/README.md) - TypeScript configuration

## Technology

ChainGraph API nodes are light and index whitelisted data tables and actions. The project is split into separate micro-services to make it easier to scale:

- **chaingraph-graphql**: GraphQL engine and database migrations using Hasura
- **chaingraph-indexer**: Multi-threaded NodeJS service for real-time data deserialization and indexing

## Data Whitelisting

ChainGraph is currently using a contract mapping protocol that allows developers to define how the data is indexed. Through these mappings ChainGraph can index the data in a way that is good for introspection of the blockchain heuristics. We will iterate on the mapping protocol to achieve fully typed schemas in the future.

## Development Setup

### Requirements
- Bun 1.0+

### Quick Start

```bash
bun install
git clone https://github.com/chaingraph/chaingraph.git
cd chaingraph
bun install
```

### Development Commands

```bash
# Hasura Setup and Management
bun run hasura:start  # Start Hasura services (GraphQL Engine, Postgres, Data Connector)
bun run hasura:stop   # Stop Hasura services
bun run hasura:reset  # Reset Hasura environment (removes volumes and restarts)
bun run hasura:logs   # View Hasura logs in real-time
bun run psql          # Connect to Postgres database directly
```

###  Configuration

ChainGraph runs with the following default configuration:

- **GraphQL API**: http://localhost:3333
- **Hasura Console**: http://localhost:3333/console
- **Postgres Database**: localhost:5432

Key environment variables:
- `HASURA_GRAPHQL_ADMIN_SECRET`: Required for console access and admin operations
- `HASURA_GRAPHQL_METADATA_DATABASE_URL`: Postgres connection for Hasura metadata
- `PG_DATABASE_URL`: Main database connection string

> Note: In production, make sure to change the admin secret and secure your environment variables.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

MIT License

**Full Stack (Docker/Elestio)**
- Env file: place your environment in the repo root `./.env` (Elestio CI/CD injects env here). The compose file reads from it for both variable substitution and runtime envs.
- Start stack: from repo root run `pnpm run full:start` (or `docker compose --env-file .env -f docker/full-elestio.yml -p chaingraph up --build -d`).
- Logs: `pnpm run full:logs` or `docker compose --env-file .env -f docker/full-elestio.yml -p chaingraph logs -f`.
- Stop/clean: `pnpm run full:stop` / `pnpm run full:down`.
- Hasura Console: `http://<host>:3333/console` (header `x-hasura-admin-secret: <HASURA_GRAPHQL_ADMIN_SECRET>`). GraphQL API at `http://<host>:3333/v1/graphql`.
- Required envs (examples in `docker/.env_elestio_example`):
  - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
  - `PG_DATABASE_URL` (e.g., `postgres://user:pass@db:5432/dbname`)
  - `HASURA_GRAPHQL_METADATA_DATABASE_URL` (can reuse `PG_DATABASE_URL`)
  - `HASURA_GRAPHQL_ADMIN_SECRET`
  - `SHIP_WS_URL` (SHiP websocket, e.g., `wss://...`)
  - `SHIP_WS_URL_BACKUP` (optional; backup SHiP websocket used for failover)
  - `RPC_URL` (HTTP RPC endpoint for `/v1/chain/get_info`)
  - `RPC_URL_BACKUP` (optional; backup HTTP RPC endpoint used for failover)
  - `CHAIN_ID` (network chain id)
  - `CHAIN_NAME` (optional; defaults to `l1`)
  - `INDEX_FROM_BLOCK` (optional): if DB is empty, starts exactly here (`0` allowed for genesis). If DB has data, it triggers a backfill of only the missing earlier slice (see behavior below).
- Indexer behavior: on start it upserts the `chains` row (using `CHAIN_NAME`, `CHAIN_ID`, `RPC_URL`). Then:
  - Internal gaps: automatically backfills any internal missing block ranges detected in the DB for your `CHAIN_NAME`.
  - Env-driven backfill: if `INDEX_FROM_BLOCK` is set and ≤ DB tip, the indexer backfills from `INDEX_FROM_BLOCK` up to the current DB tip (re-processing that range as needed). If `INDEX_FROM_BLOCK` is earlier than the earliest indexed block, it also includes that earlier slice. All backfill ranges are clamped to be ≥ `INDEX_FROM_BLOCK`.
- Skip ahead: if `INDEX_FROM_BLOCK` is set and > DB tip, the indexer skips backfill and starts realtime at `INDEX_FROM_BLOCK`.
  - Head clamp: if the requested start/end exceed the chain head height, the indexer logs a warning and clamps to the current head (SHiP cannot stream future blocks).
  - Real-time: after backfill (when applicable), the indexer starts real-time from `DB tip + 1`.
  - Empty DB: if the DB is empty and `INDEX_FROM_BLOCK` is not set, it starts from the node head.
  It writes into `blocks`, `transactions`, `actions`, `table_rows`.

Failover behavior
- SHiP (state history): set `SHIP_WS_URL` and optional `SHIP_WS_URL_BACKUP`.
  - Realtime failover: if primary errors/closes, auto-reconnects to backup. On next reconnect event, prefers primary again.
  - Backfill failover: missing-range backfills also use SHiP failover and resume the range from the last processed block after reconnecting.
- RPC (HTTP): set `RPC_URL` and optional `RPC_URL_BACKUP`.
  - All RPC calls (e.g., `get_info`, `get_abi`, `get_table_by_scope`, `get_table_rows`) try the active endpoint; on failure they automatically switch to the alternate and succeed if available.
  - When running on backup, the next call will attempt the primary first to fail back automatically.
- Database checks:
  - Shell: `docker compose -f docker/full-elestio.yml exec -it db psql -U $POSTGRES_USER -d $POSTGRES_DB`
  - Quick queries:
    - Chains: `SELECT chain_name, chain_id FROM chains;`
    - DB tip: `SELECT MAX(block_num) FROM blocks WHERE chain = '$CHAIN_NAME';`
    - Earliest: `SELECT MIN(block_num) FROM blocks WHERE chain = '$CHAIN_NAME';`
    - Missing ranges:
      `SELECT block_num+1 AS missing_start, next-1 AS missing_end FROM (SELECT block_num, LEAD(block_num) OVER (ORDER BY block_num) AS next FROM blocks WHERE chain='$CHAIN_NAME') s WHERE next > block_num + 1;`
- Linux host RPC: if your RPC runs on the host, set `RPC_URL=http://host.docker.internal:8888` and add under `indexer`:
  - `extra_hosts: ["host.docker.internal:host-gateway"]` in `docker/full-elestio.yml`.

**Elestio Deploy**
- Configure envs in Elestio CI/CD (Project Settings → Environment). Use `docker/.env_elestio_example` as a reference. At minimum set: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `PG_DATABASE_URL`, `HASURA_GRAPHQL_ADMIN_SECRET`, `HASURA_GRAPHQL_METADATA_DATABASE_URL`, `SHIP_WS_URL`, `RPC_URL`, `CHAIN_ID`, optionally `CHAIN_NAME`, `INDEX_FROM_BLOCK`.
- Build/Run: have Elestio execute from the repo root either:
  - `docker compose -f docker/full-elestio.yml -p chaingraph up -d` (envs come from CI/CD environment), or
  - `docker compose --env-file .env -f docker/full-elestio.yml -p chaingraph up -d` if you also commit a `.env` in the repo root.
- Ports: expose TCP 3333 publicly (maps to Hasura 8080). Optionally front with your domain/proxy.
- Verify after deploy:
  - Health: `curl http://<host>:3333/healthz`
  - Console: `http://<host>:3333/console` with header `x-hasura-admin-secret: ...`
  - Logs (via SSH): `docker compose -f docker/full-elestio.yml logs -f indexer hasura db`
- Persistence: the named volume `pg_data` holds Postgres data across deploys. Remove with caution if you need a clean reset (`docker volume rm <project>_pg_data`).
Notes
- Avoid quoting URLs in env files (use `RPC_URL=https://...`, not `RPC_URL="https://..."`). Some runners pass quotes through, producing invalid URLs.
