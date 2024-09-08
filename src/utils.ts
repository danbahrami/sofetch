import {
    CallbackStore,
    RequestInitArg,
    Reduce,
    DecoratedResponsePromise,
    DecoratedResponse,
} from "@/types";

/**
 * Headers can be passed to a request in several formats. This utility combines
 * multiple headers, in any valid format, and returns a single Headers instance.
 */
export const mergeHeaders = (inits: (HeadersInit | undefined)[]): Headers => {
    const result: Record<string, string> = {};

    for (const init of inits) {
        if (!init) continue;

        new Headers(init).forEach((value, key) => {
            result[key] = value;
        });
    }

    return new Headers(result);
};

export const mergeInits = (...initArgs: RequestInitArg[]): RequestInit => {
    let result: RequestInit = {};
    const headers: HeadersInit[] = [];

    for (const initArg of initArgs) {
        const init = typeof initArg === "function" ? initArg() : initArg;

        if (!init) continue;

        if (init.headers) {
            headers.push(init.headers);
        }

        result = { ...result, ...init };
    }

    return {
        ...result,
        headers: mergeHeaders(headers),
    };
};

/**
 * Provides mechanism for adding/removing callbacks and then emitting data to
 * all callbacks
 */
export const callbackStore = <
    TFn extends (...arg: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
>(
    initial?: TFn[]
): CallbackStore<TFn> => {
    const store = new Set<TFn>(initial);

    return {
        register: cb => {
            store.add(cb);
            return () => store.delete(cb);
        },
        emit: async (...args) => {
            for (const cb of store) {
                await cb(...args);
            }
        },
        reduce: (async (reducer, initialValue) => {
            let result = await initialValue;

            for (const cb of store) {
                result = (await reducer(result, cb)) || result;
            }

            return result;
        }) as Reduce<TFn>,
    };
};

/**
 * Decorate the promise returned from a request method with some response body
 * shortcut methods.
 * - await f.get().json()
 * - await f.get().text()
 * - await f.get().blob()
 * - await f.get().formData()
 * - await f.get().arrayBuffer()
 */
export const decorateResponsePromise = (
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
