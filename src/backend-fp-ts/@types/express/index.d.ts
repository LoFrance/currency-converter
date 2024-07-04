// to make the file a module and avoid the TypeScript error
export {};

declare global {
  namespace Express {
    export interface CustomResponse {
      base: string;
      target: string;
      conversionRate: number;
      convertedAmount: number;
    }
    export interface CustomErrorResponse {
      message: string;
      details: any;
    }
  }
}
