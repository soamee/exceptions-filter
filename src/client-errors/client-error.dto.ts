import { IsString, IsOptional, IsIn, IsArray, MaxLength } from "class-validator";

export class ClientErrorDto {
  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  stack?: string;

  @IsIn(["web", "ios", "android"])
  platform!: "web" | "ios" | "android";

  @IsString()
  @MaxLength(100)
  appVersion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  screen?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lastActions?: string[];

  @IsOptional()
  metadata?: Record<string, unknown>;
}
