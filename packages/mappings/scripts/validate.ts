import fs from 'node:fs'
import path from 'node:path'
import yaml from 'yaml'
import * as env from 'env-var'
import { logger } from './lib/logger'

type Abi = {
  version?: string
  types?: Array<{ new_type_name: string; type: string }>
  structs?: Array<{ name: string; base?: string; fields: Array<{ name: string; type: string }> }>
  actions?: Array<{ name: string; type: string }>
  tables?: Array<{ name: string; type: string; index_type?: string; key_names?: string[]; key_types?: string[] }>
}

type MappingFile = {
  chain: string
  contract: string
  type?: string
  tables?: Array<{
    table: string
    table_key?: string
    computed_key_type?: string
    table_type?: string
    computed_fields?: string[]
  }>
  actions?: string[]
}

const RPC_URL = env.get('RPC_URL').required().asString()

const readYaml = (p: string) => yaml.parse(fs.readFileSync(p, 'utf8'))

async function getAbi(account: string): Promise<Abi> {
  const url = RPC_URL.replace(/\/$/, '') + '/v1/chain/get_abi'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account_name: account }),
  })
  if (!res.ok) {
    throw new Error(`get_abi failed for ${account}: ${res.status} ${await res.text()}`)
  }
  const j = await res.json()
  if (!j.abi) throw new Error(`No ABI returned for ${account}`)
  return j.abi as Abi
}

function findStruct(abi: Abi, name: string | undefined) {
  return abi.structs?.find((s) => s.name === name)
}

function findTable(abi: Abi, name: string) {
  return abi.tables?.find((t) => t.name === name)
}

function resolveTableStruct(abi: Abi, tableName: string) {
  const t = findTable(abi, tableName)
  if (!t) return { table: undefined, struct: undefined }
  const struct = findStruct(abi, t.type)
  return { table: t, struct }
}

function checkComputedKeyType(fieldType: string | undefined, expected?: string) {
  if (!expected) return { ok: true, note: 'no computed_key_type specified' }
  if (!fieldType) return { ok: false, note: 'field type unknown' }
  // Heuristic: common expectations
  const norm = expected.toLowerCase()
  if (norm === 'asset_symbol') {
    return { ok: fieldType === 'asset', note: `expect asset, got ${fieldType}` }
  }
  if (norm === 'extended_asset_symbol') {
    // Many contracts store extended_asset, extended_symbol, or a struct wrapping asset+contract
    const ok = fieldType === 'extended_asset' || fieldType === 'extended_symbol' || fieldType === 'symbol_code'
    return { ok, note: `expect extended_asset/extended_symbol, got ${fieldType}` }
  }
  return { ok: true, note: `unrecognized computed_key_type '${expected}', skipping` }
}

async function validateContract(chain: string, contract: string) {
  const mappingPath = path.join(__dirname, '..', 'mappings', chain, `${contract}.yml`)
  if (!fs.existsSync(mappingPath)) throw new Error(`Mapping file not found: ${mappingPath}`)
  const mapping = readYaml(mappingPath) as MappingFile
  const abi = await getAbi(contract)

  let errors = 0
  const warnings: string[] = []

  for (const tbl of mapping.tables ?? []) {
    const { table, struct } = resolveTableStruct(abi, tbl.table)
    if (!table) {
      logger.error(`[${contract}] table '${tbl.table}' not found in ABI`)
      errors++
      continue
    }
    if (!struct) {
      logger.error(`[${contract}] table '${tbl.table}' type '${(findTable(abi, tbl.table) || {}).type}' struct not found in ABI`)
      errors++
      continue
    }
    const field = tbl.table_key ? struct.fields.find((f) => f.name === tbl.table_key) : undefined
    if (tbl.table_key && !field) {
      logger.error(`[${contract}] table '${tbl.table}' key field '${tbl.table_key}' not found in struct '${struct.name}'`)
      errors++
    }
    if (tbl.table_key) {
      const { ok, note } = checkComputedKeyType(field?.type, tbl.computed_key_type)
      if (!ok) {
        logger.error(`[${contract}] table '${tbl.table}' key '${tbl.table_key}' type mismatch: ${note}`)
        errors++
      } else if (note) {
        warnings.push(`[${contract}] table '${tbl.table}' key '${tbl.table_key}': ${note}`)
      }
    }
    if (tbl.table_type === 'singleton') {
      warnings.push(`[${contract}] table '${tbl.table}' marked singleton: ABI cannot confirm singleton; ensure only a single row exists`)
    }
  }

  return { errors, warnings }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    logger.info('Usage: bun ./scripts/validate <chain> <contract> | manifest <name>')
    process.exit(1)
  }

  let totalErrors = 0
  const allWarnings: string[] = []

  if (args[0] === 'manifest') {
    const name = args[1]
    if (!name) {
      logger.error('Missing manifest name')
      process.exit(1)
    }
    const manifestPath = path.join(__dirname, '..', 'manifests', `${name}.yml`)
    if (!fs.existsSync(manifestPath)) {
      logger.error(`Manifest not found: ${manifestPath}`)
      process.exit(1)
    }
    const manifest = readYaml(manifestPath) as {
      whitelist: Array<{ chain: string; contract: string }>
    }
    for (const w of manifest.whitelist) {
      try {
        const { errors, warnings } = await validateContract(w.chain, w.contract)
        totalErrors += errors
        allWarnings.push(...warnings)
      } catch (e) {
        logger.error(String(e))
        totalErrors++
      }
    }
  } else {
    const chain = args[0]
    const contract = args[1]
    if (!chain || !contract) {
      logger.error('Missing chain or contract')
      process.exit(1)
    }
    try {
      const { errors, warnings } = await validateContract(chain, contract)
      totalErrors += errors
      allWarnings.push(...warnings)
    } catch (e) {
      logger.error(String(e))
      totalErrors++
    }
  }

  for (const w of allWarnings) logger.warn(w)
  if (totalErrors > 0) {
    logger.error(`Validation failed with ${totalErrors} error(s).`)
    process.exit(1)
  }
  logger.info('Validation passed.')
}

main()

