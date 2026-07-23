import type { ExceptionFilter, ArgumentsHost } from "@nestjs/common";
import { ExceptionsFilterConfig } from "./interfaces/filter-config.interface";
export declare class AllExceptionsFilter implements ExceptionFilter {
    private readonly config;
    private readonly logger;
    private readonly recentErrors;
    constructor(config: ExceptionsFilterConfig);
    catch(exception: unknown, host: ArgumentsHost): Promise<void>;
    private extractMessage;
    private getClientMessage;
    private getErrorResponse;
    private extractFileName;
    private logErrorToDatabase;
    private isThrottled;
    private cleanupRecentErrors;
    private isFromExceptionController;
    private getHeaderValue;
    private extractScreenContext;
    private formatRequestContext;
    private extractLastActions;
    private extractActionElapsedMs;
}
//# sourceMappingURL=all-exceptions.filter.d.ts.map