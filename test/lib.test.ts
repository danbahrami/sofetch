import nock from "nock";
import { describe, test, expect, vi } from "vitest";

import {
    f,
    HttpError,
    JsonParseError,
    JsonStringifyError,
    NetworkError,
} from "../src";

type User = {
    firstName: string;
    lastName: string;
    age: number;
};

const mockConsoleError = () => {
    return vi.spyOn(console, "error").mockImplementation(() => null);
};

const API_HOST = "http://that-is-so-fetch.com";

describe("f.get()", () => {
    test("It performs a GET request and returns a response", async () => {
        nock(API_HOST)
            .get("/api/user")
            .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

        const response = await f.get("/api/user");

        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
    });

    test("You can unwrap the JSON response directly on the return promise", async () => {
        nock(API_HOST)
            .get("/api/user")
            .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

        const user = await f.get("/api/user").json<User>();

        expect(user).toEqual({
            firstName: "Shane",
            lastName: "MacGowan",
            age: 65,
        });
    });

    test("You can unwrap the JSON response on the response instance", async () => {
        nock(API_HOST)
            .get("/api/user")
            .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

        const user = await f
            .get("/api/user")
            .then(response => response.json<User>());

        expect(user).toEqual({
            firstName: "Shane",
            lastName: "MacGowan",
            age: 65,
        });
    });

    test("4xx responses throw an HttpError", async () => {
        nock(API_HOST)
            .get("/api/user")
            .reply(404, "Oh no, that page don't exist baby");

        try {
            await f.get("/api/user");
            expect(true).toBe(false); // Fail the test if no error is thrown
        } catch (e) {
            expect(e).toBeInstanceOf(HttpError);
            expect(e).not.toBeInstanceOf(NetworkError);
            expect(e).not.toBeInstanceOf(JsonParseError);
            expect(e).not.toBeInstanceOf(JsonStringifyError);

            // Lets check we have everything we need on the error
            const error = e as HttpError;

            expect(error.request).toBeInstanceOf(Request);
            expect(error.request.url).toBe("/api/user");
            expect(error.request.method).toBe("GET");

            expect(error.statusCode).toBe(404);
            expect(await error.response.text()).toBe(
                "Oh no, that page don't exist baby"
            );
            expect(error.message).toBe(
                "Request failed with status code 404 Not Found: GET /api/user"
            );
        }

        // Now we've dived into detail on a single error response lets also
        // check we get an HttpError for other 4xx status codes
        for (const statusCode of [400, 401, 402, 403, 405]) {
            nock(API_HOST).get("/api/user").reply(statusCode);

            try {
                await f.get("/api/user");
                expect(true).toBe(false); // Fail the test if no error is thrown
            } catch (error) {
                expect(error).toBeInstanceOf(HttpError);
            }
        }
    });

    test("5xx responses throw an HttpError", async () => {
        for (const statusCode of [500, 501, 502, 503, 505]) {
            nock(API_HOST).get("/api/user").reply(statusCode);

            try {
                await f.get("/api/user");
                expect(true).toBe(false); // Fail the test if no error is thrown
            } catch (error) {
                expect(error).toBeInstanceOf(HttpError);
            }
        }
    });

    test("Network errors will be retried up-to 3 times", async () => {
        // nock is going to log a load of errors to the console here so lets
        // silence that just for this test
        const logSpy = mockConsoleError();

        nock(API_HOST)
            .get("/api/user")
            .twice()
            .replyWithError("Something bad happened")
            .get("/api/user")
            .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

        const req = f.get("/api/user").json<User>();

        const user = await req;

        expect(user).toEqual<User>({
            firstName: "Shane",
            lastName: "MacGowan",
            age: 65,
        });

        // restore console.error and setTimeout
        logSpy.mockRestore();
    });

    test("Network errors will throw a NetworkError after the 3rd failed attempt", async () => {
        const err = new Error("something bad happened");

        nock(API_HOST).get("/api/user").replyWithError(err);

        try {
            await f.get("/api/user");
            expect(true).toBe(false); // Fail the test if no error is thrown
        } catch (e) {
            expect(e).toBeInstanceOf(NetworkError);
            expect(e).not.toBeInstanceOf(HttpError);
            expect(e).not.toBeInstanceOf(JsonParseError);
            expect(e).not.toBeInstanceOf(JsonStringifyError);

            // Lets check we have everything we need on the error
            const error = e as NetworkError;

            expect(error.request).toBeInstanceOf(Request);
            expect(error.request.url).toBe("/api/user");
            expect(error.request.method).toBe("GET");
        }
    });

    test("Calling .json() on a non JSON response will throw a JsonParseError", async () => {
        nock(API_HOST).get("/api/user").reply(200, "Oh hello");

        try {
            await f.get("/api/user").json();

            expect(true).toBe(false); // Fail the test if no error is thrown
        } catch (e) {
            expect(e).toBeInstanceOf(JsonParseError);
            expect(e).not.toBeInstanceOf(HttpError);
            expect(e).not.toBeInstanceOf(NetworkError);
            expect(e).not.toBeInstanceOf(JsonStringifyError);
        }
    });

    test("Calling Response.json() on a non JSON response body will throw a JsonParseError", async () => {
        nock(API_HOST).get("/api/user").reply(200, "Oh hello");

        try {
            await f.get("/api/user").then(response => response.json());

            expect(true).toBe(false); // Fail the test if no error is thrown
        } catch (e) {
            expect(e).toBeInstanceOf(JsonParseError);
            expect(e).not.toBeInstanceOf(HttpError);
            expect(e).not.toBeInstanceOf(NetworkError);
            expect(e).not.toBeInstanceOf(JsonStringifyError);
        }
    });

    describe("headers", () => {
        test("It adds some generally useful default headers", async () => {
            nock(API_HOST)
                .matchHeader("Content-Type", "application/json")
                .matchHeader("Accept", "application/json")
                .matchHeader("Cache", "no-cache")
                .get("/api/user")
                .reply(200);

            await f.get("/api/user");
        });

        test("You can add and overwrite headers manually", async () => {
            nock(API_HOST)
                .matchHeader("Content-Type", "application/text")
                .matchHeader("Accept", "application/text")
                .matchHeader("Cache", "no-cache")
                .matchHeader("Foo", "bar")
                .get("/api/user")
                .reply(200);

            await f.get("/api/user", {
                headers: {
                    "Content-Type": "application/text",
                    Accept: "application/text",
                    Foo: "bar",
                },
            });
        });
    });
});

