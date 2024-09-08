import { createClient } from "@/createClient";

export { createClient } from "@/createClient";
export const f = createClient();

export { HttpError, NetworkError, JsonParseError, JsonStringifyError } from "@/errors";
export type {
    SoFetchClient,
    SoFetchClientOptions,
    DecoratedResponse,
    DecoratedResponsePromise,
    Callbacks,
} from "@/types";
