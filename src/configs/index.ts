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
