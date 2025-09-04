import _ from 'lodash'
import { config } from '../config'
import {
  deleteTableRows,
  getEarliestIndexedBlockNum,
  getLatestIndexedBlockNum,
  getMissingRanges,
  upsertActions,
  upsertBlocks,
  upsertTableRows,
  upsertTransactions,
} from '../database'
import { deleteBlock } from '../database/queries'
import { logger } from '../lib/logger'
import type { MappingsReader } from '../mappings'
import { loadReader } from '../reader/ship-reader'
import type { ChainGraphAction } from '../types'
import type { WhitelistReader } from '../whitelist'
import { getChainGraphTableRowData } from './utils'

export const backfillMissingRanges = async (
  mappingsReader: MappingsReader,
  whitelistReader: WhitelistReader,
) => {
  const chain = config.reader.chain
  const envStart = config.reader.start_block

  // Internal gaps from existing indexed data
  let internalRanges = await getMissingRanges(chain)
  // If an env lower-bound is set, clamp internal ranges to start at envStart
  if (typeof envStart === 'number' && Number.isFinite(envStart)) {
    internalRanges = internalRanges
      .map((r) => ({ start: Math.max(r.start, envStart), end: r.end }))
      .filter((r) => r.end >= r.start)
  }

  // Earlier-than-earliest range if envStart is set earlier
  const earliest = await getEarliestIndexedBlockNum(chain)
  const earlierRanges =
    typeof envStart === 'number' && Number.isFinite(envStart) && earliest != null && envStart < earliest
      ? [{ start: envStart, end: earliest - 1 }]
      : []

  // Force reprocessing from envStart up to current DB tip when envStart is set and DB has data
  const latest = await getLatestIndexedBlockNum(chain)
  const forceEnvRange =
    typeof envStart === 'number' && Number.isFinite(envStart) && latest != null && envStart <= latest
      ? [{ start: envStart, end: latest }]
      : []

  let ranges = [...earlierRanges, ...internalRanges, ...forceEnvRange]

  // Merge overlapping/adjacent ranges for safety
  ranges = _.sortBy(ranges, (r) => r.start)
  const merged: { start: number; end: number }[] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (!last || r.start > last.end + 1) merged.push({ ...r })
    else last.end = Math.max(last.end, r.end)
  }

  if (!merged.length) {
    logger.info('No missing ranges detected. Skipping backfill.')
    return
  }

  logger.info(`Backfilling ${merged.length} missing range(s) ...`)

  for (const r of merged) {
    const rangeStart = r.start
    const rangeEnd = r.end
    logger.info(`Backfill range ${rangeStart}..${rangeEnd}`)

    const primaryWs = config.reader.ws_url
    let backupWs = (config.reader as any).ws_url_backup as string | undefined

    let activeWs = primaryWs
    let currentStart = rangeStart
    let finished = false
    let subs: { blocks?: any; close?: any; errors?: any } = {}
    let reconnecting = false
    let retryDelayMs = 1000
    let hadError = false

    const cleanup = () => {
      subs.blocks?.unsubscribe?.()
      subs.close?.unsubscribe?.()
      subs.errors?.unsubscribe?.()
      subs = {}
    }

    const scheduleReconnect = (target: string) => {
      if (reconnecting) return
      reconnecting = true
      setTimeout(() => {
        reconnecting = false
        void startWith(target)
      }, retryDelayMs)
      retryDelayMs = Math.min(retryDelayMs * 2, 10000)
    }

    const startWith = async (wsUrl: string) => {
      cleanup()
      activeWs = wsUrl
      let blocks$: any, close$: any, errors$: any
      try {
        ;({ blocks$, close$, errors$ } = await loadReader(
          mappingsReader,
          whitelistReader,
          {
            start_block_num: currentStart,
            end_block_num: rangeEnd,
            ignoreEnvStart: true,
            ws_urlOverride: wsUrl,
          },
        ))
        retryDelayMs = 1000 // reset backoff on success
        hadError = false
      } catch (err) {
        logger.error(`Failed to connect to SHiP for backfill at ${wsUrl}`, {
          err,
        })
        // If backup fails, disable it; otherwise try backup once
        if (wsUrl === backupWs) {
          backupWs = undefined
        }
        const target = wsUrl === primaryWs && backupWs ? (backupWs as string) : primaryWs
        scheduleReconnect(target)
        return
      }

      subs.blocks = blocks$.subscribe(async (block) => {
        // Safety guard: drop any block outside the requested backfill window
        if (block.block_num < currentStart || block.block_num > rangeEnd) return
        try {
          const table_rows = Array.isArray((block as any).table_rows)
            ? (block as any).table_rows
            : []
          const transactionsArr = Array.isArray((block as any).transactions)
            ? (block as any).transactions
            : []
          const actionsArr = Array.isArray((block as any).actions)
            ? (block as any).actions
            : []

          logger.info(
            `Processed block ${block.block_num}. Transactions: ${transactionsArr.length}, actions ${actionsArr.length}, table rows ${table_rows.length} `,
          )

          const tableRowsDeltas = table_rows
            .filter((row) => {
              logger.warn('> The received row =>', { row })
              return (
                row.present &&
                Boolean(row.primary_key) &&
                !row.primary_key.normalize().toLowerCase().includes('undefined')
              )
            })
            .map((row) => getChainGraphTableRowData(row, mappingsReader))

          if (tableRowsDeltas.length > 0) await upsertTableRows(tableRowsDeltas)

          const deleted_table_rows = table_rows
            .filter((row) => !row.present)
            .map((row) => getChainGraphTableRowData(row, mappingsReader))
          if (deleted_table_rows.length > 0)
            await deleteTableRows(deleted_table_rows)

          // delete block data in case of microfork
          deleteBlock(config.reader.chain, block.block_num)

          const blockData = _.omit(block, [
            'actions',
            'table_rows',
            'transactions',
            'chain_id',
          ])
          await upsertBlocks([{ ...blockData, chain }])

          const transactions = transactionsArr.map((trx) => ({
            ...trx,
            chain,
            block_num: block.block_num,
          }))

          if (transactions.length > 0) {
            await upsertTransactions(transactions)

            const actions: ChainGraphAction[] = actionsArr.map((action) => ({
              chain,
              transaction_id: action.transaction_id,
              contract: action.account,
              action: action.name,
              data:
                typeof action.data === 'string'
                  ? JSON.parse(action.data)
                  : action.data,
              authorization: action.authorization,
              global_sequence: action.global_sequence,
              action_ordinal: action.action_ordinal,
              account_ram_deltas: action.account_ram_deltas,
              receipt: action.receipt,
              context_free: action.context_free,
              account_disk_deltas: action.account_disk_deltas,
              console: action.console,
              receiver: '',
            }))
            if (actions.length > 0) await upsertActions(actions)
          }

          // Advance start to next block after processed
          currentStart = Math.max(currentStart, Number(block.block_num) + 1)
          if (currentStart > rangeEnd) finished = true
        } catch (error) {
          logger.fatal('=> backfill blocks$.subscribe:', error)
          process.exit(1)
        }
      })

      subs.close = close$.subscribe(() => {
        logger.warn('Backfill SHiP connection closed')
        if (finished) return // already done
        if (hadError) {
          const target = backupWs && activeWs === primaryWs ? (backupWs as string) : primaryWs
          scheduleReconnect(target)
        } else {
          // Treat clean close as end-of-range completion (even if no blocks were emitted)
          finished = true
        }
      })

      subs.errors = errors$.subscribe((error) => {
        logger.error('Backfill SHiP reader error:', { error })
        hadError = true
        const target = backupWs && activeWs === primaryWs ? (backupWs as string) : primaryWs
        scheduleReconnect(target)
      })
    }

    await new Promise<void>(async (resolve) => {
      await startWith(primaryWs)
      const interval = setInterval(() => {
        if (finished) {
          cleanup()
          clearInterval(interval)
          logger.info(`Backfill range ${rangeStart}..${rangeEnd} completed`)
          resolve()
        }
      }, 1000)
    })
  }

  logger.info('Backfill finished.')
}
