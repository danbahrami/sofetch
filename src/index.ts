import { createClient } from "@/createClient";

export { HttpError, NetworkError, JsonParseError, JsonStringifyError } from "@/errors";
export type * from "@/types.public";
export { createClient } from "@/createClient";

/**
 * `f` is a sofetch client instance with default configuration. To configure the
 * client call `f.configure(options)` or create a new pre-configured client with
 * `createClient(options)`.
 */
export const f = createClient();
