import type { EosioReaderTableRow } from '@blockmatic/eosio-ship-reader'
// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
import Promise from 'bluebird'
import _ from 'lodash'
import pThrottle from 'p-throttle'
import { upsertTableRows } from '../database'
import { rpcCall } from '../lib/eosio'
import { logger } from '../lib/logger'
import type { MappingsReader } from '../mappings'
import type { ChainGraphTableRow, ChainGraphTableWhitelist } from '../types'
import type { WhitelistReader } from '../whitelist'
import { getChainGraphTableRowData } from './utils'

const getTableScopes = async (code: string, table: string) => {
  // logger.info(`getTableScopes for ${code} table ${table}`)
  const params = {
    code,
    table,
    limit: 10000,
  }

  //  logger.info('getTableScopes params', params)
  // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
  let response
  try {
    response = await rpcCall((client) => client.v1.chain.get_table_by_scope(params))
  } catch (error) {
    console.log(params)
    console.log(error)
  }

  // const response = await getTableByScope(params)
  const scopes: string[] = response.rows.map(({ scope }) => scope.toString())
  logger.info(`scopes for ${code} ${table}`, response.rows?.length)
  return scopes
}

export const loadCurrentTableState = async (
  mappingsReader: MappingsReader,
  whitelistReader: WhitelistReader,
) => {
  logger.info('Loading current table state ...')

  const mapper = async ({ contract, tables: tables_filter }) => {
    // TODO: if eosio.token skip for now
    // TODO: Reconsider to re-open for wallet balances? @gaboesquivel
    if (contract === 'eosio.token') return
    // logger.info('Preparing', { contract, tables_filter })
    let tables: ChainGraphTableWhitelist[] = []

    if (tables_filter[0] === '*') {
      // get all table names from mappings
      const res = mappingsReader.mappings.find((m) => m.contract === contract)
      if (!res) {
        throw new Error(`No mappings for contract ${contract} where found`)
      }
      const table_names = res.tables.map((t) => t.table)

      tables = await Promise.map(
        table_names,
        async (table) => ({
          table,
          scopes: await getTableScopes(contract, table),
        }),
        { concurrency: 1 },
      )
    } else {
      tables = await Promise.all(
        tables_filter.map(async (filter) => {
          if (filter.scopes[0] === '*') {
            logger.info('Wildcard in scopes!', filter)
            return {
              table: filter.table,
              scopes: await getTableScopes(contract, filter.table),
            }
          }
          return filter
        }),
      )
    }

    // logger.info(contract, JSON.stringify(tables, null, 2))
    Promise.map(
      tables,
      async ({ table, scopes }) => {
        // if scopes is emtpy here it means there's no data to load
        if (scopes.length === 0) return
        // tables rows requests for this table
        async function fn(scope: string) {
          const PAGE_LIMIT = parseInt(
            (process.env.TABLE_ROWS_PAGE_LIMIT as string) ?? '100000',
            10,
          )
          let lower_bound: string | undefined = undefined
          let page = 0
          // Iterate pages and upsert per chunk to keep memory bounded
          for (;;) {
            page += 1
            let response: any
            try {
              response = await throttledGetTableRowsPage({
                contract,
                scope,
                table,
                limit: PAGE_LIMIT,
                lower_bound,
              })
            } catch (error) {
              console.error(
                '====================== Failed to get Table Rows Page ======================= \n',
                { contract, table, scope, lower_bound, page, limit: PAGE_LIMIT },
                error,
                '\n=============================================',
              )
              console.trace(
                '====================== Error Trace ======================= \n',
                error,
              )
              break
            }

            const rows: EosioReaderTableRow[] = response.rows ?? []
            if (!rows.length) {
              if (!response?.more) break
            }

            // Map rows to ChainGraph shape
            const tableDataDeltas = rows.map((row) =>
              getChainGraphTableRowData(
                {
                  primary_key: '0', // getChainGraphTableRowData determines real primary_key
                  present: '2', // existing rows, not deletions
                  code: contract,
                  table,
                  scope,
                  value: row,
                },
                mappingsReader,
              ),
            )

            // Filter unwanted contracts
            const tableData = tableDataDeltas.filter(
              (row) => row.contract !== 'delphioracle',
            )

            // Optional per-chunk dedupe
            const unique_row_deltas: ChainGraphTableRow[] = _.uniqBy(
              tableData,
              (row) =>
                row.chain + row.contract + row.table + row.scope + row.primary_key,
            ) as any

            // Filter invalid primary keys before upsert
            const filtered_rows = unique_row_deltas.filter(
              (row) =>
                row.primary_key &&
                !row.primary_key
                  .toString()
                  .normalize()
                  .toLowerCase()
                  .match(/(undefined|\[object object\])g/),
            )

            if (filtered_rows.length > 0) {
              await upsertTableRows(filtered_rows)
            }

            // Advance pagination
            if (!response.more) break
            // Support both EOSIO styles: boolean + next_key or string in more
            lower_bound =
              (response.next_key as string | undefined) ||
              (typeof response.more === 'string' ? (response.more as string) : undefined)
            if (!lower_bound) break
          }
        }

        // Walk all scopes sequentially (bounded by concurrency: 1)
        await Promise.map(scopes as any, fn, { concurrency: 1 })

        // logger.info(`Loaded state for ${contract}:${table}`)
      },
      { concurrency: 1 },
    )
  }

  //  for each table in registry get all of its data ( all scopes and rows ) and pushed it to the database
  Promise.map(whitelistReader.whitelist as any, mapper, { concurrency: 1 })
}

// ? this might not be necessary, though a concurrency issue has been found...
const throttleRequest = pThrottle({
  limit: 1,
  interval: 500,
})

const throttledGetTableRowsPage = throttleRequest(
  async ({
    contract,
    table,
    scope,
    limit,
    lower_bound,
  }: {
    contract: string
    table: string
    scope: string
    limit: number
    lower_bound?: string
  }) => {
    logger.info(
      `===> get_table_rows page for ${contract}:${table} scope=${scope} limit=${limit} lb=${lower_bound ?? ''}`,
    )
    const response = await rpcCall((client) =>
      client.v1.chain.get_table_rows(
        {
          code: contract,
          scope,
          table,
          limit,
          lower_bound,
        } as any,
      ),
    )
    logger.info(
      `===> page received ${contract}:${table} scope=${scope} rows=${response?.rows?.length ?? 0} more=${response?.more}`,
    )
    return response
  },
)
