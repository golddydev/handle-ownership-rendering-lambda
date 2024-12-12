import { Err, Ok, Result } from 'ts-res';
import { fetchApi } from './api.js';

import { convertError } from '../errors/index.js';
import { ICreatorDefaults } from '@koralabs/kora-labs-common';

export const decodeDatum = async <T>(
  datum: string,
  schema?: Record<string, unknown>
): Promise<Result<T, string>> => {
  try {
    const res = await fetchApi(`/datum?from=plutus_data_cbor&to=json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cbor: datum,
        schema,
      }),
    });
    if (!res.ok) return Err(res.statusText);
    const result = await res.json();
    return Ok(result as T);
  } catch (err) {
    return Err(convertError(err));
  }
};

export const getImageDataFromDatum = async (datum: string) => {
  try {
    const decodedDatumResult = await decodeDatum<any>(datum, {
      constructor_0: {
        '[0]': {
          name: 'string',
          image: 'string',
        },
        '[2]': {
          font: 'string',
          text_ribbon_gradient: 'string',
          force_creator_settings: 'bool',
          qr_inner_eye: 'string',
          qr_outer_eye: 'string',
          qr_dot: 'string',
          qr_image: 'string',
        },
      },
    });
    if (!decodedDatumResult.ok)
      return Err(`Decoding Asset Datum: ${decodedDatumResult.error}`);
    const decodedDatum = decodedDatumResult.data;

    const image = decodedDatum?.constructor_0?.[0]?.image;

    let data: {
      image: string;
      creatorDefaults?: ICreatorDefaults;
      metadata?: Record<string, unknown>;
    } = {
      image,
    };

    const creatorDefaults =
      decodedDatum?.constructor_0?.[2]?.constructor_0?.[0] ??
      decodedDatum.constructor_0?.[2];
    if (creatorDefaults) {
      data = {
        image,
        creatorDefaults,
        metadata: decodedDatum?.constructor_0?.[0],
      };
    }

    return Ok(data);
  } catch (err) {
    return Err(convertError(err));
  }
};
