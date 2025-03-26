import { config as bitcashConfig } from 'bitcash-env';
import { createClient as createWsClient } from 'graphql-ws';
import { createClient } from '../../generated';
import { GraphQLSdkProps } from './client.types';

export * from '../../generated';

// Server side client
export function createChaingraphClient({ config, jwt, env, options = {}, url }: GraphQLSdkProps = {}) {
  const headers = {
    'x-chaingraph-api-key': bitcashConfig.chaingraphKey,
  }

  let subscribe

  // * Guarding if webSocketImpl is in options
  if ('webSocketImpl' in options) {
    const { subscribe: subscriptions } = createWsClient({
      url: 'wss://api.chaingraph.io/v1/graphql',
      ...options,
      connectionParams: () => {
        return {
          headers,
        }
      }
    })
    subscribe = subscriptions
  }

  const client = createClient({
    fetcher: async (operation: any) => {
      //   console.log(
      //     '\n ==> GraphQL Query : \n',
      //     JSON.stringify((operation as GraphqlOperation).query.replaceAll('"', ''))
      //   )

      let fetchResponse
      try {
        fetchResponse = fetch('https://api.chaingraph.io/v1/graphql', {
          method: 'POST',
          headers,
          body: JSON.stringify(operation),
          ...config,
        }).then((response) => response.json())
      } catch (error) {
        console.error('Error in graphql fetcher', error)
      }

      return fetchResponse
    },
  })

  return {
    subscribe,
    ...client,
  }
}

/**
 * api.chaingraph.io,
 * auth.bitcash.org,
 * bitcash-auth-dev-ymrgicuyta-uc.a.run.app,
 * chaingraph-hasura-7y5keambwq-uc.a.run.app,
 * explorer.chaingraph.io,
 * graphiql-online.com,
 * graph.blockmatic.io,
 * localhost:3000,
 * localhost,
 * bitcash.org,
 * test.bitcash.org,
 * app.bitcash.org,
 * prev.bitcash.org
 */