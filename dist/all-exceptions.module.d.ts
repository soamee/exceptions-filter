import { DynamicModule } from "@nestjs/common";
import { ExceptionsFilterConfig } from "./interfaces/filter-config.interface";
interface AsyncModuleOptions {
    imports?: any[];
    useFactory: (...args: any[]) => ExceptionsFilterConfig | Promise<ExceptionsFilterConfig>;
    inject?: any[];
}
export declare class AllExceptionsModule {
    static forRoot(config: ExceptionsFilterConfig): DynamicModule;
    static forRootAsync(options: AsyncModuleOptions): DynamicModule;
}
export {};
//# sourceMappingURL=all-exceptions.module.d.ts.map