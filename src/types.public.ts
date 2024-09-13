import { HttpError, NetworkError } from "./errors";

/**
 * Callbacks allow you to hook into requests, responses and errors. They're
 * useful for global behaviours e.g. logging
 */
export type Callbacks = {
    /**
     * onRequestStart - called before making a request
     */
    onRequestStart: (details: { request: Request }) => Promise<void> | void;

    /**
     * onSuccessResponse - called after a 2xx HTTP response
     */
    onSuccessResponse: (details: { request: Request; response: Response }) => Promise<void> | void;

    /**
     * onErrorResponse - called after a 4xx or 5xx HTTP response or a network
     * error
     */
    onErrorResponse: (details: {
        request: Request;
        error: HttpError | NetworkError;
    }) => Promise<void> | void;

    /**
     * onClientError - called when a client error happens inside the client.
     * Examples are:
     * - {JsonStringifyError} Invalid JSON is passed to a request
     * - {JsonParseError} `.json()` called on a non-JSON response
     * - {Error} an error thrown in a callback
     * - {Error} the author of this library messed up
     */
    onClientError: (details: { error: unknown }) => Promise<void> | void;
};

/**
 * This type enhances the default Response type so that you can pass a generic
 * return type to the `.json()` function.
 *
 * @example
 *
 * ```ts
 * f.get(url).then(respone => response.json<User>());
 * ```
 */
export type DecoratedResponse = Omit<Response, "json"> & {
    json: <T = unknown>() => Promise<T>;
};

/**
 * When you make a request, the promise that's returned has some additional
 * methods bound to it which act as shortcuts for deserializing the reponse
 * body.
 *
 * So instead of manually accessing response JSON like so:
 *
 * ```
 * const user = await f.get(url).then(r => r.json<User>());
 * ```
 *
 * You can do it straight on the response promise like so:
 *
 * ```
 * const user = await f.get(url).json<User>();
 * ```
 */
export type DecoratedResponsePromise = Omit<Promise<DecoratedResponse>, "json"> & {
    json: <T = unknown>() => Promise<T>;
    text: () => Promise<string>;
    blob: () => Promise<Blob>;
    formData: () => Promise<FormData>;
    arrayBuffer: () => Promise<ArrayBuffer>;
};

export type SoFetchClientOptions = {
    defaults?: {
        get?: Omit<RequestInit, "method"> | (() => Omit<RequestInit, "method">);
        put?: Omit<RequestInit, "method"> | (() => Omit<RequestInit, "method">);
        post?: Omit<RequestInit, "method"> | (() => Omit<RequestInit, "method">);
        patch?: Omit<RequestInit, "method"> | (() => Omit<RequestInit, "method">);
        delete?: Omit<RequestInit, "method"> | (() => Omit<RequestInit, "method">);
        options?: Omit<RequestInit, "method"> | (() => Omit<RequestInit, "method">);
        head?: Omit<RequestInit, "method"> | (() => Omit<RequestInit, "method">);
        common?: Omit<RequestInit, "method"> | (() => Omit<RequestInit, "method">);
    };
    callbacks?: {
        onRequestStart?: Callbacks["onRequestStart"][];
        onSuccessResponse?: Callbacks["onSuccessResponse"][];
        onErrorResponse?: Callbacks["onErrorResponse"][];
        onClientError?: Callbacks["onClientError"][];
    };
    baseUrl?: string;
};

export type SoFetchClient = {
    /**
     * Perform an HTTP request using any HTTP method (defaults to GET)
     */
    request: (
        input: RequestInfo | URL,
        init?: RequestInit & { json?: unknown }
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP GET request
     */
    get: (
        input: RequestInfo | URL,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP PUT request
     */
    put: (
        input: RequestInfo | URL,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP POST request
     */
    post: (
        input: RequestInfo | URL,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP PATCH request
     */
    patch: (
        input: RequestInfo | URL,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP DELETE request
     */
    delete: (
        input: RequestInfo | URL,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP OPTIONS request
     */
    options: (
        input: RequestInfo | URL,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP HEAD request
     */
    head: (
        input: RequestInfo | URL,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    callbacks: {
        onRequestStart: (cb: Callbacks["onRequestStart"]) => () => void;
        onSuccessResponse: (cb: Callbacks["onSuccessResponse"]) => () => void;
        onErrorResponse: (cb: Callbacks["onErrorResponse"]) => () => void;
        onClientError: (cb: Callbacks["onClientError"]) => () => void;
    };

    configure: (options?: SoFetchClientOptions) => void;
};
