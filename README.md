# ChainGraph: Real-Time GraphQL Toolkit for EOSIO/Antelope

ChainGraph provides performant GraphQL APIs for blockchain applications featuring state of art subscriptions, advanced filtering, sorting, pagination and aggregations across multiple blockchains.

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



> 🚧 Note: Migration from previous repos in progress (80% complete) - feel free to explore and contribute! 🏗️

## Project Structure

### Apps
- [__apps/auth__](./apps/auth/README.md) - Authentication service for api-key validations
- [__apps/chaingraph.io__](./apps/chaingraph.io/README.md) - Main website
- [__apps/docs__](./apps/docs/README.md) - Documentation site
- [__apps/engine__](./apps/engine/README.md) - GraphQL engine and database migrations using Hasura
- [__apps/explorer__](./apps/explorer/README.md) - GraphiQL interface for developers
- [__apps/indexer__](./apps/indexer/README.md) - Multi-threaded NodeJS service for real-time data deserialization and indexing

### Packages
- [__packages/ui__](./packages/ui/README.md) - UI components
- [__packages/core__](./packages/core/README.md) - JavaScript client
- [__packages/api__](./packages/api/README.md) - GraphQL API client, SDK, and hooks
- [__packages/react__](./packages/react/README.md) - React hooks for blockchain data
- [__packages/supabase__](./packages/supabase/README.md) - Database integration
- [__packages/lib__](./packages/lib/README.md) - Shared utilities
- [__packages/errors__](./packages/errors/README.md) - Error handling
- [__packages/mappings__](./packages/mappings/README.md) - Data mappings
- [__packages/tsconfig__](./packages/tsconfig/README.md) - TypeScript configuration

## Technology

ChainGraph API nodes are light and index whitelisted data tables and actions. The project is split into separate micro-services to make it easier to scale:

- **chaingraph-engine**: GraphQL engine and database migrations using Hasura
- **chaingraph-auth**: Authentication service for api-key validations
- **chaingraph-indexer**: Multi-threaded NodeJS service for real-time data deserialization and indexing
- **chaingraph-explorer**: GraphiQL interface for developers

## Data Whitelisting

ChainGraph is currently using a contract mapping protocol that allows developers to define how the data is indexed. Through these mappings ChainGraph can index the data in a way that is good for introspection of the blockchain heuristics. We will iterate on the mapping protocol to achieve fully typed schemas in the future.

## Development Setup

### Requirements
- Node.js 18+
- pnpm

### Quick Start

```bash
npm install -g pnpm
git clone https://github.com/chaingraph/chaingraph.git
cd chaingraph
pnpm install
```

### Development Commands

```bash
pnpm backend    # Start backend services
pnpm dev        # Dev server
pnpm build      # Production build
pnpm test       # Run tests
```

## Technologies Used

- **Antelope** – Blockchain framework
- **Node.js** – Server-side JavaScript
- **GraphQL** – API query language
- **Docker** – Containerization
- **GCP** – Cloud platform
- **RXJS** – Reactive programming
- **ReactJS** – Frontend library
- **TypeScript** – Typed JavaScript
- **Hasura** – GraphQL engine

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

MIT License

