import { DecoratedResponsePromise, DecoratedResponse } from "@/types.public";
import { CallbackStore, InitDefault } from "@/types.internal";

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

/**
 * In the client we pass around request init values in various different
 * formats:
 * - A single RequestInit object
 * - A function that returns a RequestInit
 * - undefined because these things are optional
 * - An array of all of the above
 *
 * This utility type lets us resolve all of those down into a single RequestInit
 * object.
 */
export const mergeInits = (...initArgs: InitDefault[]): RequestInit => {
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
 * A callback store is a mechanism for adding/removing callbacks and then
 * emitting events to those callbacks.
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
        emit: async arg => {
            for (const cb of store) {
                await cb(arg);
            }
        },
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
