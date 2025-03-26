import { BitcashEnv } from "bitcash-env"
import { createChaingraphClient } from ".."

export type ChaingraphClient = ReturnType<typeof createChaingraphClient>

export type GraphQLSdkProps = {
  config?: RequestInit
  jwt?: string
  env?: BitcashEnv
  options?: any // TODO: improve type
  url?: string
}