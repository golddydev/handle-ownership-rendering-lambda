import { Err, Ok, Result } from 'ts-res';
import fs from 'fs';
import { convertError } from '../errors/index.js';
import { base58btc } from 'multiformats/bases/base58';
import { importer } from 'ipfs-unixfs-importer';
import { MemoryBlockstore } from 'blockstore-core/memory';
import all from 'it-all';
import { CID } from 'multiformats';

export const createIPFSFromBytes = async (
  imageBlob: Blob
): Promise<Result<string, string>> => {
  try {
    const fileStream = imageBlob.stream();
    // Create a blockstore for storing intermediate blocks
    const blockstore = new MemoryBlockstore();

    // Use UnixFS importer to process the file into IPLD blocks
    const results = await all(
      importer(
        [{ content: fileStream }], // Input file as a stream
        blockstore
      )
    );

    // The last result is the root CID
    const rootCid = results[results.length - 1].cid;

    const parsedCid = CID.parse(rootCid.toString());
    return Ok(parsedCid.toString(base58btc.encoder));
  } catch (err) {
    return Err(convertError(err));
  }
};
