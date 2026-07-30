declare module 'edtf' {
  export type EdtfParsed = {
    readonly type: string;
    readonly level: number;
    readonly values?: readonly unknown[];
    readonly earlier?: boolean;
  };

  export function parse(input: string, constraints?: Record<string, unknown>): EdtfParsed;

  export type EdtfValue = {
    readonly edtf: string;
    readonly min: number;
    readonly max: number;
  };

  export default function edtf(input: string | EdtfParsed | Date): EdtfValue;
}
