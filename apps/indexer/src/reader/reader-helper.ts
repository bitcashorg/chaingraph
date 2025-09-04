import type {
	EosioReaderAbisMap,
	EosioReaderActionFilter,
	EosioReaderTableRowFilter,
	ShipTableDeltaName,
} from "@blockmatic/eosio-ship-reader";
import { rpcCall } from "../lib/eosio";
import { logger } from "../lib/logger";
import type { MappingsReader } from "../mappings";
import type {
	ChainGraphActionWhitelist,
	ChainGraphContractWhitelist,
	ChainGraphTableWhitelist,
} from "../types";
import type { WhitelistReader } from "../whitelist";

export interface ReaderHelper {
	delta_whitelist: () => ShipTableDeltaName[];
	contract_abis: () => EosioReaderAbisMap;
	table_rows_whitelist: () => EosioReaderTableRowFilter[];
	actions_whitelist: () => EosioReaderActionFilter[];
}

// eosio-ship-reader expects callback functions for retrieving filtering whitelists
// this pattern allow us to update the whitelist without stopping the reader
// this helper subscribes to the contract mappings subject and load abis in memory for ship reader to consume
export const createShipReaderDataHelper = async (
	mappingsReader: MappingsReader,
	whitelistReader: WhitelistReader,
): Promise<ReaderHelper> => {
	console.log("createShipReaderDataHelper");
	// in memory fitlers and abis
	let table_rows_filters: EosioReaderTableRowFilter[] | null = null;
	let actions_filters: EosioReaderActionFilter[] | null = null;
	let abis: EosioReaderAbisMap | null = null;

	// ship filter have a different format than ChainGraph mappings
	// this function massages the data for eosio-ship-reader to consume
	// eosio-ship-reader will support the chaingraph protocol, this is temporary
	// we should supoort actions: *, tables: * on the yml
	const updateShipFilters = (whitelist: ChainGraphContractWhitelist[]) => {
		actions_filters = whitelist.flatMap(({ contract: code, actions }) => {
			// handle wildcard
			if (actions[0] === "*") return [{ code, action: "*" }];

			return (actions as ChainGraphActionWhitelist[]).map(({ action }) => {
				return {
					code,
					action,
				};
			});
		});

		table_rows_filters = whitelist.flatMap(({ contract: code, tables }) => {
			// handle wildcard
			console.log({ code });
			if (tables[0] === "*") {
				const contractMappings = mappingsReader.mappings.find((m) => {
					return m.contract === code;
				});

				if (!contractMappings) {
					throw new Error("Mappings for contract not found");
				}
				return contractMappings.tables.map(({ table }) => ({ code, table }));
			}

			return (tables as ChainGraphTableWhitelist[]).flatMap(
				({ table, scopes }) => {
					if (!scopes || JSON.stringify(scopes) === JSON.stringify(["*"]))
						return [{ code, table }];
					return scopes.map((scope) => ({ code, table, scope }));
				},
			);
		});
	};

	// create in-memory filter for ship and subscribe to mappings to keep ship filter in sync
	updateShipFilters(whitelistReader.whitelist);
	whitelistReader.whitelist$.subscribe(updateShipFilters);

	// load abis in memory
	// TODO: load abis to db when contracts are listed, and keep in sync with then chain, listed to set abi actions.
	abis = new Map();
	const contracts = whitelistReader.whitelist.map(({ contract }) => contract);
	const abisArr = await Promise.all(
		contracts.map((c) =>
			rpcCall((client) => client.v1.chain.get_abi(c)).catch((error) => {
				console.error("Error getting abi", error);
				logger.info("Failed contract ABI -> ", c);
				return undefined;
			}),
		),
	);
	for (const abiEntry of abisArr) {
		if (abiEntry) {
			const { account_name, abi } = abiEntry;
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			abis.set(account_name, abi as any);
		}
	}

	// return latest abis in memory
	const contract_abis = () => abis;

	// return static list, this doesnt change
	const delta_whitelist = () =>
		[
			"contract_table",
			"contract_row",
			"contract_index64",
		] as ShipTableDeltaName[];

	// return in memory filters
	const table_rows_whitelist = () => table_rows_filters;
	const actions_whitelist = () => actions_filters;

	// Wait until results have been loaded to memory
	await abis;
	await actions_filters;
	await table_rows_filters;

	console.log("actions_filters", actions_filters);

	return {
		delta_whitelist,
		contract_abis,
		table_rows_whitelist,
		actions_whitelist,
	};
};
