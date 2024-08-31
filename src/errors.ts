/**
 * HttpError - thrown when the server's response has a `4xx` or `5xx` status
 * code.
 */
export class HttpError extends Error {
    public response: Response;
    public request: Request;
    public statusCode: number;

    constructor(request: Request, response: Response) {
        const statusCode = response.status;
        const status = `${statusCode} ${response.statusText}`.trim();

        super(`Request failed with status code ${status}: ${request.method} ${request.url}`);

        this.name = "HttpError";
        this.response = response.clone();
        this.request = request;
        this.statusCode = statusCode;
    }
}

/**
 * NetworkError - thrown when the client couldn't successfully communicate with
 * the server. Here's a non-exhastive list of the reasons this could happen:
 * - The client's network is offline or flakey
 * - The endpoint doesn't exist
 * - The server that should be responsible for the request is unresponsive
 * - The client aborted the request with an AbortController
 * - The request was malformed
 *
 * For more information see:
 * https://developer.mozilla.org/en-US/docs/Web/API/fetch#exceptions
 */
export class NetworkError extends Error {
    public request: Request;
    public originalError: unknown;

    constructor(request: Request, error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown NetworkError";

        super(message);

        this.name = "NetworkError";
        this.request = request;
        this.originalError = error;
    }
}

/**
 * JsonParseError - thrown when calling Response.json on a response that does
 * not contain a valid JSON repsonse body.
 */
export class JsonParseError extends Error {
    public request: Request;
    public response: Response;
    public originalError: unknown;

    constructor(request: Request, response: Response, error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown JsonParseError";

        super(message);

        this.name = "JsonParseError";
        this.request = request;
        this.response = response;
        this.originalError = error;
    }
}

/**
 * JsonStringifyError - thrown when non-serializeable JSON is passed as the JSON
 * request body.
 *
 * For more information on why this might happen see:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#exceptions
 */
export class JsonStringifyError extends Error {
    public request: Request;
    public data: unknown;
    public originalError: unknown;

    constructor(request: Request, data: unknown, error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown JsonStringifyError";

        super(message);

        this.name = "JsonStringifyError";
        this.request = request;
        this.data = data;
        this.originalError = error;
    }
}
