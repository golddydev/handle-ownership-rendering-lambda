export const remove0x = (val: string): string =>
  val.startsWith('0x') ? val.slice(2) : val;