describe("f.post()", () => {
    test("It performs a POST request with some standard headers and returns a response", async () => {
        nock(API_HOST)
            .matchHeader("Content-Type", "application/json")
            .matchHeader("Accept", "application/json")
            .matchHeader("Cache", "no-cache")
            .post("/api/user", { firstName: "Mad Dog", lastName: "Mcrea" })
            .reply(200, { id: "567" });

        const response = await f.post("/api/user", {
            json: { firstName: "Mad Dog", lastName: "Mcrea" },
        });

        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
        expect(await response.json()).toEqual({ id: "567" });
    });

    test("If you try to post non-serializeable JSON data it throws a JsonStringifyError", async () => {
        nock(API_HOST).post("/api/user").reply(200, { id: "567" });

        try {
            await f.post("/api/user", {
                json: {
                    // JS doesn't know how to parse a BigInt into JSON
                    userId: BigInt(9007199254740991),
                },
            });
            // Fail the test if no error is thrown
            expect(true).toBe(false);
        } catch (e) {
            expect(e).toBeInstanceOf(JsonStringifyError);
            expect(e).not.toBeInstanceOf(HttpError);
            expect(e).not.toBeInstanceOf(NetworkError);
            expect(e).not.toBeInstanceOf(JsonParseError);

            const error = e as JsonStringifyError;
            expect(error.request.url).toBe("/api/user");
            expect(error.request.method).toBe("POST");
        }
    });

    test("JsonStringifyError when you await the request, not when you make the request", async () => {
        nock(API_HOST).post("/api/user").reply(200, { id: "567" });

        const request = f.post("/api/user", {
            json: {
                // JS doesn't know how to parse a BigInt into JSON
                userId: BigInt(9007199254740991),
            },
        });

        try {
            await request;
            // Fail the test if no error is thrown
            expect(true).toBe(false);
        } catch (e) {
            expect(e).toBeInstanceOf(JsonStringifyError);
        }
    });
});

