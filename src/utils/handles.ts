import {
  AssetNameLabel,
  IHandle,
  IHandleSvgOptions,
  IPersonalization,
  IPersonalizedHandle,
  IReferenceToken,
  ScriptDetails,
} from '@koralabs/kora-labs-common';
import fetch from 'cross-fetch';
import { Err, Ok, Result } from 'ts-res';

import {
  HANDLE_POLICY_ID,
  IMAGE_RENDERER_ENDPOINT,
  KORA_USER_AGENT,
  PZ_SETTING_HANDLE_HEX_NAME,
} from '../configs/index.js';
import { convertError } from '../errors/index.js';
import { fetchApi } from './api.js';
import { getAssetUtxo } from './blockfrost.js';
import {
  getAdminCredentialsFromPZSettingsDatum,
  getCustomDollarSymbolFromDatum,
} from './datum.js';

export interface ScriptDetailsResponse {
  [address: string]: ScriptDetails;
}

export interface ProcessHandleImageResult {
  cid: string;
  hash: string;
  svg_version: string;
}

export const fetchHandle = async (
  handle: string
): Promise<Result<IHandle, string>> => {
  try {
    const params = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };
    const response = await fetchApi(`/handles/${handle}`, params);
    if (!response.ok) return Err(response.statusText);

    const handleData = (await response.json()) as unknown as IHandle;
    return Ok(handleData);
  } catch (err) {
    return Err(convertError(err));
  }
};

export const fetchPersonalization = async (
  handle: string
): Promise<Result<IPersonalization | undefined, string>> => {
  try {
    const params = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };
    const response = await fetchApi(`/handles/${handle}/personalized`, params);
    const personalizationData =
      (await response.json()) as unknown as IPersonalization;
    return Ok(personalizationData);
  } catch {
    return Ok(undefined);
  }
};

export const fetchReferenceToken = async (
  handle: string
): Promise<Result<IReferenceToken | undefined, string>> => {
  try {
    const params = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };
    const response = await fetchApi(
      `/handles/${handle}/reference_token`,
      params
    );
    const referenceTokenData =
      (await response.json()) as unknown as IReferenceToken;
    return Ok(referenceTokenData);
  } catch {
    return Ok(undefined);
  }
};

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

export const fetchAdminCredentialsInPZSettings = async (): Promise<
  Result<string[], string>
> => {
  const pzSettingsAssetId = `${HANDLE_POLICY_ID}${PZ_SETTING_HANDLE_HEX_NAME}`;
  const pzSettingsAssetUtxoResult = await getAssetUtxo(pzSettingsAssetId);
  if (!pzSettingsAssetUtxoResult.ok)
    return Err(pzSettingsAssetUtxoResult.error);

  const datum = pzSettingsAssetUtxoResult.data.inline_datum;
  if (!datum) return Err('PZ Settings Datum is null');
  const adminCredsResult = getAdminCredentialsFromPZSettingsDatum(datum);
  if (!adminCredsResult.ok) return Err(adminCredsResult.error);
  return Ok(adminCredsResult.data);
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

export const fetchRenderedHandleImage = async ({
  handle,
  options,
  disableDollarSymbol = false,
  size = 2048,
}: {
  handle: string;
  size?: number;
  options: IHandleSvgOptions;
  disableDollarSymbol?: boolean;
}): Promise<Result<Blob, string>> => {
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

export const fetchPersonalizedHandle = async (
  handle: string
): Promise<Result<IPersonalizedHandle, string>> => {
  try {
    const [
      handleDataResult,
      personalizationDataResult,
      referenceTokenDataResult,
    ] = await Promise.all([
      fetchHandle(handle),
      fetchPersonalization(handle),
      fetchReferenceToken(handle),
    ]);

    if (!handleDataResult.ok)
      return Err(`Fetching Handle Data: ${handleDataResult.error}`);
    if (!personalizationDataResult.ok)
      return Err(
        `Fetching Personalization Data: ${personalizationDataResult.error}`
      );
    if (!referenceTokenDataResult.ok)
      return Err(
        `Fetching Reference Token Data: ${referenceTokenDataResult.error}`
      );

    return Ok({
      ...handleDataResult.data,
      personalization: personalizationDataResult.data,
      reference_token: referenceTokenDataResult.data,
    } as IPersonalizedHandle);
  } catch (err) {
    return Err(convertError(err));
  }
};

export const fetchCustomDollarSymbol = async (
  handleData: IHandle
): Promise<Result<bigint | undefined, string>> => {
  try {
    if (handleData.bg_asset && handleData.bg_image) {
      const policyId = handleData.bg_asset.slice(0, 56);
      const hex = handleData.bg_asset.slice(56);
      if (
        hex.startsWith(AssetNameLabel.LBL_222) ||
        hex.startsWith(AssetNameLabel.LBL_444)
      ) {
        const refAssetName = `${AssetNameLabel.LBL_100}${hex
          .replace(AssetNameLabel.LBL_222, '')
          .replace(AssetNameLabel.LBL_444, '')}`;
        const refAssetId = `${policyId}${refAssetName}`;
        const assetUtxoResult = await getAssetUtxo(refAssetId);
        if (!assetUtxoResult.ok)
          return Err(`Fetching Bg Asset UTxO: ${assetUtxoResult.error}`);
        const assetDatum = assetUtxoResult.data.inline_datum;
        if (!assetDatum) return Ok(undefined);

        const customDollarSymbolResult =
          getCustomDollarSymbolFromDatum(assetDatum);
        if (!customDollarSymbolResult.ok)
          return Err(
            `Getting Custom Dollar Symbol Data from Datum of BgAsset ${refAssetId}: ${customDollarSymbolResult.error}`
          );
        return Ok(customDollarSymbolResult.data);
      }
    }
    return Ok(undefined);
  } catch {
    return Ok(undefined);
  }
};
