import { Request } from 'express';

export interface CustomUser {
  id: string;
  email: string;
  role?: string;
  first_name?: string;
  last_name?: string;
}

export interface ApiRequest extends Request {
  user?: CustomUser;
}

export interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export type ApiHandler = (req: ApiRequest, res: ApiResponse) => Promise<ApiResponse | void>;

export interface ErrorResponse {
  error: string;
  details?: unknown;
} 