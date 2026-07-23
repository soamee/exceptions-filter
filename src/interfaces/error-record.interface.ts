export interface ErrorRecord {
  id: string;
  exceptionMessage: string;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

export interface DuplicateCheckCriteria {
  exceptionMessage: string;
  stackTrace?: string;
  requestMethod?: string;
  requestUrl?: string;
  requestBody?: string;
  since: Date;
}

export interface CreateErrorData {
  exceptionMessage: string;
  file?: string;
  triggeredById?: string;
  stackTrace?: string;
  requestMethod?: string;
  requestUrl?: string;
  requestHeaders?: string;
  requestQuery?: string;
  requestBody?: string;
  additionalMessages?: string;
  userRole?: string;
  userAgent?: string;
  clientIp?: string;
  clientVersion?: string;
  appModuleName?: string;
  correlationId?: string;
  requestPath?: string;
  requestContext?: string;
  lastUserActions?: string;
  actionElapsedMs?: number;
}
