import { DecoratedResponsePromise } from "@/types.public";

/**
 * You can define the default request in it for a method as either a RequestInit
 * object or a function which returns a RequestInit object. This utility type
 * helps us pass around a value that is either one of those, or undefined.
 */
export type InitDefault = RequestInit | (() => RequestInit) | (() => undefined) | undefined;

/**
 * createMethod is an internal function for creating the request methods on the
 * public client - e.g. f.request(), f.get(), f.options()
 *
 * Define the type separately here to make the client code more succinct.
 */
export type CreateMethod = (
    getDefaultInit: (info: RequestInfo | URL, init?: RequestInit) => InitDefault[]
) => (info: RequestInfo | URL, init?: RequestInit & { json?: unknown }) => DecoratedResponsePromise;

/**
 * A callback store is a mechanism for adding/removing callbacks and then
 * emitting events to those callbacks.
 */
export type CallbackStore<
    TFn extends (...arg: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
> = {
    register: (cb: TFn) => () => void;
    emit: (...args: Parameters<TFn>) => Promise<void>;
};
