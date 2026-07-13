declare module "bwip-js" {
  interface BwipOptions {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    includetext?: boolean;
    textxalign?: string;
  }
  function toBuffer(options: BwipOptions): Promise<Uint8Array>;
  export default { toBuffer };
}
