import {
    HttpError,
    JsonParseError,
    JsonStringifyError,
    NetworkError,
} from "./errors";

export type Callbacks = {
    onRequestStart: (details: { request: Request }) => Promise<void> | void;
    onSuccessResponse: (details: {
        request: Request;
        response: Response;
    }) => Promise<void> | void;
    onErrorResponse: (details: {
        request: Request;
        error: HttpError | NetworkError | Error;
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

export type Modifiers = {
    beforeRequest: (details: {
        request: Request;
    }) => Promise<Request> | Promise<void> | Request | void;
    beforeSuccessResponse: (details: {
        request: Request;
        response: Response;
    }) => Promise<Response> | Promise<void> | Response | void;
    beforeErrorResponse: (details: {
        request: Request;
        error: Error;
    }) => Promise<Error> | Promise<void> | Error | void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Subscription<T extends (arg: any) => any> = (arg: T) => () => void;

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
     * Perform an HTTP request using any HTTP method (defaults to GET)
     */
    request: (
        input: RequestInfo,
        init?: RequestInit & { json?: unknown }
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP GET request
     */
    get: (
        input: RequestInfo,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP PUT request
     */
    put: (
        input: RequestInfo,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP POST request
     */
    post: (
        input: RequestInfo,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP PATCH request
     */
    patch: (
        input: RequestInfo,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP DELETE request
     */
    delete: (
        input: RequestInfo,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP OPTIONS request
     */
    options: (
        input: RequestInfo,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP HEAD request
     */
    head: (
        input: RequestInfo,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    callbacks: {
        onRequestStart: Subscription<Callbacks["onRequestStart"]>;
        onSuccessResponse: Subscription<Callbacks["onSuccessResponse"]>;
        onErrorResponse: Subscription<Callbacks["onErrorResponse"]>;
        onJsonParseError: Subscription<Callbacks["onJsonParseError"]>;
        onJsonStringifyError: Subscription<Callbacks["onJsonStringifyError"]>;
    };

    modifiers: {
        beforeRequest: Subscription<Modifiers["beforeRequest"]>;
        beforeSuccessResponse: Subscription<Modifiers["beforeSuccessResponse"]>;
        beforeErrorResponse: Subscription<Modifiers["beforeErrorResponse"]>;
    };
};

export type ClientOptions = {
    defaults?: {
        request: RequestInit;
        get: Omit<RequestInit, "method">;
        put: Omit<RequestInit, "method">;
        post: Omit<RequestInit, "method">;
        patch: Omit<RequestInit, "method">;
        delete: Omit<RequestInit, "method">;
        options: Omit<RequestInit, "method">;
        head: Omit<RequestInit, "method">;
    };
    callbacks?: {
        onRequestStart?: Callbacks["onRequestStart"];
        onSuccessResponse?: Callbacks["onSuccessResponse"];
        onErrorResponse?: Callbacks["onErrorResponse"];
        onJsonParseError?: Callbacks["onJsonParseError"];
        onJsonStringifyError?: Callbacks["onJsonStringifyError"];
    };
    modifiers?: {
        beforeRequest?: Modifiers["beforeRequest"];
        beforeSuccessResponse?: Modifiers["beforeSuccessResponse"];
        beforeErrorResponse?: Modifiers["beforeErrorResponse"];
    };
};
