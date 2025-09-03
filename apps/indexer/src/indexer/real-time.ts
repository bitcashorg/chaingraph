import _ from "lodash";
import { config } from "../config";
import {
	deleteTableRows,
	upsertActions,
	upsertBlocks,
	upsertTableRows,
	upsertTransactions,
} from "../database";
import { deleteBlock } from "../database/queries";
import { logger } from "../lib/logger";
import type { MappingsReader } from "../mappings";
import { loadReader } from "../reader/ship-reader";
import type { ChainGraphAction, ChainGraphBlock } from "../types";
import type { WhitelistReader } from "../whitelist";
import { getChainGraphTableRowData } from "./utils";

export const startRealTimeStreaming = async (
	mappingsReader: MappingsReader,
	whitelistReader: WhitelistReader,
) => {
	logger.info("Starting realtime indexing from eosio ship ...");
	const { close$, blocks$, errors$ } = await loadReader(
		mappingsReader,
		whitelistReader,
	);

	// we subscribe to eosio ship reader whitelisted block stream and insert the data in postgres thru prisma
	// this stream contains only the blocks that are relevant to the whitelisted contract tables and actions
	blocks$.subscribe(async (block) => {
		try {
			const table_rows = Array.isArray((block as any).table_rows)
				? (block as any).table_rows
				: [];
			const transactionsArr = Array.isArray((block as any).transactions)
				? (block as any).transactions
				: [];
			const actionsArr = Array.isArray((block as any).actions)
				? (block as any).actions
				: [];

			logger.info(
				`Processed block ${block.block_num}. Transactions: ${transactionsArr.length}, actions ${actionsArr.length}, table rows ${table_rows.length} `,
			);

			// insert table_rows and filtering them by unique p_key to avoid duplicates and real-time crash
			const tableRowsDeltas = table_rows
				.filter((row) => {
					logger.warn("> The received row =>", { row });
					return (
						row.present &&
						Boolean(row.primary_key) &&
						!row.primary_key.normalize().toLowerCase().includes("undefined")
					);
				})
				.map((row) => getChainGraphTableRowData(row, mappingsReader));

			if (tableRowsDeltas.length > 0) {
				await upsertTableRows(tableRowsDeltas);
			}

			// delete table_rows
			const deleted_table_rows = table_rows
				.filter((row) => !row.present)
				.map((row) => getChainGraphTableRowData(row, mappingsReader));

			if (deleted_table_rows.length > 0) {
				await deleteTableRows(deleted_table_rows);
			}

			// delete block data in case of microfork
			deleteBlock(config.reader.chain, block.block_num);

			const blockData = _.omit(block, ["actions", "table_rows", "transactions", "chain_id"]);

			// insert block data
			await upsertBlocks([{ ...blockData, chain: config.reader.chain }]);

			// insert transaction data
			const transactions = transactionsArr.map((trx) => ({
				...trx,
				chain: config.reader.chain,
				block_num: block.block_num,
			}));

			// if there are transactions index them along with the actions
			if (transactions.length > 0) {
				await upsertTransactions(transactions);

				// insert action traces
				const actions: ChainGraphAction[] = actionsArr.map((action) => ({
					chain: config.reader.chain,
					transaction_id: action.transaction_id,
					contract: action.account,
					action: action.name,
					data:
						typeof action.data === "string"
							? JSON.parse(action.data)
							: action.data,
					authorization: action.authorization,
					global_sequence: action.global_sequence,
					action_ordinal: action.action_ordinal,
					account_ram_deltas: action.account_ram_deltas,
					receipt: action.receipt,
					context_free: action.context_free,
					account_disk_deltas: action.account_disk_deltas,
					console: action.console,
					receiver: "",
				}));

				if (actions.length > 0) await upsertActions(actions);
			}
		} catch (error) {
			logger.fatal("=> real-time blocks$.subscribe:", error);
			process.exit(1);
		}
	});

	close$.subscribe(() => logger.info("connection closed"));
	errors$.subscribe((error) => {
		logger.error("ShipReader Connection Error:", { error });
		process.exit(1);
	});
};
