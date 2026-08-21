import { Request } from 'express';
import { UserRole } from '@scheduler/shared';

export interface AuthUserContext {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
}

export interface AuthApiKeyContext {
  id: string;
  projectId: string;
  organizationId: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserContext;
  apiKey?: AuthApiKeyContext;
}
