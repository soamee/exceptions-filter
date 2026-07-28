export { ErrorReporter } from "./reporter";
export { initErrorReporter as initWebErrorReporter, reportError as reportWebError } from "./web";
export { createErrorBoundary, setSharedReporter, useErrorReporter } from "./react";
export {
  initErrorReporter as initRNErrorReporter,
  reportError as reportRNError,
  setCurrentScreen,
} from "./react-native";
