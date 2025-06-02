import { createMappingsReader } from '../mappings'
import { createWhitelistReader } from '../whitelist'
import { loadCurrentTableState } from './load-state'
import { startRealTimeStreaming } from './real-time'

export const startIndexer = async () => {
  // get instances of the mappings and whitelist readers
  // these subscribe to mappings and whitelists on db and it always returns the latest state of it
  const mappingsReader = await createMappingsReader()

  const whitelistReader = await createWhitelistReader()

  // load current state of whitelisted tables, overwritting real-time stream insn't an issue since it's the latest state
  loadCurrentTableState(mappingsReader, whitelistReader)

  // start indexing state updates in real-time as soon as the server starts
  // TODO: make sure it starts at last indexed block
  startRealTimeStreaming(mappingsReader, whitelistReader)
}
