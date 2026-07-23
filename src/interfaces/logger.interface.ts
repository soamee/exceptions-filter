export interface FilterLogger {
  error(context: string, message: string): void;
  warn(context: string, message: string): void;
  info(context: string, message: string): void;
  debug(context: string, message: string): void;
}
