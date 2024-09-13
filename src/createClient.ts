import { HttpError, JsonParseError, JsonStringifyError, NetworkError } from "@/errors";
import { SoFetchClient, SoFetchClientOptions, DecoratedResponse } from "@/types.public";
import { CreateMethod, InitDefault } from "@/types.internal";
import { callbackStore, decorateResponsePromise, mergeInits } from "@/utils";

export const createClient = (options: SoFetchClientOptions = {}): SoFetchClient => {
    let config = {
        baseUrl: options.baseUrl,
        callbacks: {
            onRequestStart: callbackStore(options.callbacks?.onRequestStart),
            onSuccessResponse: callbackStore(options.callbacks?.onSuccessResponse),
            onErrorResponse: callbackStore(options.callbacks?.onErrorResponse),
            onClientError: callbackStore(options.callbacks?.onClientError),
        },
        defaults: {
            common: new Array<InitDefault>(options.defaults?.common),
            get: new Array<InitDefault>({ method: "GET" }, options.defaults?.get),
            put: new Array<InitDefault>({ method: "PUT" }, options.defaults?.put),
            post: new Array<InitDefault>({ method: "POST" }, options.defaults?.post),
            patch: new Array<InitDefault>({ method: "PATCH" }, options.defaults?.patch),
            delete: new Array<InitDefault>({ method: "DELETE" }, options.defaults?.delete),
            options: new Array<InitDefault>({ method: "OPTIONS" }, options.defaults?.options),
            head: new Array<InitDefault>({ method: "HEAD" }, options.defaults?.head),
        },
    };

    /**
     * `createMethod()` is where all the complex stuff happens. It's what we
     * use to build the public methods: `.get()`, `.post()`, `.request()` etc.
     */
    const createMethod: CreateMethod = getDefaultInit => (info, init) => {
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
                    ...config.defaults.common,
                    ...getDefaultInit(info, init),
                    requestInit
                );

                // Append the base URL
                let requestInfo = info;

                if (!(info instanceof Request)) {
                    try {
                        requestInfo = new URL(info, config.baseUrl);
                    } catch (e) {
                        throw new TypeError(`Could not build valid URL from parts:
                            baseUrl: "${config.baseUrl}"
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
                            // we don't have a Request instance yet but build
                            // one to attach to this error
                            new Request(requestInfo, combinedRequestInit),
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
                await config.callbacks.onRequestStart.emit({ request });

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
                await config.callbacks.onSuccessResponse.emit({
                    request,
                    response: response.clone(),
                });

                /**
                 * Enhance the `.json()` method of the response so that it:
                 * 1. Accepts an optional generic type as the response
                 * 2. Emits to the onJsonParseError callback when the response
                 *    cannot be parsed to JSON. This allows us to catch cases
                 *    where the client is expecting JSON but the server
                 *    unexpectedly returns HTML.
                 */
                const decoratedResponse = response.clone() as DecoratedResponse;
                decoratedResponse.json = async <T = unknown>() => {
                    try {
                        return (await response.json()) as T;
                    } catch (e) {
                        const error = new JsonParseError(request, response, e);
                        await config.callbacks.onClientError.emit({
                            error,
                        });
                        throw error;
                    }
                };

                return decoratedResponse;
            } catch (error) {
                if (error instanceof HttpError || error instanceof NetworkError) {
                    await config.callbacks.onErrorResponse.emit({
                        request: error.request,
                        error,
                    });
                } else {
                    await config.callbacks.onClientError.emit({ error });
                }

                throw error;
            }
        })();

        return decorateResponsePromise(result);
    };

    return {
        get: createMethod(() => config.defaults.get),
        put: createMethod(() => config.defaults.put),
        post: createMethod(() => config.defaults.post),
        patch: createMethod(() => config.defaults.patch),
        delete: createMethod(() => config.defaults.delete),
        options: createMethod(() => config.defaults.options),
        head: createMethod(() => config.defaults.head),

        /**
         * The request method lets you pass in any HTTP method but defaults to a
         * GET request. Default config will be applied based on the method used.
         */
        request: createMethod((info, init) => {
            let method = "get";

            if (info instanceof Request) {
                method = info.method.toLowerCase();
            } else if (init?.method) {
                method = init.method.toLowerCase();
            }

            if (method in config.defaults) {
                return config.defaults[method as keyof typeof config.defaults];
            } else {
                return [];
            }
        }),

        callbacks: {
            onRequestStart: cb => config.callbacks.onRequestStart.register(cb),
            onSuccessResponse: cb => config.callbacks.onSuccessResponse.register(cb),
            onErrorResponse: cb => config.callbacks.onErrorResponse.register(cb),
            onClientError: cb => config.callbacks.onClientError.register(cb),
        },

        configure: (options = {}) => {
            config = {
                baseUrl: options.baseUrl,
                callbacks: {
                    onRequestStart: callbackStore(options.callbacks?.onRequestStart),
                    onSuccessResponse: callbackStore(options.callbacks?.onSuccessResponse),
                    onErrorResponse: callbackStore(options.callbacks?.onErrorResponse),
                    onClientError: callbackStore(options.callbacks?.onClientError),
                },
                defaults: {
                    common: [options.defaults?.common],
                    get: [{ method: "GET" }, options.defaults?.get],
                    put: [{ method: "PUT" }, options.defaults?.put],
                    post: [{ method: "POST" }, options.defaults?.post],
                    patch: [{ method: "PATCH" }, options.defaults?.patch],
                    delete: [{ method: "DELETE" }, options.defaults?.delete],
                    options: [{ method: "OPTIONS" }, options.defaults?.options],
                    head: [{ method: "HEAD" }, options.defaults?.head],
                },
            };
        },
    };
};
