import { createClient as createWsClient } from "graphql-ws";
import { createClient } from "../../generated";
import type { GraphqlOperation } from "../../generated/runtime/generateGraphqlOperation";
import type { GraphQLSdkProps } from "./client.types";

export * from "../../generated";

// Server side client
export function createChaingraphClient({
	apiKey = "",
	options = {},
	url = "https://graph.bitcash.org",
	config = {},
}: GraphQLSdkProps) {
	const headers =  {
		"x-chaingraph-api-key": apiKey,
	}

	let subscribe;

	if ("webSocketImpl" in options) {
		const { subscribe: subscriptions } = createWsClient({
			url: url.replace("http", "ws"),
			...options,
			connectionParams: () => {
				return {
					headers,
				};
			},
		});
		subscribe = subscriptions;
	}

	const client = createClient({
		fetcher: async (operation: GraphqlOperation | GraphqlOperation[]): Promise<{ data?: any; errors?: any[] }> => {
				const fetchResponse = await fetch(url, {
					method: "POST",
					headers,
					body: JSON.stringify(operation),
					...config,
				}).then((response) => response.json()) as { data?: any; errors?: any[] };

				return fetchResponse;
		},
	});

	return {
		subscribe,
		...client,
	};
}
