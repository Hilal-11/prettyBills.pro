// Minimal types for the parts of `qrcode` we use (the package ships no types).
declare module "qrcode" {
  export interface QRCodeModules {
    size: number
    data: Uint8Array
    get(row: number, col: number): number
  }
  export interface QRCodeData {
    modules: QRCodeModules
    version: number
  }
  export function create(
    text: string,
    options?: { errorCorrectionLevel?: "L" | "M" | "Q" | "H" }
  ): QRCodeData
}
