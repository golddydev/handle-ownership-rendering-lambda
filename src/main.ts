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
  createIpfsCidFromBlob,
  fetchAllHandleNames,
  fetchPersonalizedHandle,
  fetchPZScriptDetails,
  getAddressInfo,
  fetchRenderedHandleImage,
  fetchCreatorDefaults,
} from './utils/index.js';

const projectName = 'HandleOwnershipRenderingLambda';
const totalTimeInMilliseconds = 5 * 86400000;
const parallel = 3; /// monitor 3 handles at a time

const monitorHandle = async (
  handle: string,
  pzScriptValidatorHashes: string[]
): Promise<Result<void, string>> => {
  if (!handle) return Ok();
  console.log(`Start Checking "${handle}"`);
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
  const resolvedAddress = handleData?.resolved_addresses?.ada;
  if (!resolvedAddress) {
    Logger.log({
      message: `"${handle}" has no resolved address`,
      category: LogCategory.ERROR,
      event: `${projectName}.monitorHandle.NO_RESOLVED_ADDRESS`,
    });
    return Err(`"${handle}" has no resolved address`);
  }

  const addressInfoResult = await getAddressInfo(resolvedAddress);
  if (!addressInfoResult.ok) {
    Logger.log({
      message: `Fetching Address Info: ${addressInfoResult.error}`,
      category: LogCategory.ERROR,
      event: `${projectName}.monitorHandle.getAddressInfo`,
    });
    return Err(`Fetching Address Info: ${addressInfoResult.error}`);
  }

  /// check if handle owns PZ assets
  const addressBalance = addressInfoResult.data.amount;
  const { bg_asset: bgAssetUnit, pfp_asset: pfpAssetUnit } = handleData;
  if (
    bgAssetUnit &&
    !addressBalance.find((amount) => amount.unit == bgAssetUnit)
  ) {
    /// handle doesn't own Bg Asset
    Logger.log({
      message: `Handle "${handle}" doesn't own bg_asset`,
      category: LogCategory.NOTIFY,
      event: `${projectName}.monitorHandle.NOT_OWN_BG_ASSET`,
    });
    /// TODO:
    /// reset handle here
    return Ok();
  }
  if (
    pfpAssetUnit &&
    !addressBalance.find((amount) => amount.unit == pfpAssetUnit)
  ) {
    /// handle doesn't own Pfp Asset
    Logger.log({
      message: `Handle "${handle}" doesn't own pfp_asset`,
      category: LogCategory.NOTIFY,
      event: `${projectName}.monitorHandle.NOT_OWN_PFP_ASSET`,
    });
    /// TODO:
    /// reset handle here
    return Ok();
  }

  /// check if handle's PZ validator hash is same as ours
  const handleValidatorHash: string =
    handleData.reference_token?.script?.validatorHash || '';
  if (pzScriptValidatorHashes.includes(handleValidatorHash)) return Ok();

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

  /// fetch creator default data if exist
  const creatorDefaultsResult = await fetchCreatorDefaults(handleData);
  if (!creatorDefaultsResult.ok) {
    Logger.log({
      message: `Fetching Creator Detaults: ${creatorDefaultsResult.error}`,
      category: LogCategory.ERROR,
      event: `${projectName}.monitorHandle.fetchCreatorDefaults`,
    });
    return Err(`Fetching Creator Detaults: ${creatorDefaultsResult.error}`);
  }

  const disableDollarSymbol =
    creatorDefaultsResult.data?.custom_dollar_symbol === 1;

  /// fetch rendered handle iamge
  const renderedHandleImageResult = await fetchRenderedHandleImage({
    handle: handle,
    options: handleSvgOptions,
    size: 2048,
    disableDollarSymbol,
  });
  if (!renderedHandleImageResult.ok) {
    Logger.log({
      message: `Fetching Rendered "${handle}" Image: ${renderedHandleImageResult.error}`,
      category: LogCategory.ERROR,
      event: `${projectName}.monitorHandle.processHandleImage`,
    });
    return Err(
      `Fetching Rendered "${handle}" Image: ${renderedHandleImageResult.error}`
    );
  }
  const renderedhandleImage = renderedHandleImageResult.data;

  /// create ipfs cid from blob (predeterministically)
  const cidResult = await createIpfsCidFromBlob(renderedhandleImage);
  if (!cidResult.ok) {
    Logger.log({
      message: `Creating IPFS CID from "${handle}" Blob Image: ${cidResult.error}`,
      category: LogCategory.ERROR,
      event: `${projectName}.monitorHandle.createIpfsCidFromBlob`,
    });
    return Err(
      `Creating IPFS CID from "${handle}" Blob Image: ${cidResult.error}`
    );
  }

  /// check ipfs cid matches
  const correctImage = `ipfs://${cidResult.data}`;
  if (correctImage != handleData.image) {
    /// handle doesn't own Pfp Asset
    Logger.log({
      message: `Handle "${handle}" image CID doesn't match. Wrong CID: ${handleData.image}, Correct CID: ${correctImage}`,
      category: LogCategory.NOTIFY,
      event: `${projectName}.monitorHandle.IMAGE_NOT_MATCH`,
    });
    /// TODO:
    /// reset handle here
    return Ok();
  }

  console.log(`Checked "${handle}, this handle is good"`);
  return Ok();
};

const main = async (): Promise<Result<Status, string>> => {
  const monitor = new Monitor();

  while (!monitor.finished()) {
    /// Latest Personalization Script Detail
    const pzScriptDetails = await fetchPZScriptDetails();
    if (!pzScriptDetails.ok) {
      Logger.log({
        message: `Fetching PZ Script Details: ${pzScriptDetails.error}`,
        category: LogCategory.ERROR,
        event: `${projectName}.fetchPZScriptDetails`,
      });
      await monitor.sleep(10, 20);
      continue;
    }
    const pzScriptValidatorHashes = pzScriptDetails.data.map(
      (script) => script.validatorHash
    );

    /// fetch all handle names and calculate asyncEach time
    const allHandleNamesResult = await fetchAllHandleNames();
    if (!allHandleNamesResult.ok) {
      Logger.log({
        message: allHandleNamesResult.error,
        category: LogCategory.ERROR,
        event: `${projectName}.fetchAllHandleNames`,
      });
      await monitor.sleep(10, 20);
      continue;
    }

    const handlesTotalCount = allHandleNamesResult.data.length;
    const parallelCount = Math.ceil(handlesTotalCount / parallel);
    const asyncEachTime = Math.floor(
      totalTimeInMilliseconds / Math.max(1, parallelCount)
    );

    Logger.log({
      message: `Monitor ${parallel} Handles every ${asyncEachTime} ms`,
      category: LogCategory.INFO,
      event: `${projectName}.asyncEachTime`,
    });

    await asyncForEach(
      _.chunk(allHandleNamesResult.data, parallel),
      async (handles, index) => {
        await Promise.all(
          handles.map((handle) =>
            monitorHandle(handle, pzScriptValidatorHashes)
          )
        );
      },
      asyncEachTime
    );
  }

  // const pzScriptDetails = await fetchPZScriptDetails();
  // if (!pzScriptDetails.ok)
  //   return Err(`Fetching PZ Script Details: ${pzScriptDetails.error}`);
  // const pzScriptValidatorHashes = pzScriptDetails.data.map(
  //   (script) => script.validatorHash
  // );
  // await monitorHandle('-123', pzScriptValidatorHashes);

  return Ok(Status.Success);
};

export default main;
