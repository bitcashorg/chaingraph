import type {
  ChainGraphAction,
  ChainGraphBlock,
  ChainGraphTableRow,
  ChainGraphTransaction,
} from '../types'
import { db } from './db'
import {
  createDeleteTableRowsQuery,
  createUpsertChainQuery,
  createUpsertActionsQuery,
  createUpsertBlocksQuery,
  createUpsertTableRowsQuery,
  createUpsertTransactionsQuery,
} from './queries'

export * from './db'

const runQuery = async (query: string) => {
  // logger.info(query)
  return db.none(query)
}

export const upsertBlocks = async (blocks: ChainGraphBlock[]) => {
  if (!blocks.length) return Promise.resolve()
  return runQuery(createUpsertBlocksQuery(blocks))
}

export const upsertTableRows = async (tableRows: ChainGraphTableRow[]) => {
  // console.log('upsertTableRows', tableRows)
  if (!tableRows.length) return Promise.resolve()
  return runQuery(createUpsertTableRowsQuery(tableRows))
}

export const deleteTableRows = async (tableRows: ChainGraphTableRow[]) => {
  if (!tableRows.length) return Promise.resolve()
  return runQuery(createDeleteTableRowsQuery(tableRows))
}

export const upsertTransactions = async (
  transactions: ChainGraphTransaction[],
) => {
  if (!transactions.length) return Promise.resolve()
  return runQuery(createUpsertTransactionsQuery(transactions))
}

export const upsertActions = async (actions: ChainGraphAction[]) => {
  // console.log('upsertActions', actions)
  if (!actions.length) return Promise.resolve()
  return runQuery(createUpsertActionsQuery(actions))
}

export const upsertChain = async (
  chain_name: string,
  chain_id: string,
  rpc_url: string,
) => runQuery(createUpsertChainQuery(chain_name, chain_id, rpc_url))

// Returns the highest indexed block number for a given chain, or null if none
export const getLatestIndexedBlockNum = async (
  chain: string,
): Promise<number | null> => {
  const row = await db.oneOrNone<{ max: number | null }>(
    'SELECT max(block_num) as max FROM blocks WHERE chain = $1',
    [chain],
  )
  return row?.max ?? null
}

// Returns the earliest indexed block number for a given chain, or null if none
export const getEarliestIndexedBlockNum = async (
  chain: string,
): Promise<number | null> => {
  const row = await db.oneOrNone<{ min: number | null }>(
    'SELECT min(block_num) as min FROM blocks WHERE chain = $1',
    [chain],
  )
  return row?.min ?? null
}

export interface MissingRange {
  start: number
  end: number
}

// Returns internal missing ranges within the already indexed span
export const getMissingRanges = async (
  chain: string,
): Promise<MissingRange[]> => {
  const rows = await db.manyOrNone<{ block_num: number; next: number | null }>(
    `SELECT block_num, LEAD(block_num) OVER (ORDER BY block_num) AS next
     FROM blocks
     WHERE chain = $1
     ORDER BY block_num`,
    [chain],
  )
  const ranges: MissingRange[] = []
  for (const r of rows) {
    if (r.next != null && r.next > r.block_num + 1) {
      ranges.push({ start: r.block_num + 1, end: r.next - 1 })
    }
  }
  return ranges
}
