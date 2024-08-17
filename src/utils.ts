/**
 * Takes an array of RequestInit objects and combines them together. The
 * top-level attributes of the init object are combined and the headers of each
 * init are combined. In all cases inits that come later in the array take
 * override those that came before.
 */
export const combineInits = (inits: RequestInit[]) => {
    return inits.reduce<RequestInit>((combined, next) => {
        return {
            ...combined,
            ...next,
            headers: {
                ...combined.headers,
                ...next.headers,
            },
        };
    }, {});
};

/**
 * Provides mechanism for adding/removing callbacks and then emitting data to
 * all callbacks
 */
export const callbackStore = <
    TFn extends (arg: any) => Promise<void> | void, // eslint-disable-line @typescript-eslint/no-explicit-any
>() => {
    const store = new Set<TFn>();

    return {
        register: (cb: TFn) => {
            store.add(cb);
            return () => store.delete(cb);
        },
        emit: async (value: Parameters<TFn>[0]) => {
            for (const cb of store) {
                await cb(value);
            }
        },
    };
};
