import { AssetNameLabel } from '@koralabs/kora-labs-common';
import { config } from 'dotenv';
config();

export const {
  NODE_ENV = '',
  NETWORK = '',
  KORA_USER_AGENT = '',
  HANDLE_ME_API_KEY = '',
  BLOCKFROST_API_KEY = '',
  PINATA_API_KEY = '',
  PINATA_API_SECRET = '',
} = process.env;
export const NETWORK_HOST =
  process.env.NETWORK?.toLocaleLowerCase() == 'mainnet'
    ? ''
    : `${process.env.NETWORK?.toLowerCase()}.`;
export const HANDLE_API_ENDPOINT =
  process.env.HANDLE_API_ENDPOINT || `https://${NETWORK_HOST}api.handle.me`;
export const IMAGE_RENDERER_ENDPOINT = `https://${NETWORK_HOST}render.handle.me`;

// handle constant
export const HANDLE_POLICY_ID =
  'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a';
export const PZ_SETTING_HANDLE_NAME = 'pz_settings';
export const PZ_SETTING_HANDLE_HEX_NAME =
  AssetNameLabel.LBL_222 + Buffer.from(PZ_SETTING_HANDLE_NAME).toString('hex');
