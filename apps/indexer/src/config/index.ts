import * as env from 'env-var'

export interface EosioReaderConfig {
  chain: string

  chain_id: string
  ws_url: string
  rpc_url: string

  start_block?: number
  stop_block?: number
  irreversible_only: boolean

  ship_prefetch_blocks: number
  ship_min_block_confirmation: number

  ds_threads: number
  ds_experimental: boolean
}

export interface Config {
  database_url: string
  reader: EosioReaderConfig
}

export const config: Config = {
  database_url: env.get('DATABASE_URL').required().asString(),
  reader: {
    chain: env.get('CHAIN_NAME').asString() || 'l1',
    chain_id: env.get('CHAIN_ID').required().asString(),
    ws_url: env.get('WS_URL').asString() || 'ws://localhost:8080',
    rpc_url: env.get('RPC_URL').asString() || 'http://localhost:8888',
    // Optional starting block number. If unset, starts from head. 0 is allowed.
    start_block: env.get('INDEX_FROM_BLOCK').asInt(),
    irreversible_only: false,
    ship_prefetch_blocks: 50,
    ship_min_block_confirmation: 30,
    ds_threads: 4,
    ds_experimental: false,
  },
}
