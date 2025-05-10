export interface ChainGraphTransaction {
  chain: string
  transaction_id: string
  block_num: number
  cpu_usage_us: number | null
  net_usage_words: number | null
  net_usage: number | null
}

export interface ChainGraphTableRow {
  chain: string
  contract: string
  table: string
  scope: string
  primary_key: string
  data: Record<string, number | string>
}

export interface ChainGraphChain {
  chain_name: string
  chain_id: string
  rpc_endpoint: string
}

export interface ChainGraphApiUser {
  account: string
  api_key: string
  domain_names: string | null
  id: number
  created_at: string | null
  updated_at: string | null
}

export interface ChainGraphAction {
  chain: string
  transaction_id: string
  contract: string
  action: string
  data: AnyObject
  authorization: AnyObject[]
  global_sequence: string
  action_ordinal: number
  account_ram_deltas: AnyObject[] | null
  receipt: AnyObject | null
  context_free: boolean | null
  account_disk_deltas: AnyObject[] | null
  console: string | null
  receiver: string | null
}

export interface ChainGraphBlock {
  chain: string
  block_num: number
  block_id: string | null
  timestamp: string
  producer: string
}

export interface ChainGraphTableMappings {
  scopes?: string[]
  table: string
  table_type?: 'singleton' | 'multi_index'
  table_key: string
  computed_key_type?: 'asset_symbol' | 'symbol'
}

export interface ChainGraphMappings {
  chain: string
  contract: string
  contract_type: string | null
  tables: ChainGraphTableMappings[] | null
  abi?: AnyObject | null
}

export interface ChainGraphActionWhitelist {
  action: string
  where?: AnyObject[] | null
}

export interface ChainGraphTableWhitelist {
  table: string
  scopes?: string[] | null
}

export type WildCard = ['*']
export interface ChainGraphContractWhitelist {
  chain: string
  contract: string
  start_block: number
  actions?: ChainGraphActionWhitelist[] | WildCard | null
  tables?: ChainGraphTableWhitelist[] | WildCard | null
  app_id: string
}

export interface ChainGraphAppManifest {
  app_name: string
  app_id: string
  description: string
  url: string
  whitelist: ChainGraphContractWhitelist[]
}

export type AnyObject = Record<string, unknown>
