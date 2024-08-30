import {
    HttpError,
    JsonParseError,
    JsonStringifyError,
    NetworkError,
} from "@/errors";
import {
    Callbacks,
    Client,
    ClientOptions,
    DecoratedResponse,
    DecoratedResponsePromise,
    Modifiers,
    SoFetchRequestInit,
} from "@/types";
import { callbackStore, mergeHeaders } from "@/utils";

export const createClient = (options: ClientOptions = {}): Client => {
    /**
     * Setup our callback registry
     */
    const callbacks = {
        onRequestStart: callbackStore<Callbacks["onRequestStart"]>(
            options.callbacks?.onRequestStart
        ),
        onSuccessResponse: callbackStore<Callbacks["onSuccessResponse"]>(
            options.callbacks?.onSuccessResponse
        ),
        onErrorResponse: callbackStore<Callbacks["onErrorResponse"]>(
            options.callbacks?.onErrorResponse
        ),
        onJsonParseError: callbackStore<Callbacks["onJsonParseError"]>(
            options.callbacks?.onJsonParseError
        ),
        onJsonStringifyError: callbackStore<Callbacks["onJsonStringifyError"]>(
            options.callbacks?.onJsonStringifyError
        ),
    };

    /**
     * Setup our modifiers registry
     */
    const modifiers = {
        beforeRequest: callbackStore<Modifiers["beforeRequest"]>(
            options.modifiers?.beforeRequest
        ),
        beforeSuccessResponse: callbackStore<
            Modifiers["beforeSuccessResponse"]
        >(options.modifiers?.beforeSuccessResponse),
        beforeErrorResponse: callbackStore<Modifiers["beforeErrorResponse"]>(
            options.modifiers?.beforeErrorResponse
        ),
    };

    const _createMethod = (methodInit: RequestInit) => {
        return (info: RequestInfo, init: SoFetchRequestInit = {}) => {
            const result = (async (): Promise<DecoratedResponse> => {
                /**
                 * Combine the incoming RequestInit with the default RequestInit
                 * and set "content-type" header to "application/json" by
                 * default if JSON is passed as the request body.
                 */
                const { json, ...requestInit } = init;
                const combinedRequestInit: RequestInit = {
                    ...methodInit,
                    ...requestInit,
                    headers: mergeHeaders([
                        json ? { "content-type": "application/json" } : {},
                        methodInit.headers,
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
                    const response =
                        await modifiers.beforeSuccessResponse.reduce(
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
                    const decoratedResponse =
                        response.clone() as DecoratedResponse;
                    decoratedResponse.json = async <T = unknown>() => {
                        try {
                            return (await response.json()) as T;
                        } catch (e) {
                            const error = new JsonParseError(
                                request,
                                response,
                                e
                            );
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
                        const error =
                            await modifiers.beforeErrorResponse.reduce(
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

    return {
        get: _createMethod({
            method: "GET",
            ...options.defaults?.get,
        }),

        post: _createMethod({
            method: "POST",
            ...options.defaults?.post,
        }),

        put: _createMethod({
            method: "PUT",
            ...options.defaults?.put,
        }),

        patch: _createMethod({
            method: "PATCH",
            ...options.defaults?.patch,
        }),

        delete: _createMethod({
            method: "DELETE",
            ...options.defaults?.delete,
        }),

        options: _createMethod({
            method: "OPTIONS",
            ...options.defaults?.options,
        }),

        head: _createMethod({
            method: "HEAD",
            ...options.defaults?.options,
        }),

        callbacks: {
            onRequestStart: cb => callbacks.onRequestStart.register(cb),
            onSuccessResponse: cb => callbacks.onSuccessResponse.register(cb),
            onErrorResponse: cb => callbacks.onErrorResponse.register(cb),
            onJsonParseError: cb => callbacks.onJsonParseError.register(cb),
            onJsonStringifyError: cb =>
                callbacks.onJsonStringifyError.register(cb),
        },

        modifiers: {
            beforeRequest: cb => modifiers.beforeRequest.register(cb),
            beforeSuccessResponse: cb =>
                modifiers.beforeSuccessResponse.register(cb),
            beforeErrorResponse: cb =>
                modifiers.beforeErrorResponse.register(cb),
        },
    };
};
