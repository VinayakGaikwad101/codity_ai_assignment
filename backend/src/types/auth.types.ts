import { Request } from 'express';
import { UserRole } from '@scheduler/shared';

export interface JwtPayload {
  userId: string;
  organizationId: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
  apiKey?: {
    id: string;
    organizationId: string;
    projectId?: string | null;
    role: UserRole;
  };
}
