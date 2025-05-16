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

