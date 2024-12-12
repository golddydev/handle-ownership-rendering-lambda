import { fetch } from 'cross-fetch';
import { IS_PRODUCTION } from '@koralabs/kora-labs-common';
import {
  HANDLE_ME_API_KEY,
  KORA_USER_AGENT,
  NETWORK_HOST,
} from '../configs/index.js';

export const HANDLE_API_ENDPOINT =
  process.env.HANDLE_API_ENDPOINT || `https://${NETWORK_HOST}api.handle.me`;

export const fetchApi = async (
  endpoint: string,
  params: RequestInit = {}
): Promise<Response> => {
  const { headers, ...rest } = params;
  const baseUrl = HANDLE_API_ENDPOINT;
  const url = `${baseUrl}${endpoint}`;
  const apiKey = IS_PRODUCTION ? '' : HANDLE_ME_API_KEY;

  const newHeaders = new Headers(headers);
  newHeaders.append('User-Agent', KORA_USER_AGENT);
  newHeaders.append('api-key', apiKey);
  return fetch(url, {
    headers: newHeaders,
    ...rest,
  });
};
