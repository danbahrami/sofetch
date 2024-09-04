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
        onClientError: CallbackStore<Callbacks["onClientError"]>;
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
        baseUrl: string | undefined;
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
            onClientError: callbackStore(options.callbacks?.onClientError),
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
            baseUrl: options.baseUrl,
        };
    };

    /**
     * Decorate the promise returned from a request method with some response body shortcut methods .
     * - await f.get().json()
     * - await f.get().text()
     * - await f.get().blob()
     * - await f.get().formData()
     * - await f.get().arrayBuffer()
     */
    const _decorateResponsePromise = (
        promise: Promise<DecoratedResponse>
    ): DecoratedResponsePromise => {
        const decoratedPromise = promise as DecoratedResponsePromise;

        decoratedPromise.json = async <T = unknown>() => {
            const response = await promise;
            return response.json<T>();
        };

        decoratedPromise.text = async () => {
            const response = await promise;
            return response.text();
        };

        decoratedPromise.blob = async () => {
            const response = await promise;
            return response.blob();
        };

        decoratedPromise.formData = async () => {
            const response = await promise;
            return response.formData();
        };

        decoratedPromise.arrayBuffer = async () => {
            const response = await promise;
            return response.arrayBuffer();
        };

        return decoratedPromise;
    };

    /**
     * `_createMethod()` is where all the complex stuff happens. It's what we
     * use to build the public methods: `.get()`, `.post()`, `.request()` etc.
     */
    const _createMethod = (getDefaultInit: () => RequestInit) => {
        return (info: RequestInfo | URL, init?: RequestInit & { json?: unknown }) => {
            const result = (async (): Promise<DecoratedResponse> => {
                try {
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

                    // Append the base URL
                    let requestInfo = info;

                    if (!(info instanceof Request)) {
                        try {
                            requestInfo = new URL(info, defaults.baseUrl);
                        } catch (e) {
                            throw new TypeError(`Could not build valid URL from parts:
                                baseUrl: "${defaults.baseUrl}"
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
                    const request = await modifiers.beforeRequest.reduce(
                        (acc, cb) => cb({ request: acc }),
                        new Request(requestInfo, combinedRequestInit)
                    );

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
                            await callbacks.onClientError.emit({
                                error,
                            });
                            throw error;
                        }
                    };

                    return decoratedResponse;
                } catch (e) {
                    if (e instanceof HttpError || e instanceof NetworkError) {
                        const error = await modifiers.beforeErrorResponse.reduce(
                            (acc, cb) => cb({ request: e.request, error: acc }),
                            e
                        );

                        await callbacks.onErrorResponse.emit({
                            request: e.request,
                            error,
                        });

                        throw error;
                    }

                    await callbacks.onClientError.emit({
                        error: e,
                    });

                    throw e;
                }
            })();

            return _decorateResponsePromise(result);
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
            onClientError: cb => callbacks.onClientError.register(cb),
        },

        modifiers: {
            beforeRequest: cb => modifiers.beforeRequest.register(cb),
            beforeSuccessResponse: cb => modifiers.beforeSuccessResponse.register(cb),
            beforeErrorResponse: cb => modifiers.beforeErrorResponse.register(cb),
        },
    };
};
