import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import { Err, Ok, Result } from "ts-res";

import { BLOCKFROST_API_KEY } from "../configs/index.js";
import { convertError } from "../errors/index.js";

const blockfrostApi = new BlockFrostAPI({
  projectId: BLOCKFROST_API_KEY,
});

export interface AddressInfo {
  address: string;
  amount: { unit: string; quantity: string }[];
  stake_address?: string | null;
  script: boolean;
}

export interface AssetUtxo {
  address: string;
  amount: { unit: string; quantity: string }[];
  output_index: number;
  data_hash: string | null;
  inline_datum: string | null;
  collateral: boolean;
  reference_script_hash?: string | null;
  consumed_by_tx?: string | null;
  tx_hash: string;
}

export const getLatestTransactionForAsset = async (
  assetId: string
): Promise<Result<string, string>> => {
  try {
    const result = await blockfrostApi.assetsTransactions(assetId, {
      order: "desc",
      count: 1,
    });
    return Ok(result[0].tx_hash);
  } catch (err) {
    return Err(convertError(err));
  }
};

export const getAssetUtxo = async (
  assetId: string
): Promise<Result<AssetUtxo, string>> => {
  try {
    const latestTxHashResult = await getLatestTransactionForAsset(assetId);
    if (!latestTxHashResult.ok) return Err(latestTxHashResult.error);
    const txDetail = await blockfrostApi.txsUtxos(latestTxHashResult.data);

    const assetOutput = txDetail.outputs.find((output) =>
      output.amount.some((amount) => amount.unit === assetId)
    );
    if (!assetOutput) return Err(`Not Found Asset Output`);
    return Ok({ ...assetOutput, tx_hash: latestTxHashResult.data });
  } catch (err) {
    return Err(convertError(err));
  }
};

export const getAddressInfo = async (
  bech32Address: string
): Promise<Result<AddressInfo, string>> => {
  try {
    const result = await blockfrostApi.addresses(bech32Address);
    return Ok(result);
  } catch (err) {
    return Err(convertError(err));
  }
};
