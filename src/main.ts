import {
  asyncForEach,
  IHandleSvgOptions,
  LogCategory,
  Logger,
} from '@koralabs/kora-labs-common';
import _ from 'lodash';
import { Err, Ok, Result } from 'ts-res';

import { Status } from './entrypoint.js';
import { Monitor } from './monitor.js';
import {
  createIpfsCidFromBlob,
  fetchAdminCredentialsInPZSettings,
  fetchAllHandleNames,
  fetchCustomDollarSymbol,
  fetchHandle,
  fetchPersonalization,
  fetchPZScriptDetails,
  fetchReferenceToken,
  fetchRenderedHandleImage,
  getAddressInfo,
  remove0x,
} from './utils/index.js';

const projectName = 'HandleOwnershipRenderingLambda';
const totalTimeInMilliseconds = 1 * 86400000; // monitors all in 1 day
const parallel = 3; // monitor 3 handles at a time

const monitorHandle = async (
  handle: string,
  adminCreds: string[],
  pzScriptValidatorHashes: string[]
): Promise<Result<void, string>> => {
  if (!handle) return Ok();
  const personalizationResult = await fetchPersonalization(handle);
  if (!personalizationResult.ok) {
    Logger.log({
      message: `Fetching "${handle}" Personalization: ${personalizationResult.error}`,
      category: LogCategory.ERROR,
      event: `${projectName}.monitorHandle.fetchPersonalization`,
    });
    return Err(
      `Fetching "${handle}" Personalization: ${personalizationResult.error}`
    );
  }
  const personalizationData = personalizationResult.data;

  // check validated_by
  if (
    personalizationData?.validated_by &&
    adminCreds.some(
      (cred) =>
        cred.toLowerCase() ==
        remove0x(personalizationData.validated_by).toLocaleLowerCase()
    )
  ) {
    return Ok();
  }

  const handleResult = await fetchHandle(handle);
  if (!handleResult.ok) {
    Logger.log({
      message: `Fetching "${handle}" Handle Data: ${handleResult.error}`,
      category: LogCategory.ERROR,
      event: `${projectName}.monitorHandle.fetchHandle`,
    });
    return Err(`Fetching "${handle}" Handle Data: ${handleResult.error}`);
  }
  const handleData = handleResult.data;

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
      message: `Fetching ${resolvedAddress} Address Info: ${addressInfoResult.error}`,
      category: LogCategory.ERROR,
      event: `${projectName}.monitorHandle.getAddressInfo`,
    });
    return Err(
      `Fetching ${resolvedAddress} Address Info: ${addressInfoResult.error}`
    );
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
      message: `Handle "${handle}" doesn't own bg_asset - ${bgAssetUnit}`,
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
      message: `Handle "${handle}" doesn't own pfp_asset - ${pfpAssetUnit}`,
      category: LogCategory.NOTIFY,
      event: `${projectName}.monitorHandle.NOT_OWN_PFP_ASSET`,
    });
    /// TODO:
    /// reset handle here
    return Ok();
  }

  const referenceTokenResult = await fetchReferenceToken(handle);
  if (!referenceTokenResult.ok) {
    Logger.log({
      message: `Fetching "${handle}" Reference Token Data: ${referenceTokenResult.error}`,
      category: LogCategory.ERROR,
      event: `${projectName}.monitorHandle.fetchHandle`,
    });
    return Err(
      `Fetching "${handle}" Reference Token Data: ${referenceTokenResult.error}`
    );
  }
  const referenceTokenData = referenceTokenResult.data;

  /// check if handle's PZ validator hash is same as ours
  const handleValidatorHash: string =
    referenceTokenData?.script?.validatorHash || '';
  if (pzScriptValidatorHashes.includes(handleValidatorHash)) return Ok();

  /// otherwise check ipfs image
  const designer = personalizationData?.designer;
  const handleSvgOptions: IHandleSvgOptions = {
    ...(designer || {}),
    pfp_image: handleData.pfp_image,
    pfp_asset: handleData.pfp_asset,
    bg_image: handleData.bg_image,
    bg_asset: handleData.bg_asset,
    og_number: handleData.og_number,
  };

  /// fetch creator default data if exist
  const customDollarSymbolResult = await fetchCustomDollarSymbol(handleData);
  if (!customDollarSymbolResult.ok) {
    Logger.log({
      message: `Fetching "${handle}" Custom Dollar Symbol: ${customDollarSymbolResult.error}`,
      category: LogCategory.ERROR,
      event: `${projectName}.monitorHandle.fetchIsCustomDollarSymbol`,
    });
    return Err(
      `Fetching "${handle}" Custom Dollar Symbol: ${customDollarSymbolResult.error}`
    );
  }
  const disableDollarSymbol = customDollarSymbolResult.data === 1n;

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
    /// Valid Admin Credentials from PZ settings
    const adminCredsResult = await fetchAdminCredentialsInPZSettings();
    if (!adminCredsResult.ok) {
      Logger.log({
        message: `Fetching Admin Credentials In PZ Settings: ${adminCredsResult.error}`,
        category: LogCategory.ERROR,
        event: `${projectName}.fetchAdminCredentialsInPZSettings`,
      });
      await monitor.sleep(10, 20);
      continue;
    }
    const adminCreds = adminCredsResult.data;

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
      async (handles) => {
        await Promise.all(
          handles.map((handle) =>
            monitorHandle(handle, adminCreds, pzScriptValidatorHashes)
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
  // const result = await monitorHandle('firingdev', pzScriptValidatorHashes);
  // console.log(result);

  return Ok(Status.Success);
};

export default main;
