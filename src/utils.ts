import { CallbackStore, Reduce } from "@/types";

/**
 * Headers can be passed to a request in several formats. This utility combines
 * multiple headers, in any valid format, and returns a single Headers instance.
 */
export const mergeHeaders = (inits: (HeadersInit | undefined)[]): Headers => {
    const result: Record<string, string> = {};

    for (const init of inits) {
        new Headers(init).forEach((value, key) => {
            result[key] = value;
        });
    }

    return new Headers(result);
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
