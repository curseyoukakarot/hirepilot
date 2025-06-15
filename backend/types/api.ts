import { Request, Response } from 'express';
import { User } from '@supabase/supabase-js';

export interface SupabaseUser {
  id: string;
  email: string;
  role: string;
  // Add any other user fields your middleware attaches
}

// @ts-ignore
export interface ApiRequest extends Request {
  user?: SupabaseUser;
}

export interface ApiResponse extends Response {}

export type ApiHandler = (req: ApiRequest, res: ApiResponse) => Promise<ApiResponse | void>;

export interface ErrorResponse {
  error: string;
  details?: unknown;
} 