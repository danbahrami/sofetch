import { HttpError, JsonParseError, JsonStringifyError, NetworkError } from "@/errors";
import { Client, ClientOptions, DecoratedResponse, RequestInitArg } from "@/types";
import { callbackStore, decorateResponsePromise, mergeInits } from "@/utils";

export const createClient = (options: ClientOptions = {}): Client => {
    /**
     * Setup our callback registry
     */
    let callbacks = {
        onRequestStart: callbackStore(options.callbacks?.onRequestStart),
        onSuccessResponse: callbackStore(options.callbacks?.onSuccessResponse),
        onErrorResponse: callbackStore(options.callbacks?.onErrorResponse),
        onClientError: callbackStore(options.callbacks?.onClientError),
    };

    /**
     * Setup out default per-method request inits
     */
    let defaults = {
        common: new Array<RequestInitArg>(options.defaults?.common),
        request: new Array<RequestInitArg>(options.defaults?.request),
        get: new Array<RequestInitArg>({ method: "GET" }, options.defaults?.get),
        put: new Array<RequestInitArg>({ method: "PUT" }, options.defaults?.put),
        post: new Array<RequestInitArg>({ method: "POST" }, options.defaults?.post),
        patch: new Array<RequestInitArg>({ method: "PATCH" }, options.defaults?.patch),
        delete: new Array<RequestInitArg>({ method: "DELETE" }, options.defaults?.delete),
        options: new Array<RequestInitArg>({ method: "OPTIONS" }, options.defaults?.options),
        head: new Array<RequestInitArg>({ method: "HEAD" }, options.defaults?.head),
    };

    let baseUrl = options.baseUrl;

    /**
     * `_createMethod()` is where all the complex stuff happens. It's what we
     * use to build the public methods: `.get()`, `.post()`, `.request()` etc.
     */
    const _createMethod = (getDefaultInit: () => RequestInitArg[]) => {
        return (info: RequestInfo | URL, init?: RequestInit & { json?: unknown }) => {
            const result = (async (): Promise<DecoratedResponse> => {
                try {
                    /**
                     * Combine the incoming RequestInit with the default RequestInit
                     * and set "content-type" header to "application/json" by
                     * default if JSON is passed as the request body.
                     */
                    const { json, ...requestInit } = init ?? {};
                    const combinedRequestInit = mergeInits(
                        json ? { headers: { "content-type": "application/json" } } : undefined,
                        ...defaults.common,
                        ...getDefaultInit(),
                        requestInit
                    );

                    // Append the base URL
                    let requestInfo = info;

                    if (!(info instanceof Request)) {
                        try {
                            requestInfo = new URL(info, baseUrl);
                        } catch (e) {
                            throw new TypeError(`Could not build valid URL from parts:
                                baseUrl: "${baseUrl}"
                                path: "${info}"
                            `);
                        }
                    }

                    /**
                     * If JSON has been passed then stringify it. If the JSON cannot
                     * be serialized then throw JsonStringifyError and emit to the
                     * onJsonStringifyError callback
                     */
                    if (json) {
                        try {
                            combinedRequestInit.body = JSON.stringify(json);
                        } catch (e) {
                            throw new JsonStringifyError(
                                new Request(requestInfo, combinedRequestInit), // we don't have a Request instance yet but build one to attach to this error
                                json,
                                e
                            );
                        }
                    }

                    /**
                     * Build the request by first combining all the request options
                     * and then passing it through any `beforeRequest` modifiers
                     */
                    const request = new Request(requestInfo, combinedRequestInit);

                    /**
                     * Emit to the onRequestStart callback
                     */
                    await callbacks.onRequestStart.emit({ request });

                    /**
                     * Make the request
                     */
                    let response: Response;
                    try {
                        response = await fetch(request);
                    } catch (e) {
                        throw new NetworkError(request, e);
                    }

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
                            await callbacks.onClientError.emit({
                                error,
                            });
                            throw error;
                        }
                    };

                    return decoratedResponse;
                } catch (error) {
                    if (error instanceof HttpError || error instanceof NetworkError) {
                        await callbacks.onErrorResponse.emit({
                            request: error.request,
                            error,
                        });

                        throw error;
                    }

                    await callbacks.onClientError.emit({ error });

                    throw error;
                }
            })();

            return decorateResponsePromise(result);
        };
    };

    return {
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
            onClientError: cb => callbacks.onClientError.register(cb),
        },

        configure: (options: ClientOptions = {}) => {
            callbacks = {
                onRequestStart: callbackStore(options.callbacks?.onRequestStart),
                onSuccessResponse: callbackStore(options.callbacks?.onSuccessResponse),
                onErrorResponse: callbackStore(options.callbacks?.onErrorResponse),
                onClientError: callbackStore(options.callbacks?.onClientError),
            };

            defaults = {
                common: [options.defaults?.common],
                request: [options.defaults?.request],
                get: [{ method: "GET" }, options.defaults?.get],
                put: [{ method: "PUT" }, options.defaults?.put],
                post: [{ method: "POST" }, options.defaults?.post],
                patch: [{ method: "PATCH" }, options.defaults?.patch],
                delete: [{ method: "DELETE" }, options.defaults?.delete],
                options: [{ method: "OPTIONS" }, options.defaults?.options],
                head: [{ method: "HEAD" }, options.defaults?.head],
            };

            baseUrl = options.baseUrl;
        },
    };
};
