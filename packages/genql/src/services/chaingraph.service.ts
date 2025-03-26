import { config, contracts, endpoints } from 'bitcash-env';
import { createChaingraphClient } from '../index';

const chaingraph = createChaingraphClient({
  env: config.env || 'prod',
  config: {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-chaingraph-api-key': config.chaingraphKey,
    },
  },
  url: endpoints.hasuraUrl,
})

const checkIfAccountIsRegistered = async (account: string) => {
  const result = await chaingraph.query({
    table_rows: {
      __args: {
        where: {
          chain: {
            _eq: config.eosChainName,
          },
          contract: {
            _eq: contracts[config.env].accounts,
          },
          table: {
            // production & test accounts tables
            _in: ['accounts', 'accountsv2'],
          },
          primary_key: {
            _eq: account,
          },
        },
      },
    },
  })
  return Boolean(result.table_rows.length)
}

const fetchPairs = async () => {
  try {
    const data = await chaingraph.query({
      table_rows: {
        __args: {

          where: {
            chain: {
              _eq: config.eosChainName,
            },
            contract: {
              _eq: contracts[config.env].accounts,
            },
            table: {
              _eq: 'spotpairsv2',
            },

          },
        },
      },

    })

    const pairs = data.table_rows.map((data: any) => data)
    return {
      pairs,
      error: null
    };
  } catch (error) {
    console.log('[ERROR] [fetchPairs]', error)
    return {
      error,
      pairs: []
    }
  }
}



const getUserLimits = async (account: string) => {
  const { table_rows } = await chaingraph.query({
    table_rows: {
      __args: {
        where: {
          chain: {
            _eq: config.eosChainName,
          },
          contract: {
            _eq: contracts[config.env].bank,
          },
          table: {
            _eq: 'wdlperiods',
          },
          primary_key: {
            _eq: account,
          },
        },
      },
      __scalar: true,
    },
  })

  if (table_rows && table_rows.length >= 0) {
    const limit = table_rows.find((item) => item.data.account === account)
    if (limit) {
      return limit.data.updated_at
    }
  }

  return ''
}

// !
// !
// ! SUBSCRIPTIONS NOT SUPPORTED BY PREACT + PREACT CLIENT SIDE RENDERING
// ! TO CREATE SUBSCRIPTIONS, USE A SERVER SIDE RENDERING FRAMEWORK LIKE NEXT.JS
// ! ELSE, CREATE THE SUBSCRIPTION ON THE APP CLIENT SIDE USING A GRAPHQL CLIENT (IMPORTING FROM chaingraph PACKAGE)
// !
// ! 

// const createDelphiPricesObservable = () => {

//   let { query, variables } = generateChaingraphSubscriptionOp({
//     table_rows: {
//       __args: {
//         where: {
//           chain: {
//             _eq: config.eosChainName,
//           },
//           contract: {
//             _eq: 'delphioracle',
//           },
//           table: {
//             _eq: 'datapoints',
//           },
//           scope: {
//             _in: scopes,
//           },
//           _or: [
//             {
//               data: {
//                 _contains: {
//                   owner: 'eosiodetroit',
//                 },
//               },
//             },
//             {
//               data: {
//                 _contains: {
//                   owner: 'cryptolions1',
//                 },
//               },
//             },
//             {
//               data: {
//                 _contains: {
//                   owner: 'ivote4eosusa',
//                 },
//               },
//             },
//           ],
//         },
//         order_by: [{
//           primary_key: 'desc'
//         }],
//         limit: 10000,
//       },
//     },
//   });

//   return chaingraph.subscribe(
//     { query, variables },
//     {
//       next: (data: any) => console.log(data),
//       error: console.error,
//       complete: () => console.log('finished'),
//     }
//   );
// }



// const createExchangeHistoryObservable = (props: HistorySubscriptionFilterProps) => {

//   let { query, variables } = generateChaingraphSubscriptionOp({
//     actions: {
//       __args: {
//         where: {
//           contract: {
//             _eq: contracts[config.env].bank,
//           },
//           action: {
//             _eq: 'transfer',
//           },
//           data: {
//             _contains: {
//               from: props.account,
//             },
//           },
//           transaction: {
//             block_num: {
//               _gte: props.block_num,
//             },
//           }
//         },
//         order_by: [{
//           transaction: {
//             block_num: 'desc',
//           }
//         }],
//         limit: 10000,
//       },
//     },
//   });

//   return chaingraph.subscribe(
//     { query, variables },
//     {
//       next: (data: any) => console.log(data),
//       error: console.error,
//       complete: () => console.log('finished'),
//     }
//   );
// }

// const createUserPositionsObservable = (account: string) => {

//   let { query, variables } = generateChaingraphSubscriptionOp({
//     table_rows: {
//       __args: {
//         where: {
//           chain: {
//             _eq: config.eosChainName,
//           },
//           contract: {
//             _in: [contracts[config.env].bank],
//           },
//           table: {
//             // ['cripto balances', 'stable balances', 'margin balances']
//             _in: ['spotv2', 'stablev2', 'marginv2'],
//           },
//           scope: {
//             _eq: account,
//           },

//         },
//       },
//     },
//   });

//   return chaingraph.subscribe(
//     { query, variables },
//     {
//       next: (data: any) => console.log(data),
//       error: console.error,
//       complete: () => console.log('finished')
//     }
//   );
// }

// const createBankHistoryObservable = (props: any) => {

//   let { query, variables } = generateChaingraphSubscriptionOp({
//     actions: {
//       __args: {
//         where: {
//           contract: {
//             _eq: contracts[config.env].bank,
//           },
//           action: {
//             _eq: 'transfer',
//           },
//           data: {
//             _contains: {
//               from: props.account,
//             },
//           },
//           transaction: {
//             block_num: {
//               _gte: props.block_num,
//             },
//           }
//         },
//         order_by: [{
//           transaction: {
//             block_num: 'desc',
//           }
//         }],
//         limit: 10000,
//       },
//     },
//   });
//   return chaingraph.subscribe(
//     { query, variables },
//     {
//       next: (data) => props.getData(data),
//       error: console.error,
//       complete: () => console.log('finished'),
//     }
//   );
// }


export const chaingraphService = {
  // createExchangeHistoryObservable,
  // createUserPositionsObservable,
  // createDelphiPricesObservable,
  // createBankHistoryObservable,
  checkIfAccountIsRegistered,
  fetchPairs,
  getUserLimits,
}
