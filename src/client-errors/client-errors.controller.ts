import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  UseInterceptors,
  UploadedFile,
  UnauthorizedException,
  Inject,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ClientErrorDto } from "./client-error.dto";
import { ClientErrorsService } from "./client-errors.service";
import type { SourceMapStorage } from "./source-map-storage.interface";

export const CLIENT_ERRORS_API_KEY = Symbol("CLIENT_ERRORS_API_KEY");

@Controller("client-errors")
export class ClientErrorsController {
  constructor(
    private readonly service: ClientErrorsService,
    @Inject("SOURCE_MAP_STORAGE") private readonly storage: SourceMapStorage,
    @Inject(CLIENT_ERRORS_API_KEY) private readonly apiKey: string,
  ) {}

  @Post()
  @HttpCode(201)
  async reportError(
    @Body() dto: ClientErrorDto,
  ): Promise<{ errorId?: string }> {
    return this.service.handleClientError(dto);
  }

  @Post("sourcemaps")
  @HttpCode(201)
  @UseInterceptors(FileInterceptor("file"))
  async uploadSourceMap(
    @UploadedFile() file: { buffer: Buffer; originalname: string },
    @Body("platform") platform: string,
    @Body("version") version: string,
    @Headers("x-sourcemap-api-key") providedKey: string,
  ): Promise<{ ok: boolean }> {
    if (providedKey !== this.apiKey) {
      throw new UnauthorizedException("Invalid API key");
    }
    const filename = file.originalname.replace(/\.map$/, "");
    await this.storage.uploadSourceMap(platform, version, filename, file.buffer);
    return { ok: true };
  }
}
