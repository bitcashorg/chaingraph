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
	options?: { start_block_num?: number; end_block_num?: number; ignoreEnvStart?: boolean },
) => {
	logger.info("Starting realtime indexing from eosio ship ...");

	const primaryWs = config.reader.ws_url;
	let backupWs = (config.reader as any).ws_url_backup as string | undefined;

	let activeWs = primaryWs;
	let currentSubs: { blocks?: any; close?: any; errors?: any } = {};
	let reconnecting = false;
	let retryDelayMs = 1000;

	const connect = async (wsUrl: string) => {
		logger.info(`Connecting to SHiP at ${wsUrl}${wsUrl === backupWs ? " (backup)" : ""}`);
    // Resolve a working RPC endpoint before creating the reader
    return loadReader(mappingsReader, whitelistReader, { ...options, ws_urlOverride: wsUrl });
	};

	const cleanup = () => {
		currentSubs.blocks?.unsubscribe?.();
		currentSubs.close?.unsubscribe?.();
		currentSubs.errors?.unsubscribe?.();
		currentSubs = {};
	};

	const scheduleReconnect = (target: string) => {
		if (reconnecting) return;
		reconnecting = true;
		setTimeout(() => {
			reconnecting = false;
			void startWith(target);
		}, retryDelayMs);
		retryDelayMs = Math.min(retryDelayMs * 2, 10000);
	};

	const startWith = async (wsUrl: string) => {
		cleanup();
		activeWs = wsUrl;
		let close$: any, blocks$: any, errors$: any;
		try {
			({ close$, blocks$, errors$ } = await connect(wsUrl));
			retryDelayMs = 1000; // reset backoff on success
		} catch (err) {
			logger.error(`Failed to connect to SHiP at ${wsUrl}`, { err });
			// If backup fails, disable it; otherwise try backup once
			if (wsUrl === backupWs) {
				backupWs = undefined;
			}
			const target = wsUrl === primaryWs && backupWs ? (backupWs as string) : primaryWs;
			scheduleReconnect(target);
			return;
		}

		currentSubs.blocks = blocks$.subscribe(async (block) => {
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

		currentSubs.close = close$.subscribe(() => {
			logger.warn("SHiP connection closed. Attempting failover...");
			const target = backupWs && activeWs === primaryWs ? (backupWs as string) : primaryWs;
			scheduleReconnect(target);
		});

		currentSubs.errors = errors$.subscribe((error) => {
			logger.error("SHiP connection error:", { error });
			const target = backupWs && activeWs === primaryWs ? (backupWs as string) : primaryWs;
			scheduleReconnect(target);
		});
	};

	await startWith(primaryWs);
};
