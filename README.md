# SoFetch

> 💡 This is a personal project. It's heavily inspired by `ky` but has a more functional approach, does a bit less "magic" with the request and has a few improvements to its hooks system and error handling.

Sofetch is a simple and elegant fetch client.

Key features:

-   Adds nice syntax "sugar" over `fetch()`
-   Throws errors on 4xx & 5xx HTTP responses
-   Configurable default request properties
-   Callbacks for hooking into requests globally
-   Built with and for TypeScript

## Installation

```
# NPM
npm install @danbahrami/sofetch

# Yarn
yarn add @danbahrami/sofetch
```

## Basic usage

```ts
import { f } from "@danbahrami/sofetch";

// Make a GET request and type the response as a `User`
const user = await f.get("https://example.com/api/user").json<User>();

// Make a POST request, send some JSON and type the response as a `PasswordResetResult`
const result = await f
    .post("https://example.com/api/password-reset", { json: { password: "monkey-123" } })
    .json<PasswordResetResult>();
```

## Making requests

`SoFetch` offers shortcuts for the following HTTP Methods:

-   `f.get()` sends a `GET` request
-   `f.put()` sends a `PUT` request
-   `f.post()` sends a `POST` request
-   `f.patch()` sends a `PATCH` request
-   `f.delete()` sends a `DELETE` request
-   `f.options()` sends an `OPTIONS` request
-   `f.head()` sends an `HEAD` request

```ts
f.get("https://example.com/api/user");
```

Additionally there is `f.request()` which you can pass a method to. If no method is given it will default to `GET`.

```ts
f.request("https://example.com/api/user", { method: "delete" });
```

## Sending JSON

You can send JSON with any request (as long as the method supports it) like this:

```ts
f.post("/api/user", {
    json: {
        username: "admin",
        password: "password",
    },
});
```

The data you pass will be converted to a string with `JSON.stringify()` and sent as the request body.

> 💡 When you send JSON like this the `content-type` header will automatically be set to `application/json` unless you manually override it in the request options or config defaults.

## Parsing responses

`sofetch` provides shortcuts for converting the response body to different data types:

```ts
// convert JSON response body to a JS object
const user = await f.get("/api/user").json<User>();

// Other data types
const text = await f.get("/api/user").text();
const blob = await f.get("/api/user").blob();
const formData = await f.get("/api/user").formData();
const arrayBuffer = await f.get("/api/user").arrayBuffer();
```

You can also do this on the response object like you would with fetch

```ts
// async/await example
const response = await f.get("/api/user");
const user = response.json<User>();

// promise.then example
const user = await f.get("/api/user").then(response => response.json<User>());
```

## Request properties

You can pass request properties such as `body`, `headers`, `mode`, `redirect` etc. to all client methods. The

```ts
f.post("https://example.com/api/login", {
    body: new FormData(loginForm),
    headers: {
        "X-CSRF": "123456",
    },
    mode: "no-cors",
});
```

## Configuring `f`

By default the `f` client exported from `sofetch` has very little configuration. You can configure the client with:

```ts
f.configure(options: SoFetchClientOptions);
```

> 💡 We recommend only configuring the client once when you initialise your app. Calling `f.configure()` will clear any pre-existing configuration.

## Creating a new client

You can create multiple clients with different configurations:

```ts
import { createClient } from "@danbahrami/sofetch";

export const apiClient = createClient(apiClientOptions);
export const httpClient = createClient(apiClientOptions);
```

## Configuration options

### Base URL

Using a base URL means you don't have to pass a full URL every time you make a request. Instead you can just pass a relative path.

```ts
f.configure({
    baseUrl: "http://example.com/api",
});

const user = f.get("/user").json<User>();
```

> 💡 If you do pass a full URL when making a request that will take priority over the base URL.

### Request defaults

Request defaults let you define standard request properties.

```ts
f.configure({
    defaults: {
        // Common defaults are used for all HTTP methods
        common: {
            cache: "no-cache",
        },

        // Per request defaults
        get: {
            headers: { "X-CSRF": "123456" },
        },
        delete: {
            // timeout all delete requests after 5 seconds
            signal: AbortSignal.timeout(5000),
        },
    },
});
```

You can also pass factory functions if you want to inject unique values into every request. For example, this can be used to generate a unique request ID header for monitoring purposes.

```ts
f.configure({
    defaults: {
        common: () => ({
            headers: {
                traceId: sha1(),
            },
        }),
    },
});
```

Request properties will be applied in priority order, from highest to lowest priority:

1. The options you pass when making the request `f.get(url, options)`
2. The method specific defaults
3. The common defaults

Request Headers will also be merged using the same priority order.

### Callbacks

Callbacks let you hook into the request lifecycle globally. They can be useful for logging or adding some global handler e.g. showing a toast on error.

There are two ways to add callbacks:

1. Pass a list of callbacks in client options

```ts
// Adding callbacks when configuring the client
const client = createClient({
    callbacks: {
        onRequestStart: [({ request }) => logRequestStart(request)],
        onErrorResponse: [({ request, error }) => logErrorResponse(request, error)],
    },
});
```

2. Add a callback to a pre-existing client

```ts
const unsubscribe = f.callbacks.onRequestStart(({ request }) => {
    logRequestStart(request);
});

unsubscribe(); // remove the callback
```

#### `onRequestStart: ({ request }) => void`

Called before the start of every request.

**arg:**

-   `request: Request`

#### `onSuccessResponse: ({ request, response }) => void`

Called after receiving a response with a `2xx` HTTP status code.

**arg:**

-   `request: Request`
-   `response: Response`

#### `onErrorResponse: ({ request, error }) => void`

