import {
  asyncForEach,
  IHandleSvgOptions,
  LogCategory,
  Logger,
  ScriptDetails,
} from '@koralabs/kora-labs-common';
import { Err, Ok, Result } from 'ts-res';
import _ from 'lodash';

import { Status } from './entrypoint.js';
import { Monitor } from './monitor.js';
import {
  convertJsonToCbor,
  createIPFSFromBytes,
  fetchAllHandleNames,
  fetchPersonalizedHandle,
  fetchPZScriptDetails,
  getAddressInfo,
  processHandleImage,
} from './utils/index.js';

const projectName = 'HandleOwnershipRenderingLambda';
const totalTimeInMilliseconds = 5 * 86400000;
const parallel = 3; /// monitor 3 handles at a time

const monitorHandle = async (
  handle: string,
  pzScriptValidatorHashes: string[]
): Promise<Result<void, string>> => {
  const handleDataResult = await fetchPersonalizedHandle(handle);
  if (!handleDataResult.ok) {
    Logger.log({
      message: `Fetching Personalized Handle: ${handleDataResult.error}`,
      category: LogCategory.ERROR,
      event: `${projectName}.monitorHandle.fetchPersonalizedHandle`,
    });
    return Err(`Fetching Personalized Handle: ${handleDataResult.error}`);
  }

  const handleData = handleDataResult.data;

  /// get handle owner's info
  // const resolvedAddress = handleData.resolved_addresses.ada;
  // const addressInfoResult = await getAddressInfo(resolvedAddress);
  // if (!addressInfoResult.ok) {
  //   Logger.log({
  //     message: `Fetching Address Info: ${addressInfoResult.error}`,
  //     category: LogCategory.ERROR,
  //     event: `${projectName}.monitorHandle.getAddressInfo`,
  //   });
  //   return Err(`Fetching Address Info: ${addressInfoResult.error}`);
  // }

  /// check if handle owns PZ assets
  // const addressBalance = addressInfoResult.data.amount;
  // const { bg_asset: bgAssetUnit, pfp_asset: pfpAssetUnit } = handleData;
  // if (
  //   bgAssetUnit &&
  //   !addressBalance.find((amount) => amount.unit == bgAssetUnit)
  // ) {
  //   /// reset handle - handle doesn't own Bg Asset
  //   Logger.log({
  //     message: `Handle "${handle}" doesn't own bg_asset`,
  //     category: LogCategory.NOTIFY,
  //     event: `${projectName}.monitorHandle.NOT_OWN_BG_ASSET`,
  //   });
  //   return Ok();
  // }

  // if (
  //   pfpAssetUnit &&
  //   !addressBalance.find((amount) => amount.unit == pfpAssetUnit)
  // ) {
  //   /// reset handle - handle doesn't own Pfp Asset
  //   Logger.log({
  //     message: `Handle "${handle}" doesn't own pfp_asset`,
  //     category: LogCategory.NOTIFY,
  //     event: `${projectName}.monitorHandle.NOT_OWN_PFP_ASSET`,
  //   });
  //   return Ok();
  // }

  /// <---- ASK about how to check validator is ours
  /// check if handle's PZ validator hash is same as ours
  // const handleValidatorHash: string =
  //   handleData.reference_token?.script?.validatorHash || '';
  // if (pzScriptValidatorHashes.includes(handleValidatorHash)) return Ok();

  /// otherwise check ipfs image
  const designer = handleData.personalization?.designer;
  const handleSvgOptions: IHandleSvgOptions = {
    ...(designer || {}),
    pfp_image: handleData.pfp_image,
    pfp_asset: handleData.pfp_asset,
    bg_image: handleData.bg_image,
    bg_asset: handleData.bg_asset,
    og_number: handleData.og_number,
  };

  const processedHandleResult = await processHandleImage({
    handle: handle,
    options: handleSvgOptions,
    size: 2048,
    // disableDollarSymbol
  });
  if (!processedHandleResult.ok) {
    Logger.log({
      message: `Processing "${handle}" Image: ${processedHandleResult.error}`,
      category: LogCategory.ERROR,
      event: `${projectName}.monitorHandle.processHandleImage`,
    });
    return Ok();
  }
  const processedHandle = processedHandleResult.data;

  // if (!designer) return Ok();
  // // const designerDatumCborResult = await convertJsonToCbor(designer);
  // // if (!designerDatumCborResult.ok) {
  // //   Logger.log({
  // //     message: `Converting Designer to CBOR: ${designerDatumCborResult.error}`,
  // //     category: LogCategory.ERROR,
  // //     event: `${projectName}.monitorHandle.convertJsonToCbor`,
  // //   });
  // //   return Err(`Converting Designer to CBOR: ${designerDatumCborResult.error}`);
  // // }

  const cidResult = await createIPFSFromBytes(processedHandle);
  console.log(cidResult);
  return Ok();
};

const monitorHandles = async (handles: string[]): Promise<void> => {
  const handlesData = await Promise.all(
    handles.map((handle) => fetchPersonalizedHandle(handle))
  );
};

const main = async (): Promise<Result<Status, string>> => {
  const monitor = new Monitor();

  // while (!monitor.finished()) {
  //   /// Latest Personalization Script Detail
  //   const pzScriptDetails = await fetchPZScriptDetails();
  //   if (!pzScriptDetails.ok) {
  //     Logger.log({
  //       message: `Fetching PZ Script Details: ${pzScriptDetails.error}`,
  //       category: LogCategory.ERROR,
  //       event: `${projectName}.fetchPZScriptDetails`,
  //     });
  //     await monitor.sleep(10, 20);
  //     continue;
  //   }
  //   const pzScriptValidatorHashes = pzScriptDetails.data.map(
  //     (script) => script.validatorHash
  //   );

  //   /// fetch all handle names and calculate asyncEach time
  //   const allHandleNamesResult = await fetchAllHandleNames();
  //   if (!allHandleNamesResult.ok) {
  //     Logger.log({
  //       message: allHandleNamesResult.error,
  //       category: LogCategory.ERROR,
  //       event: `${projectName}.fetchAllHandleNames`,
  //     });
  //     await monitor.sleep(10, 20);
  //     continue;
  //   }

  //   const handlesTotalCount = allHandleNamesResult.data.length;
  //   const parallelCount = Math.ceil(handlesTotalCount / parallel);
  //   const asyncEachTime = Math.floor(
  //     totalTimeInMilliseconds / Math.max(1, parallelCount)
  //   );

  //   Logger.log({
  //     message: `Monitor ${parallel} Handles every ${asyncEachTime} ms`,
  //     category: LogCategory.INFO,
  //     event: `${projectName}.asyncEachTime`,
  //   });

  //   await asyncForEach(
  //     _.chunk(allHandleNamesResult.data, parallel),
  //     async (handles, index) => {
  //       await monitorHandles(handles);
  //     },
  //     asyncEachTime
  //   );
  // }

  monitorHandle('golddydev', []);
  return Ok(Status.Success);
};

export default main;