describe("f.put()", () => {
    test("It performs a PUT request with some standard headers and returns a response", async () => {
        nock(API_HOST)
            .matchHeader("Content-Type", "application/json")
            .matchHeader("Accept", "application/json")
            .matchHeader("Cache", "no-cache")
            .put("/api/user", { firstName: "Mad Dog", lastName: "Mcrea" })
            .reply(200, { id: "567" });

        const response = await f.put("/api/user", {
            json: { firstName: "Mad Dog", lastName: "Mcrea" },
        });

        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
        expect(await response.json()).toEqual({ id: "567" });
    });
});

describe("f.patch()", () => {
    test("It performs a PATCH request with some standard headers and returns a response", async () => {
        nock(API_HOST)
            .matchHeader("Content-Type", "application/json")
            .matchHeader("Accept", "application/json")
            .matchHeader("Cache", "no-cache")
            .patch("/api/user", { firstName: "Mad Dog", lastName: "Mcrea" })
            .reply(200, { id: "567" });

        const response = await f.patch("/api/user", {
            json: { firstName: "Mad Dog", lastName: "Mcrea" },
        });

        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
        expect(await response.json()).toEqual({ id: "567" });
    });
});

describe("f.delete()", () => {
    test("It performs a DELETE request with some standard headers and returns a response", async () => {
        nock(API_HOST)
            .matchHeader("Pragma", "no-cache")
            .matchHeader("Cache", "no-cache")
            .delete("/api/user", { id: "4" })
            .reply(200, { success: true });

        const response = await f.delete("/api/user", {
            json: { id: "4" },
        });

        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
        expect(await response.json()).toEqual({ success: true });
    });
});

describe("onRequestStart callback", () => {
    test("all `onRequestStart` callbacks are called before every request", async () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const unsubscribe1 = f.callbacks.onRequestStart(callback1);
        const unsubscribe2 = f.callbacks.onRequestStart(callback2);

        nock(API_HOST).get("/api/user?workspace=3").reply(200);

        const request = f.get("/api/user?workspace=3");

        await vi.waitFor(() => {
            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });

        const args = callback1.mock.calls[0];
        expect(args).toEqual([{ request: expect.any(Request) }]);

        const argRequest = args[0].request as Request;

        expect(argRequest.method).toBe("GET");
        expect(argRequest.url).toBe("/api/user?workspace=3");

        // cleanup
        await request;
        unsubscribe1();
        unsubscribe2();
    });

    test("it awaits any async `onRequestStart` callbacks", async () => {
        const output: string[] = [];

        const callback1 = vi.fn(async () => {
            output.push("callback1 start");
            await Promise.resolve();
            output.push("callback1 end");
        });

        const callback2 = vi.fn(async () => {
            output.push("callback2 start");
            await Promise.resolve();
            output.push("callback2 end");
        });

        const unsubscribe1 = f.callbacks.onRequestStart(callback1);
        const unsubscribe2 = f.callbacks.onRequestStart(callback2);

        nock(API_HOST).get("/api/user?workspace=3").reply(200);

        await f.get("/api/user?workspace=3");

        expect(output).toEqual([
            "callback1 start",
            "callback1 end",
            "callback2 start",
            "callback2 end",
        ]);

        // cleanup
        unsubscribe1();
        unsubscribe2();
    });

    test("once a callback is removed it's not called again", async () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const unsubscribe1 = f.callbacks.onRequestStart(callback1);
        const unsubscribe2 = f.callbacks.onRequestStart(callback2);

        nock(API_HOST).get("/api/user?workspace=3").twice().reply(200);

        await f.get("/api/user?workspace=3");

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);

        unsubscribe1();

        await f.get("/api/user?workspace=3");

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(2);

        unsubscribe2();
    });
});

