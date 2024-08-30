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

// a little helper type that helps us infer a return type from a function that
// mar or may not be async.
type MaybePromise<T> = Promise<T> | T;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reduce<TFn> = TFn extends (arg: any) => MaybePromise<void | infer U>
    ? (
          reducer: (accumulator: U, callback: TFn) => MaybePromise<U | void>,
          initialValue: U
      ) => U
    : never;

/**
 * Provides mechanism for adding/removing callbacks and then emitting data to
 * all callbacks
 */
export const callbackStore = <
    TFn extends (arg: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
>(
    initial?: TFn
) => {
    const store = new Set<TFn>(initial ? [initial] : undefined);

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
        reduce: (async (reducer, initialValue) => {
            let result = await initialValue;

            for (const cb of store) {
                result = (await reducer(result, cb)) || result;
            }

            return result;
        }) as Reduce<TFn>,
    };
};
