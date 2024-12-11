import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import { Err, Ok, Result } from 'ts-res';

import { BLOCKFROST_API_KEY } from '../configs/index.js';
import { convertError } from '../errors/index.js';

export interface AddressInfo {
  address: string;
  amount: { unit: string; quantity: string }[];
  stake_address?: string | null;
  script: boolean;
}

export const getAddressInfo = async (
  bech32Address: string
): Promise<Result<AddressInfo, string>> => {
  try {
    const blockfrostApi = new BlockFrostAPI({
      projectId: BLOCKFROST_API_KEY,
    });
    const result = await blockfrostApi.addresses(bech32Address);
    return Ok(result);
  } catch (err) {
    return Err(convertError(err));
  }
};
