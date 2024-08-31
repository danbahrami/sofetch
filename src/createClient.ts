import { HttpError, JsonParseError, JsonStringifyError, NetworkError } from "@/errors";
import {
    Callbacks,
    CallbackStore,
    Client,
    ClientOptions,
    DecoratedResponse,
    DecoratedResponsePromise,
    Modifiers,
} from "@/types";
import { callbackStore, mergeHeaders } from "@/utils";

export const createClient = (options: ClientOptions = {}): Client => {
    /**
     * Setup our callback registry
     */
    let callbacks: {
        onRequestStart: CallbackStore<Callbacks["onRequestStart"]>;
        onSuccessResponse: CallbackStore<Callbacks["onSuccessResponse"]>;
        onErrorResponse: CallbackStore<Callbacks["onErrorResponse"]>;
        onJsonParseError: CallbackStore<Callbacks["onJsonParseError"]>;
        onJsonStringifyError: CallbackStore<Callbacks["onJsonStringifyError"]>;
    };

    /**
     * Setup our modifiers registry
     */
    let modifiers: {
        beforeRequest: CallbackStore<Modifiers["beforeRequest"]>;
        beforeSuccessResponse: CallbackStore<Modifiers["beforeSuccessResponse"]>;
        beforeErrorResponse: CallbackStore<Modifiers["beforeErrorResponse"]>;
    };

    /**
     * Setup out default per-method request inits
     */
    let defaults: {
        request: RequestInit;
        get: RequestInit;
        put: RequestInit;
        post: RequestInit;
        patch: RequestInit;
        delete: RequestInit;
        options: RequestInit;
        head: RequestInit;
    };

    /**
     * `_configure()` initialises all the per-method defaults, callbacks &
     * modifiers. It's called once internally to build the client with the
     * options provided to `createClient()` but is also exposed publically as
     * `client.configure()` so you can overwrite the client options at a later
     * point.
     */
    const _configure = (options: ClientOptions = {}) => {
        callbacks = {
            onRequestStart: callbackStore(options.callbacks?.onRequestStart),
            onSuccessResponse: callbackStore(options.callbacks?.onSuccessResponse),
            onErrorResponse: callbackStore(options.callbacks?.onErrorResponse),
            onJsonParseError: callbackStore(options.callbacks?.onJsonParseError),
            onJsonStringifyError: callbackStore(options.callbacks?.onJsonStringifyError),
        };

        modifiers = {
            beforeRequest: callbackStore(options.modifiers?.beforeRequest),
            beforeSuccessResponse: callbackStore(options.modifiers?.beforeSuccessResponse),
            beforeErrorResponse: callbackStore(options.modifiers?.beforeErrorResponse),
        };

        defaults = {
            request: { ...options.defaults?.request },
            get: { method: "GET", ...options.defaults?.get },
            put: { method: "PUT", ...options.defaults?.put },
            post: { method: "POST", ...options.defaults?.post },
            patch: { method: "PATCH", ...options.defaults?.patch },
            delete: { method: "DELETE", ...options.defaults?.delete },
            options: { method: "OPTIONS", ...options.defaults?.options },
            head: { method: "HEAD", ...options.defaults?.head },
        };
    };

    /**
     * `_createMethod()` is where all the complex stuff happens. It's what we
     * use to build the public methods: `.get()`, `.post()`, `.request()` etc.
     */
    const _createMethod = (getDefaultInit: () => RequestInit) => {
        return (info: RequestInfo, init?: RequestInit & { json?: unknown }) => {
            const result = (async (): Promise<DecoratedResponse> => {
                /**
                 * Combine the incoming RequestInit with the default RequestInit
                 * and set "content-type" header to "application/json" by
                 * default if JSON is passed as the request body.
                 */
                const { json, ...requestInit } = init ?? {};
                const defaultInit = getDefaultInit();
                const combinedRequestInit: RequestInit = {
                    ...defaultInit,
                    ...requestInit,
                    headers: mergeHeaders([
                        json ? { "content-type": "application/json" } : {},
                        defaultInit.headers,
                        requestInit.headers,
                    ]),
                };

                /**
                 * If JSON has been passed then stringify it. If the JSON cannot
                 * be serialized then throw JsonStringifyError and emit to the
                 * onJsonStringifyError callback
                 */
                if (json) {
                    try {
                        combinedRequestInit.body = JSON.stringify(json);
                    } catch (e) {
                        const error = new JsonStringifyError(
                            new Request(info, combinedRequestInit), // we don't have a Request instance yet but build one to attach to this error
                            json,
                            e
                        );
                        await callbacks.onJsonStringifyError.emit({
                            error,
                            request: error.request,
                        });
                        throw error;
                    }
                }

                /**
                 * Build the request by first combining all the request options
                 * and then passing it through any `beforeRequest` modifiers
                 */
                const request = await modifiers.beforeRequest.reduce(
                    (acc, cb) => cb({ request: acc }),
                    new Request(info, combinedRequestInit)
                );

                try {
                    /**
                     * Emit to the onRequestStart callback
                     */
                    await callbacks.onRequestStart.emit({ request });

                    /**
                     * Make the request
                     */
                    let baseResponse: Response;
                    try {
                        baseResponse = await fetch(request);
                    } catch (e) {
                        throw new NetworkError(request, e);
                    }

                    /**
                     * Form the final response by piping it through all
                     * beforeSuccessResponse modifiers
                     */
                    const response = await modifiers.beforeSuccessResponse.reduce(
                        (acc, cb) => cb({ request, response: acc }),
                        baseResponse
                    );

                    /**
                     * Convert non `2xx` responses into an HttpError
                     */
                    if (!response.ok) {
                        throw new HttpError(request, response.clone());
                    }

                    /**
                     * Emit 2xx responses and proceed
                     */
                    await callbacks.onSuccessResponse.emit({
                        request,
                        response: response.clone(),
                    });

                    /**
                     * Enhance the `.json()` method of the response so that it:
                     * 1. Accepts an optional generic type as the response
                     * 2. Emits to the onJsonParseError callback when the
                     *    response cannot be parsed to JSON. This allows us to
                     *    catch cases where the client is expecting JSON but the
                     *    server unexpectedly returns HTML.
                     */
                    const decoratedResponse = response.clone() as DecoratedResponse;
                    decoratedResponse.json = async <T = unknown>() => {
                        try {
                            return (await response.json()) as T;
                        } catch (e) {
                            const error = new JsonParseError(request, response, e);
                            await callbacks.onJsonParseError.emit({
                                request,
                                error,
                            });
                            throw error;
                        }
                    };

                    return decoratedResponse;
                } catch (e) {
                    /**
                     * Emit and rethrow HttpErrors
                     */
                    if (e instanceof HttpError || e instanceof NetworkError) {
                        const error = await modifiers.beforeErrorResponse.reduce(
                            (acc, cb) => cb({ request, error: acc }),
                            e
                        );

                        await callbacks.onErrorResponse.emit({
                            request,
                            error,
                        });

                        throw error;
                    }

                    throw e;
                }
            })() as DecoratedResponsePromise;

            /**
             * Decorate the response with a .json() method so you can call it
             * directly on the response promise.
             *
             * @example
             * const user = get("/api/user").json<User>();
             */
            result.json = async <T = unknown>() => {
                const response = await result;
                return await response.json<T>();
            };

            return result;
        };
    };

    /**
     * Setup the client with initial per-method defaults, callbacks & modifiers
     */
    _configure(options);

    return {
        configure: _configure,

        request: _createMethod(() => defaults.request),

        get: _createMethod(() => defaults.get),
        put: _createMethod(() => defaults.put),
        post: _createMethod(() => defaults.post),
        patch: _createMethod(() => defaults.patch),
        delete: _createMethod(() => defaults.delete),
        options: _createMethod(() => defaults.options),
        head: _createMethod(() => defaults.head),

        callbacks: {
            onRequestStart: cb => callbacks.onRequestStart.register(cb),
            onSuccessResponse: cb => callbacks.onSuccessResponse.register(cb),
            onErrorResponse: cb => callbacks.onErrorResponse.register(cb),
            onJsonParseError: cb => callbacks.onJsonParseError.register(cb),
            onJsonStringifyError: cb => callbacks.onJsonStringifyError.register(cb),
        },

        modifiers: {
            beforeRequest: cb => modifiers.beforeRequest.register(cb),
            beforeSuccessResponse: cb => modifiers.beforeSuccessResponse.register(cb),
            beforeErrorResponse: cb => modifiers.beforeErrorResponse.register(cb),
        },
    };
};
