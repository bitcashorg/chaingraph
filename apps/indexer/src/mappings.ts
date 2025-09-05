import { Subject } from 'rxjs'
import { config } from './config'
import { db } from './database'
import { logger } from './lib/logger'
import type { ChainGraphMappings } from './types'

export interface MappingsReader {
  mappings$: Subject<ChainGraphMappings[]>
  mappings: ChainGraphMappings[]
}

export const createMappingsReader = async (): Promise<MappingsReader> => {
  let mappings: ChainGraphMappings[] = []
  const mappings$ = new Subject<ChainGraphMappings[]>()

  logger.info('Subscribing to contract mappings, refreshing every 1s ...')
  let initialized = false
  const interval = setInterval(async () => {
    try {
      const result: ChainGraphMappings[] = await db.query(
        'SELECT * FROM mappings WHERE chain = $1',
        [config.reader.chain],
      )
      const changed = JSON.stringify(result) !== JSON.stringify(mappings)
      // Always emit on first successful fetch so the indexer can proceed
      if (!initialized || changed) {
        mappings = result
        mappings$.next(mappings)
        logger.info('New mappings', JSON.stringify(mappings))
        initialized = true
        // Stop polling after first load; downstream will manage updates
        clearInterval(interval)
      }
    } catch (error) {
      logger.error('Error updating contract mappings', error)
    }
  }, 1000)

  // resolve promise only after initial data has been emitted
  return new Promise((resolve) =>
    mappings$.subscribe(() => resolve({ mappings, mappings$ })),
  )
}
