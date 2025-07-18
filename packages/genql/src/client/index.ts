import { createClient as createWsClient } from "graphql-ws";
import { createClient } from "../../generated";
import type { GraphqlOperation } from "../../generated/runtime/generateGraphqlOperation";
import type { GraphQLSdkProps } from "./client.types";

export * from "../../generated";

// Server side client
export function createChaingraphClient({
	// apiKey = "",
	options = {},
	url = "https://graph.bitcash.org",
	config = {},
}: GraphQLSdkProps = {}) {
	// const headers =  {
	// 	"x-chaingraph-api-key": apiKey,
	// }

	let subscribe;

	if ("webSocketImpl" in options) {
		const { subscribe: subscriptions } = createWsClient({
			url: url.replace("http", "ws"),
			...options,
			// connectionParams: () => {
			// 	return {
			// 		headers,
			// 	};
			// },
		});
		subscribe = subscriptions;
	}

	const client = createClient({
		url,
		fetcher: async (operation: GraphqlOperation | GraphqlOperation[]): Promise<{ data?: any; errors?: any[] }> => {
				console.log('🔍 Chaingraph query to:', url)
				console.log('🔍 Headers:', headers)
				console.log('🔍 Operation:', JSON.stringify(operation, null, 2))
				
				const response = await fetch(url, {
					method: "POST",
					// headers,
					body: JSON.stringify(operation),
					...config,
				});
				
				if (!response.ok) {
					console.error('❌ Chaingraph HTTP error:', response.status, response.statusText)
					const errorText = await response.text()
					console.error('❌ Error body:', errorText)
					throw new Error(`Chaingraph HTTP error: ${response.status} ${response.statusText}`)
				}
				
				const fetchResponse = await response.json() as { data?: any; errors?: any[] };
				console.log('✅ Chaingraph response:', JSON.stringify(fetchResponse, null, 2))
				
				return fetchResponse;
		},
	});

	return {
		subscribe,
		...client,
	};
}
