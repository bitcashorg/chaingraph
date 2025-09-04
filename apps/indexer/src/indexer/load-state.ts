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
          let rows: EosioReaderTableRow[]
          try {
        const response = await throttledGetTableRows({
          contract,
          scope,
          table,
        })
            rows = response.rows
          } catch (error) {
            console.error(
              '====================== Failed to get Table Rows ======================= \n',
              error,
              '\n=============================================',
            )
            console.trace(
              '====================== Error Trace ======================= \n',
              error,
            )
          }

          // for each row get the right format for ChainGraph
          const tableDataDeltas = rows.map((row) =>
            getChainGraphTableRowData(
              {
                primary_key: '0', // also fixed cos getChainGraphTableRowData determines the real primary_key value
                present: '2', // fixed cos it always exist, it will never be a deletion
                code: contract,
                table,
                scope,
                value: row,
              },
              mappingsReader,
            ),
          )
          const tableData = tableDataDeltas.filter(
            (row) => row.contract !== 'delphioracle',
          )

          // NOTE: not sure why I'm getting duplicated rows.
          const unique_row_deltas: any[] = _.uniqBy(tableData, (row) => {
            return (
              row.chain + row.contract + row.table + row.scope + row.primary_key
            )
          })

          return unique_row_deltas
        }

        // get all table rows acrross all scope flat them out on all_rows array
        const all_rows: ChainGraphTableRow[] = (
          await Promise.map(scopes as any, fn, { concurrency: 1 })
        ).flat()
        // upsert all table rows on the database
        const all_filtered_rows = all_rows.filter(
          (row) =>
            row.primary_key &&
            !row.primary_key
              .toString()
              .normalize()
              .toLowerCase()
              .match(/(undefined|\[object object\])g/),
        )

        await upsertTableRows(all_filtered_rows)

        // logger.info(`Loaded state for ${JSON.stringify(all_rows.filter(f => f), null, 2)}!`)
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

const throttledGetTableRows = throttleRequest(
  async ({
    contract,
    table,
    scope,
  }: {
    contract: string
    table: string
    scope: string
  }) => {
    logger.info(
      `===> throttledGetTableRows for ${contract}:${table} with scope ${scope}`,
    )
    const response = await rpcCall((client) => client.v1.chain.get_table_rows({
      code: contract,
      scope,
      table,
      limit: 10000000,
    }))
    logger.info(
      `===> response for ${contract}:${table} with scope ${scope}, ${response.rows.length}`,
    )
    return response
  },
)