describe("onSuccessResponse callback", () => {
    test("all `onSuccessResponse` callbacks are called after a 200 response", async () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const unsubscribe1 = f.callbacks.onSuccessResponse(callback1);
        const unsubscribe2 = f.callbacks.onSuccessResponse(callback2);

        nock(API_HOST).get("/api/user?workspace=3").reply(200);

        await f.get("/api/user?workspace=3");

        expect(callback1).toHaveBeenCalled();
        expect(callback2).toHaveBeenCalled();

        const args = callback1.mock.calls[0];
        expect(args).toEqual([
            {
                request: expect.any(Request),
                response: expect.any(Response),
            },
        ]);

        const argRequest = args[0].request as Request;

        expect(argRequest.method).toBe("GET");
        expect(argRequest.url).toBe("/api/user?workspace=3");

        // cleanup
        unsubscribe1();
        unsubscribe2();
    });

    test("it awaits any async `onSuccessResponse` callbacks", async () => {
        const output: string[] = [];

        const callback1 = vi.fn(async () => {
            output.push("callback1 start");
            await Promise.resolve();
            output.push("callback1 end");
        });

        const callback2 = vi.fn(async () => {
            output.push("callback2 start");
            await Promise.resolve();
            output.push("callback2 end");
        });

        const unsubscribe1 = f.callbacks.onSuccessResponse(callback1);
        const unsubscribe2 = f.callbacks.onSuccessResponse(callback2);

        nock(API_HOST).get("/api/user?workspace=3").reply(200);

        await f.get("/api/user?workspace=3");

        expect(output).toEqual([
            "callback1 start",
            "callback1 end",
            "callback2 start",
            "callback2 end",
        ]);

        // cleanup
        unsubscribe1();
        unsubscribe2();
    });

    test("once a callback is removed it's not called again", async () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const unsubscribe1 = f.callbacks.onSuccessResponse(callback1);
        const unsubscribe2 = f.callbacks.onSuccessResponse(callback2);

        nock(API_HOST).get("/api/user?workspace=3").twice().reply(200);

        await f.get("/api/user?workspace=3");

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);

        unsubscribe1();

        await f.get("/api/user?workspace=3");

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(2);

        unsubscribe2();
    });

    test("`onSuccessResponse` is not called when a non-200 response occurs", async () => {
        const statusCodes = [400, 401, 402, 403, 500, 501, 502, 503];

        for (const statusCode of statusCodes) {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            const unsubscribe1 = f.callbacks.onSuccessResponse(callback1);
            const unsubscribe2 = f.callbacks.onSuccessResponse(callback2);

            nock(API_HOST).get("/api/user?workspace=3").reply(statusCode);

            try {
                await f.get("/api/user?workspace=3");
            } catch (e) {
                //
            }

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();

            // cleanup
            unsubscribe1();
            unsubscribe2();
        }
    });

    test("`onSuccessResponse` is not called when a network error occurs", async () => {
        const logSpy = mockConsoleError();

        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const unsubscribe1 = f.callbacks.onSuccessResponse(callback1);
        const unsubscribe2 = f.callbacks.onSuccessResponse(callback2);

        nock(API_HOST)
            .get("/api/user?workspace=3")
            .replyWithError(new Error("something bad happened"));

        try {
            await f.get("/api/user?workspace=3");
        } catch (e) {
            //
        }

        expect(callback1).not.toHaveBeenCalled();
        expect(callback2).not.toHaveBeenCalled();

        // cleanup
        unsubscribe1();
        unsubscribe2();
        logSpy.mockRestore();
    });
});

