import { Result } from 'ts-res';

enum Status {
  Success = 0,
  Fail = 1,
}

type Entrypoint = () => Promise<Result<Status, string>>;

const start = async (main: Entrypoint): Promise<Status> => {
  const status = await main();

  if (!status.ok) {
    console.error('Error:', status.error);
    return Status.Fail;
  }

  return status.data;
};

const run = async (main: Entrypoint) => {
  console.debug('Starting');
  const result = await start(main);
  console.debug('Finished with exit code', result);
  process.exitCode = result;
};

export default run;
export { Status };
