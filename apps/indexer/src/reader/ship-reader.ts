import {
  type EosioReaderConfig,
  createEosioShipReader,
} from '@blockmatic/eosio-ship-reader'
import { config } from '../config'
import { logger } from '../lib/logger'
import { getInfo, resolveWorkingRpcUrl } from '../lib/eosio'
import type { MappingsReader } from '../mappings'
import type { WhitelistReader } from '../whitelist'
import { createShipReaderDataHelper } from './reader-helper'
import { getLatestIndexedBlockNum } from '../database'

export const loadReader = async (
  mappingsReader: MappingsReader,
  whitelistReader: WhitelistReader,
  opts?: {
    start_block_num?: number
    end_block_num?: number
    ignoreEnvStart?: boolean
    ws_urlOverride?: string
    rpc_urlOverride?: string
  },
) => {
  // First we need to get the ABis for all whitelisted contracts
  const readerHelper = await createShipReaderDataHelper(
    mappingsReader,
    whitelistReader,
  )

  const readerConfig = config.reader

  // Determine the safest start block:
  // - If DB already has blocks, start from (max_block_in_db + 1)
  // - Respect INDEX_FROM_BLOCK if it is higher (skip further ahead intentionally)
  // - Otherwise fall back to node head
  const latestIndexed = await getLatestIndexedBlockNum(readerConfig.chain)
  const dbStart = latestIndexed != null ? latestIndexed + 1 : undefined
  const envStart = opts?.ignoreEnvStart
    ? undefined
    : readerConfig.start_block // may be 0

  let start_block_num: number =
    opts?.start_block_num ??
    (typeof envStart === 'number' && Number.isFinite(envStart)
      ? envStart
      : dbStart ?? (await getInfo()).head_block_num)
  let end_block_num = opts?.end_block_num ?? 0xffffffff

  // Clamp to current head if requested start/end are beyond head
  try {
    const { head_block_num } = await getInfo()
    if (start_block_num > head_block_num) {
      logger.warn(
        `Requested start_block_num ${start_block_num} is above head ${head_block_num}; clamping to head`,
      )
      start_block_num = head_block_num
    }
    if (end_block_num !== 0xffffffff && end_block_num > head_block_num) {
      logger.warn(
        `Requested end_block_num ${end_block_num} is above head ${head_block_num}; clamping to head`,
      )
      end_block_num = head_block_num
    }
  } catch (e) {
    // getInfo failover handles alternates; if still failing, proceed with given values
  }

  logger.info(
    `Starting SHiP from block ${start_block_num}` +
      (latestIndexed != null
        ? ` (db has up to ${latestIndexed}${
            readerConfig.start_block != null
              ? `, env=${readerConfig.start_block}`
              : ''
          })`
        : readerConfig.start_block != null && !opts?.ignoreEnvStart
        ? ` (env=${readerConfig.start_block})`
        : ' (using node head)'),
  )

  const effectiveRpcUrl =
    opts?.rpc_urlOverride ?? (await resolveWorkingRpcUrl()).toString()

  logger.info(
    `SHiP endpoints => ws: ${opts?.ws_urlOverride ?? readerConfig.ws_url}, rpc: ${effectiveRpcUrl}`,
  )

  const eosioReaderConfig: EosioReaderConfig = {
    ws_url: opts?.ws_urlOverride ?? readerConfig.ws_url,
    rpc_url: effectiveRpcUrl,
    ds_threads: readerConfig.ds_threads,
    ds_experimental: readerConfig.ds_experimental,
    ...readerHelper,
    request: {
      start_block_num,
      end_block_num,
      max_messages_in_flight: 50,
      have_positions: [],
      irreversible_only: false,
      fetch_block: true,
      fetch_traces: true,
      fetch_deltas: true,
    },
    auto_start: true,
  }

  // logger.info(
  //   'Creating EOSIO SHiP Reader with config ',
  //   JSON.stringify(
  //     {
  //       ...eosioReaderConfig,
  //       delta_whitelist: readerHelper.delta_whitelist(),
  //       contract_abis: readerHelper
  //         .contract_abis()
  //         .forEach((_value, key) => ({ contract: key })),
  //       table_rows_whitelist: readerHelper.table_rows_whitelist(),
  //       actions_whitelist: readerHelper.actions_whitelist(),
  //     },
  //     null,
  //     2,
  //   ),
  // )

  return await createEosioShipReader(eosioReaderConfig)
}