Called after receiving a response with a `4xx` or `5xx` HTTP status code.

**arg:**

-   `request: Request`
-   `error: HttpError | NetworkError`

#### `onClientError`

Called when some error occurs on the client. Examples of rasons why this would be called include:

-   `{JsonStringifyError}` - Invalid JSON is passed to a request
-   `{JsonParseError}` - `.json()` called on a non-JSON response
-   `{TypeError}` - an invalid request URL was passed
-   `{Error}` - an error thrown in a callback
-   `{Error}` - some other internal error happened in the client

**arg:**

-   `request: Request`
-   `error: unknown`

## Errors

`sofetch` throws errors which represent a specific failure case:

### `HttpError`

An `HttpError` is thrown after receiving a response with a `4xx` or `5xx` HTTP status code. It contains details of the request and response.

```ts
import { HttpError } from "@danbahrami/sofetch";
```

**Properties:**

-   `error.request` The full request instance
-   `error.response` The full response instance
-   `error.statusCode` The HTTP status code as an integer

### `NetworkError`

A `NetworkError` is thrown when `fetch` throws an error. This usually indicates that the client and server could not successfully communicate.

```ts
import { NetworkError } from "@danbahrami/sofetch";
```

**Properties:**

-   `error.request` The full request instance
-   `error.originalError` The error thrown by `fetch`

### `JsonStringifyError`

A `JsonStringifyError` is thrown if the object passed to the request `json` field cannot be serialized to a JSON string. More information can be found [here](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#exceptions).

```ts
import { JsonStringifyError } from "@danbahrami/sofetch";
```

**Properties:**

-   `error.request` The full request instance
-   `error.data` The object passed as `json`
-   `error.originalError` The error thrown by `JSON.stringify()`

### `JsonParseError`

A `JsonParseError` is thrown when you try to parse a non-JSON response to JSON.

```ts
import { JsonParseError } from "@danbahrami/sofetch";

// if the request response is not JSON both
// of these will throw a JsonParseError
await f.get(url).json();
await f.get(url).then(response => response.json());
```

**Properties:**

-   `error.request` The full request instance
-   `error.response` The full response instance
-   `error.originalError` The error thrown by `JSON.stringify()`

## Types

We export the following TypeScript types:

### `SoFetchClient`

The type of the `f` client or the result of `createClient()`.

```ts
type SoFetchClient = {
    request: (
        input: RequestInfo | URL,
        init?: RequestInit & { json?: unknown }
    ) => DecoratedResponsePromise;

    get: (
        input: RequestInfo | URL,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    put: (
        input: RequestInfo | URL,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    post: (
        input: RequestInfo | URL,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    patch: (
        input: RequestInfo | URL,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    delete: (
        input: RequestInfo | URL,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    options: (
        input: RequestInfo | URL,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    head: (
        input: RequestInfo | URL,
        init?: Omit<RequestInit, "method"> & { json?: unknown }
    ) => DecoratedResponsePromise;

    callbacks: {
        onRequestStart: (cb: Callbacks["onRequestStart"]) => () => void;
        onSuccessResponse: (cb: Callbacks["onSuccessResponse"]) => () => void;
        onErrorResponse: (cb: Callbacks["onErrorResponse"]) => () => void;
        onClientError: (cb: Callbacks["onClientError"]) => () => void;
    };

    configure: (options?: SoFetchClientOptions) => void;
};
```

### `SoFetchClientOptions`

```ts
type SoFetchClientOptions = {
    defaults?: {
        get?: Omit<RequestInit, "method"> | (() => Omit<RequestInit, "method">);
        put?: Omit<RequestInit, "method"> | (() => Omit<RequestInit, "method">);
        post?: Omit<RequestInit, "method"> | (() => Omit<RequestInit, "method">);
        patch?: Omit<RequestInit, "method"> | (() => Omit<RequestInit, "method">);
        delete?: Omit<RequestInit, "method"> | (() => Omit<RequestInit, "method">);
        options?: Omit<RequestInit, "method"> | (() => Omit<RequestInit, "method">);
        head?: Omit<RequestInit, "method"> | (() => Omit<RequestInit, "method">);
        common?: Omit<RequestInit, "method"> | (() => Omit<RequestInit, "method">);
    };
    callbacks?: {
        onRequestStart?: Callbacks["onRequestStart"][];
        onSuccessResponse?: Callbacks["onSuccessResponse"][];
        onErrorResponse?: Callbacks["onErrorResponse"][];
        onClientError?: Callbacks["onClientError"][];
    };
    baseUrl?: string;
};
```

### `Callbacks`

```ts
type Callbacks = {
    onRequestStart: (details: { request: Request }) => Promise<void> | void;

    onSuccessResponse: (details: { request: Request; response: Response }) => Promise<void> | void;

    onErrorResponse: (details: {
        request: Request;
        error: HttpError | NetworkError;
    }) => Promise<void> | void;

    onClientError: (details: { error: unknown }) => Promise<void> | void;
};
```

### `DecoratedResponsePromise`

The return type when making a request. It's a `Promise` with the additional methods added for converting the response body into different data types.

```ts
type DecoratedResponsePromise = Promise<DecoratedResponse> & {
    json: <T = unknown>() => Promise<T>;
    text: () => Promise<string>;
    blob: () => Promise<Blob>;
    formData: () => Promise<FormData>;
    arrayBuffer: () => Promise<ArrayBuffer>;
};
```

### `DecoratedResponse`

This is how we type the response instance. The only thing it does is add the ability to pass a generic which represents the JSON response type.

```ts
type DecoratedResponse = Response & {
    json: <T = unknown>() => Promise<T>;
};
```