describe("onErrorResponse callback", () => {
    test("all `onErrorResponse` callbacks are called after a non-200 response", async () => {
        const statusCodes = [400, 401, 402, 403, 500, 501, 502, 503];

        for (const statusCode of statusCodes) {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            const unsubscribe1 = f.callbacks.onErrorResponse(callback1);
            const unsubscribe2 = f.callbacks.onErrorResponse(callback2);

            nock(API_HOST).get("/api/user?workspace=3").reply(statusCode);

            try {
                await f.get("/api/user?workspace=3");
            } catch (e) {
                //
            }

            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();

            const args = callback1.mock.calls[0];
            expect(args).toEqual([
                {
                    request: expect.any(Request),
                    error: expect.any(HttpError),
                },
            ]);

            const argRequest = args[0].request as Request;
            const argError = args[0].error as HttpError;

            expect(argRequest.method).toBe("GET");
            expect(argRequest.url).toBe("/api/user?workspace=3");
            expect(argError.statusCode).toBe(statusCode);

            // cleanup
            unsubscribe1();
            unsubscribe2();
        }
    });

    test("`onErrorResponse` is called when a network error occurs", async () => {
        const logSpy = mockConsoleError();

        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const unsubscribe1 = f.callbacks.onErrorResponse(callback1);
        const unsubscribe2 = f.callbacks.onErrorResponse(callback2);

        nock(API_HOST)
            .get("/api/user?workspace=3")
            .replyWithError(new Error("something bad happened"));

        try {
            await f.get("/api/user?workspace=3");
        } catch (e) {
            //
        }

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);

        const args = callback1.mock.calls[0];
        expect(args).toEqual([
            {
                request: expect.any(Request),
                error: expect.any(NetworkError),
            },
        ]);

        const argRequest = args[0].request as Request;

        expect(argRequest.method).toBe("GET");
        expect(argRequest.url).toBe("/api/user?workspace=3");

        // cleanup
        unsubscribe1();
        unsubscribe2();
        logSpy.mockRestore();
    });

    test("it awaits any async `onErrorResponse` callbacks", async () => {
        const output: string[] = [];

        const callback1 = vi.fn(async () => {
            output.push("callback1 start");
            await Promise.resolve();
            output.push("callback1 end");
        });

        const callback2 = vi.fn(async () => {
            output.push("callback2 start");
            await Promise.resolve();
            output.push("callback2 end");
        });

        const unsubscribe1 = f.callbacks.onErrorResponse(callback1);
        const unsubscribe2 = f.callbacks.onErrorResponse(callback2);

        nock(API_HOST).get("/api/user?workspace=3").reply(400);

        try {
            await f.get("/api/user?workspace=3");
        } catch (e) {
            //
        }

        expect(output).toEqual([
            "callback1 start",
            "callback1 end",
            "callback2 start",
            "callback2 end",
        ]);

        // cleanup
        unsubscribe1();
        unsubscribe2();
    });

    test("once a callback is removed it's not called again", async () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const unsubscribe1 = f.callbacks.onErrorResponse(callback1);
        const unsubscribe2 = f.callbacks.onErrorResponse(callback2);

        nock(API_HOST).get("/api/user?workspace=3").twice().reply(400);

        try {
            await f.get("/api/user?workspace=3");
        } catch (e) {
            //
        }

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);

        unsubscribe1();

        try {
            await f.get("/api/user?workspace=3");
        } catch (e) {
            //
        }

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(2);

        unsubscribe2();
    });

    test("`onErrorResponse` is not called when a 200 response occurs", async () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const unsubscribe1 = f.callbacks.onErrorResponse(callback1);
        const unsubscribe2 = f.callbacks.onErrorResponse(callback2);

        nock(API_HOST).get("/api/user?workspace=3").reply(200);

        try {
            await f.get("/api/user?workspace=3");
        } catch (e) {
            //
        }

        expect(callback1).not.toHaveBeenCalled();
        expect(callback2).not.toHaveBeenCalled();

        // cleanup
        unsubscribe1();
        unsubscribe2();
    });
});

describe("onJsonParseError callback", () => {
    test("all `onJsonParseError` callbacks are called when calling .json() on a non-JSON response", async () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const unsubscribe1 = f.callbacks.onJsonParseError(callback1);
        const unsubscribe2 = f.callbacks.onJsonParseError(callback2);

        nock(API_HOST).get("/api/user").reply(200, "Oh hello");

        try {
            await f.get("/api/user").json();
            expect(true).toBe(false); // Fail the test if no error is thrown
        } catch (e) {
            //
        }

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);

        unsubscribe1();
        unsubscribe2();
    });
});

describe("onJsonStringifyError callback", () => {
    test("all `onJsonStringifyError` callbacks when non-serializeable JSON is passed", async () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const unsubscribe1 = f.callbacks.onJsonStringifyError(callback1);
        const unsubscribe2 = f.callbacks.onJsonStringifyError(callback2);

        nock(API_HOST).get("/api/user").reply(200, "Oh hello");

        try {
            await f.post("/api/user", {
                json: {
                    // JS doesn't know how to parse a BigInt into JSON
                    userId: BigInt(9007199254740991),
                },
            });
            expect(true).toBe(false); // Fail the test if no error is thrown
        } catch (e) {
            //
        }

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);

        unsubscribe1();
        unsubscribe2();
    });

    test("`onJsonStringifyError` is not called when valid JSON is passed", async () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const unsubscribe1 = f.callbacks.onJsonStringifyError(callback1);
        const unsubscribe2 = f.callbacks.onJsonStringifyError(callback2);

        nock(API_HOST).get("/api/user").reply(200, "Oh hello");

        try {
            await f.post("/api/user", {
                json: {
                    userId: 12,
                },
            });
            expect(true).toBe(false); // Fail the test if no error is thrown
        } catch (e) {
            //
        }

        expect(callback1).not.toHaveBeenCalled();
        expect(callback2).not.toHaveBeenCalled();

        unsubscribe1();
        unsubscribe2();
    });
});
