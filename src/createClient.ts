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
    SoFetchRequestInit,
} from "@/types";
import { callbackStore, combineInits } from "@/utils";

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

    const _createMethod = (methodInit: RequestInit) => {
        return (info: RequestInfo, init: SoFetchRequestInit = {}) => {
            const result = (async (): Promise<DecoratedResponse> => {
                /**
                 * Combine the incoming RequestInit with the default RequestInit
                 * and set "content-type" header to "application/json" by
                 * default if JSON is passed as the request body.
                 */
                const { json, ...requestInit } = init;
                const combinedRequestInit = combineInits([
                    json
                        ? { headers: { "content-type": "application/json" } }
                        : {},
                    methodInit,
                    requestInit,
                ]);

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
                 * Build the request
                 */
                const request = new Request(info, combinedRequestInit);

                try {
                    /**
                     * Emit to the onRequestStart callback
                     */
                    await callbacks.onRequestStart.emit({ request });

                    /**
                     * Make the request
                     */
                    const response = await fetch(request);

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
                    if (e instanceof HttpError) {
                        await callbacks.onErrorResponse.emit({
                            request,
                            error: e,
                        });
                        throw e;
                    }

                    /**
                     * Convert all other errors into a NetworkError, emit and throw
                     */
                    const error = new NetworkError(request, e);
                    await callbacks.onErrorResponse.emit({ request, error });
                    throw error;
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
    };
};
