import {
  decodeUplcData,
  expectByteArrayData,
  expectConstrData,
  expectIntData,
  expectListData,
  expectMapData,
} from '@helios-lang/uplc';
import { Err, Ok, Result } from 'ts-res';

import { convertError } from '../errors/index.js';

export const getCustomDollarSymbolFromDatum = (
  datum: string
): Result<bigint | undefined, string> => {
  try {
    const data = decodeUplcData(datum);
    const constrData = expectConstrData(data);
    const thirdMap = expectMapData(constrData.fields[2]);
    const customDollarSymbolData = thirdMap.items.find(
      ([keyData, _]) =>
        Buffer.from(expectByteArrayData(keyData).toHex(), 'hex').toString() ==
        'custom_dollar_symbol'
    );
    if (!customDollarSymbolData) return Ok(undefined);
    const customDollarSymbolValue = expectIntData(
      customDollarSymbolData[1]
    ).value;
    return Ok(customDollarSymbolValue);
  } catch (err) {
    return Err(convertError(err));
  }
};

export const getAdminCredentialsFromPZSettingsDatum = (
  datum: string
): Result<string[], string> => {
  try {
    const data = decodeUplcData(datum);
    const constrData = expectListData(data);
    const adminCredsListData = expectListData(constrData.items[5]);
    const adminCreds = adminCredsListData.items.map((item) =>
      expectByteArrayData(item).toHex()
    );
    return Ok(adminCreds);
  } catch (err) {
    return Err(convertError(err));
  }
};
