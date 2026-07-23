import { DynamicModule, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AllExceptionsFilter } from "./all-exceptions.filter";
import {
  ExceptionsFilterConfig,
  EXCEPTIONS_FILTER_CONFIG,
} from "./interfaces/filter-config.interface";

interface AsyncModuleOptions {
  imports?: any[];
  useFactory: (
    ...args: any[]
  ) => ExceptionsFilterConfig | Promise<ExceptionsFilterConfig>;
  inject?: any[];
}

@Module({})
export class AllExceptionsModule {
  static forRoot(config: ExceptionsFilterConfig): DynamicModule {
    return {
      module: AllExceptionsModule,
      global: true,
      providers: [
        {
          provide: EXCEPTIONS_FILTER_CONFIG,
          useValue: config,
        },
        {
          provide: APP_FILTER,
          useClass: AllExceptionsFilter,
        },
      ],
    };
  }

  static forRootAsync(options: AsyncModuleOptions): DynamicModule {
    return {
      module: AllExceptionsModule,
      global: true,
      imports: options.imports || [],
      providers: [
        {
          provide: EXCEPTIONS_FILTER_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: APP_FILTER,
          useClass: AllExceptionsFilter,
        },
      ],
    };
  }
}
