import { DynamicModule, Module } from "@nestjs/common";
import type { ErrorPersistenceAdapter } from "../interfaces/error-persistence.interface";
import type { ErrorRecord } from "../interfaces/error-record.interface";
import type { SourceMapStorage } from "./source-map-storage.interface";
import { ClientErrorsController } from "./client-errors.controller";
import {
  ClientErrorsService,
  CLIENT_ERRORS_PERSISTENCE,
  CLIENT_ERRORS_ON_ERROR,
} from "./client-errors.service";
import { CLIENT_ERRORS_API_KEY } from "./client-errors.controller";

export interface ClientErrorsModuleConfig {
  sourceMapStorage: SourceMapStorage;
  persistence: ErrorPersistenceAdapter;
  onError?: (error: ErrorRecord) => Promise<void>;
  apiKey: string;
}

@Module({})
export class ClientErrorsModule {
  static register(config: ClientErrorsModuleConfig): DynamicModule {
    return {
      module: ClientErrorsModule,
      controllers: [ClientErrorsController],
      providers: [
        { provide: "SOURCE_MAP_STORAGE", useValue: config.sourceMapStorage },
        { provide: CLIENT_ERRORS_PERSISTENCE, useValue: config.persistence },
        { provide: CLIENT_ERRORS_ON_ERROR, useValue: config.onError },
        { provide: CLIENT_ERRORS_API_KEY, useValue: config.apiKey },
        ClientErrorsService,
      ],
    };
  }
}
