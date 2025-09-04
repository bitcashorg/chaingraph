import { createMappingsReader } from '../mappings'
import { createWhitelistReader } from '../whitelist'
import { loadCurrentTableState } from './load-state'
import { startRealTimeStreaming } from './real-time'
import { backfillMissingRanges } from './backfill'
import { getLatestIndexedBlockNum, upsertChain } from '../database'
import { config } from '../config'

export const startIndexer = async () => {
  // Ensure the chain exists to satisfy FK constraints
  await upsertChain(
    config.reader.chain,
    config.reader.chain_id,
    config.reader.rpc_url,
  )
  // get instances of the mappings and whitelist readers
  // these subscribe to mappings and whitelists on db and it always returns the latest state of it
  const mappingsReader = await createMappingsReader()

  const whitelistReader = await createWhitelistReader()

  // Decide boot path based on DB state and env
  const latest = await getLatestIndexedBlockNum(config.reader.chain)
  const envStart = config.reader.start_block

  if (latest == null) {
    // No blocks yet in DB. Honor INDEX_FROM_BLOCK if set; otherwise node head.
    loadCurrentTableState(mappingsReader, whitelistReader)
    startRealTimeStreaming(mappingsReader, whitelistReader)
    return
  }

  // DB has data
  if (typeof envStart === 'number' && Number.isFinite(envStart)) {
    if (envStart > latest) {
      // User wants to skip ahead: do not backfill, start realtime at envStart
      loadCurrentTableState(mappingsReader, whitelistReader)
      startRealTimeStreaming(mappingsReader, whitelistReader, {
        start_block_num: envStart,
        ignoreEnvStart: true,
      })
      return
    }
    // envStart <= latest: perform backfill (includes reprocessing from envStart..latest), then resume from DB tip
    await backfillMissingRanges(mappingsReader, whitelistReader)
    loadCurrentTableState(mappingsReader, whitelistReader)
    startRealTimeStreaming(mappingsReader, whitelistReader, { ignoreEnvStart: true })
    return
  }

  // No env override: backfill gaps if any, then resume from DB tip
  await backfillMissingRanges(mappingsReader, whitelistReader)
  loadCurrentTableState(mappingsReader, whitelistReader)
  startRealTimeStreaming(mappingsReader, whitelistReader, { ignoreEnvStart: true })
}
