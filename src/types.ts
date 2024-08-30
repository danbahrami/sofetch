import { JsonParseError, JsonStringifyError } from "./errors";

export type SoFetchRequestInit = Omit<RequestInit, "method"> & {
    json?: unknown;
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

export type Modifiers = {
    beforeRequest: (details: {
        request: Request;
    }) => Promise<Request> | Promise<void> | Request | void;
    beforeSuccessResponse: (details: {
        request: Request;
        response: Response;
    }) => Promise<Response> | Promise<void> | Response | void;
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
     * Perform a HTTP OPTIONS request
     */
    options: (
        input: RequestInfo,
        init?: SoFetchRequestInit
    ) => DecoratedResponsePromise;

    /**
     * Perform a HTTP HEAD request
     */
    head: (
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

    modifiers: {
        beforeRequest: Subscription<Modifiers["beforeRequest"]>;
        beforeSuccessResponse: Subscription<Modifiers["beforeSuccessResponse"]>;
    };
};

export type ClientOptions = {
    defaults?: {
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
    };
};
