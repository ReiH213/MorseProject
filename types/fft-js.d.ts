declare module "fft-js" {
  export class FFT {
    constructor(size: number);
    createComplexArray(): Float64Array;
    realTransform(out: Float64Array, signal: Float64Array): void;
    completeSpectrum(out: Float64Array): void;
  }
}
