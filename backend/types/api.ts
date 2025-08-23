import { Request, Response } from 'express';

export interface CustomUser {
  id: string;
  email?: string; // Make email optional for flexibility
  role?: string;
  first_name?: string;
  last_name?: string;
}

export interface ApiRequest extends Request {
  user?: CustomUser;
}

export type ApiHandler = (req: ApiRequest, res: Response) => Promise<void>;

export interface ErrorResponse {
  error: string;
  details?: unknown;
} 