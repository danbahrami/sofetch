import {
    HttpError,
    JsonParseError,
    JsonStringifyError,
    NetworkError,
} from "./errors";

export type SoFetchRequestInit = Omit<RequestInit, "headers" | "method"> & {
    headers?: Record<string, string>;
    json?: unknown;
};

export type MethodDefault = Omit<RequestInit, "headers" | "method"> & {
    headers?: Record<string, string>;
};

export type Callbacks = {
    onRequestStart: (details: { request: Request }) => Promise<void> | void;
    onSuccessResponse: (details: {
        request: Request;
        response: Response;
    }) => Promise<void> | void;
    onErrorResponse: (details: {
        request: Request;
        error: HttpError | NetworkError;
    }) => Promise<void> | void;
    onJsonParseError: (details: {
        request: Request;
        error: JsonParseError;
    }) => Promise<void> | void;
    onJsonStringifyError: (details: {
        request: Request;
        error: JsonStringifyError;
    }) => Promise<void> | void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Subscription<T extends (arg: any) => Promise<void> | void> = (
    arg: T
) => () => void;

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
 * This type enhances the promise that's returned from client methods so that
 * you can call `.json()` on it immediately without having to do it inside
 * `.then()`
 *
 * @example
 *
 *```ts
 *f.get(url).json<User>();
 *```
 */
export type DecoratedResponsePromise = Omit<
    Promise<DecoratedResponse>,
    "json"
> & {
    json: <T = unknown>() => Promise<T>;
};

export type Client = {
    /**
     * Perform a HTTP GET request
     */
    get: (
        input: RequestInfo,
        init?: SoFetchRequestInit
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP PUT request
     */
    put: (
        input: RequestInfo,
        init?: SoFetchRequestInit
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP POST request
     */
    post: (
        input: RequestInfo,
        init?: SoFetchRequestInit
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP PATCH request
     */
    patch: (
        input: RequestInfo,
        init?: SoFetchRequestInit
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP DELETE request
     */
    delete: (
        input: RequestInfo,
        init?: SoFetchRequestInit
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP OPTTIONS request
     */
    options: (
        input: RequestInfo,
        init?: SoFetchRequestInit
    ) => DecoratedResponsePromise;

    callbacks: {
        onRequestStart: Subscription<Callbacks["onRequestStart"]>;
        onSuccessResponse: Subscription<Callbacks["onSuccessResponse"]>;
        onErrorResponse: Subscription<Callbacks["onErrorResponse"]>;
        onJsonParseError: Subscription<Callbacks["onJsonParseError"]>;
        onJsonStringifyError: Subscription<Callbacks["onJsonStringifyError"]>;
    };
};

export type ClientOptions = {
    defaults?: {
        get: MethodDefault;
        put: MethodDefault;
        post: MethodDefault;
        patch: MethodDefault;
        delete: MethodDefault;
        options: MethodDefault;
    };
    callbacks?: {
        onRequestStart?: Callbacks["onRequestStart"];
        onSuccessResponse?: Callbacks["onSuccessResponse"];
        onErrorResponse?: Callbacks["onErrorResponse"];
        onJsonParseError?: Callbacks["onJsonParseError"];
        onJsonStringifyError?: Callbacks["onJsonStringifyError"];
    };
};
