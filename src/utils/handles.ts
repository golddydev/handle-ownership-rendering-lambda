import {
  ICreatorDefaults,
  IHandle,
  IHandleSvgOptions,
  IPersonalization,
  IPersonalizedHandle,
  ISubHandleSettings,
  ScriptDetails,
} from '@koralabs/kora-labs-common';
import { Err, Ok, Result } from 'ts-res';
import fs from 'fs/promises';

import { fetchApi } from './api.js';

import { convertError } from '../errors/index.js';
import { IMAGE_RENDERER_ENDPOINT, KORA_USER_AGENT } from '../configs/index.js';
import fetch from 'cross-fetch';

export interface ScriptDetailsResponse {
  [address: string]: ScriptDetails;
}

export interface ProcessHandleImageResult {
  cid: string;
  hash: string;
  svg_version: string;
}

export const fetchPZScriptDetails = async (): Promise<
  Result<ScriptDetails[], string>
> => {
  try {
    const scriptDetail = await fetchApi(`/scripts?type=pz_contract`).then(
      (res) => res.json() as unknown as ScriptDetailsResponse
    );
    return Ok(Object.values(scriptDetail));
  } catch (err) {
    return Err(convertError(err));
  }
};

export const fetchAllHandleNames = async (): Promise<
  Result<string[], string>
> => {
  const myHeaders = new Headers();
  myHeaders.append('Content-Type', 'text/plain');
  myHeaders.append('Accept', 'text/plain');

  const requestOptions: RequestInit = {
    method: 'GET',
    headers: myHeaders,
  };

  try {
    const result = await (await fetchApi('/handles', requestOptions)).text();
    const names = result.split('\n');
    return Ok(names);
  } catch (err) {
    return Err(convertError(err));
  }
};

export const convertJsonToCbor = async (
  json: object
): Promise<Result<string, string>> => {
  try {
    const res = await fetchApi('/datum?from=json&to=plutus_data_cbor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(json),
    }).then((res) => res.text());
    return Ok(res);
  } catch (err) {
    return Err(convertError(err));
  }
};

export const fetchPersonalizedHandle = async (
  handle: string
): Promise<Result<IPersonalizedHandle, string>> => {
  try {
    const params = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };
    const [handleResponse, personalizedResponse] = await Promise.all([
      fetchApi(`/handles/${handle}`, params),
      fetchApi(`/handles/${handle}/personalized`, params),
    ]);
    if (!handleResponse.ok) return Err(handleResponse.statusText);

    const handleData = (await handleResponse.json()) as unknown as IHandle;
    const personalizedData =
      (await personalizedResponse.json()) as unknown as IPersonalization;
    return Ok({
      ...handleData,
      personalization: personalizedData,
    } as IPersonalizedHandle);
  } catch (err) {
    return Err(convertError(err));
  }
};

export const processHandleImage = async ({
  handle,
  options,
  disableDollarSymbol = false,
  size = 2048,
}: {
  handle: string;
  size?: number;
  options: IHandleSvgOptions;
  disableDollarSymbol?: boolean;
}) => {
  try {
    const result = await fetch(`${IMAGE_RENDERER_ENDPOINT}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': KORA_USER_AGENT,
      },
      body: JSON.stringify({
        handle,
        options,
        size,
        disableDollarSymbol,
      }),
    });
    if (result.status === 200) {
      return Ok(await result.blob());
    }

    // if it's not a 200, throw an error
    const json = await result.json();
    return Err(`${result.status}|${convertError(json)}`);
  } catch (err) {
    return Err(convertError(err));
  }
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};
