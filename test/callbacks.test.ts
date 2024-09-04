import nock from "nock";
import { describe, test, expect, vi } from "vitest";

import { f, HttpError, JsonParseError, JsonStringifyError, NetworkError } from "../src";
import { Callbacks } from "@/types";

const mockConsoleError = () => {
    return vi.spyOn(console, "error").mockImplementation(() => null);
};

const HOST = "http://that-is-so-fetch.com";

describe("onRequestStart()", () => {
    test("all `onRequestStart` callbacks are called before every request", async () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const unsubscribe1 = f.callbacks.onRequestStart(callback1);
        const unsubscribe2 = f.callbacks.onRequestStart(callback2);

        nock(HOST).get("/api/user?workspace=3").reply(200);

        const request = f.get(HOST + "/api/user?workspace=3");

        await vi.waitFor(() => {
            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });

        const args = callback1.mock.calls[0];
        expect(args).toEqual([{ request: expect.any(Request) }]);

        const argRequest = args[0].request as Request;

        expect(argRequest.method).toBe("GET");
        expect(argRequest.url).toBe(HOST + "/api/user?workspace=3");

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

        nock(HOST).get("/api/user?workspace=3").reply(200);

        await f.get(HOST + "/api/user?workspace=3");

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

        nock(HOST).get("/api/user?workspace=3").twice().reply(200);

        await f.get(HOST + "/api/user?workspace=3");

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);

        unsubscribe1();

        await f.get(HOST + "/api/user?workspace=3");

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(2);

        unsubscribe2();
    });
});

describe("onSuccessResponse()", () => {
    test("all `onSuccessResponse` callbacks are called after a 200 response", async () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const unsubscribe1 = f.callbacks.onSuccessResponse(callback1);
        const unsubscribe2 = f.callbacks.onSuccessResponse(callback2);

        nock(HOST).get("/api/user?workspace=3").reply(200);

        await f.get(HOST + "/api/user?workspace=3");

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
        expect(argRequest.url).toBe(HOST + "/api/user?workspace=3");

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

        nock(HOST).get("/api/user?workspace=3").reply(200);

        await f.get(HOST + "/api/user?workspace=3");

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

        nock(HOST).get("/api/user?workspace=3").twice().reply(200);

        await f.get(HOST + "/api/user?workspace=3");

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);

        unsubscribe1();

        await f.get(HOST + "/api/user?workspace=3");

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

            nock(HOST).get("/api/user?workspace=3").reply(statusCode);

            try {
                await f.get(HOST + "/api/user?workspace=3");
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

        nock(HOST).get("/api/user?workspace=3").replyWithError(new Error("something bad happened"));

        try {
            await f.get(HOST + "/api/user?workspace=3");
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

describe("onErrorResponse()", () => {
    test("all `onErrorResponse` callbacks are called after a non-200 response", async () => {
        const statusCodes = [400, 401, 402, 403, 500, 501, 502, 503];

        for (const statusCode of statusCodes) {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            const unsubscribe1 = f.callbacks.onErrorResponse(callback1);
            const unsubscribe2 = f.callbacks.onErrorResponse(callback2);

            nock(HOST).get("/api/user?workspace=3").reply(statusCode);

            try {
                await f.get(HOST + "/api/user?workspace=3");
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
            expect(argRequest.url).toBe(HOST + "/api/user?workspace=3");
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

        nock(HOST).get("/api/user?workspace=3").replyWithError(new Error("something bad happened"));

        try {
            await f.get(HOST + "/api/user?workspace=3");
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
        expect(argRequest.url).toBe(HOST + "/api/user?workspace=3");

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

        nock(HOST).get("/api/user?workspace=3").reply(400);

        try {
            await f.get(HOST + "/api/user?workspace=3");
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

        nock(HOST).get("/api/user?workspace=3").twice().reply(400);

        try {
            await f.get(HOST + "/api/user?workspace=3");
        } catch (e) {
            //
        }

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);

        unsubscribe1();

        try {
            await f.get(HOST + "/api/user?workspace=3");
        } catch (e) {
            //
        }

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(2);

        unsubscribe1();
        unsubscribe2();
    });

    test("`onErrorResponse` is not called when a 200 response occurs", async () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const unsubscribe1 = f.callbacks.onErrorResponse(callback1);
        const unsubscribe2 = f.callbacks.onErrorResponse(callback2);

        nock(HOST).get("/api/user?workspace=3").reply(200);

        try {
            await f.get(HOST + "/api/user?workspace=3");
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

describe("onClientError()", () => {
    test("all callbacks receive a JsonParseError when calling .json() on a non-JSON response", async () => {
        const callback1 = vi.fn<Callbacks["onClientError"]>();
        const callback2 = vi.fn<Callbacks["onClientError"]>();

        const unsubscribe1 = f.callbacks.onClientError(callback1);
        const unsubscribe2 = f.callbacks.onClientError(callback2);

        nock(HOST).get("/api/user").reply(200, "Oh hello");

        try {
            await f.get(HOST + "/api/user").json();
            expect(true).toBe(false); // Fail the test if no error is thrown
        } catch (e) {
            //
        }

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);

        expect(callback1).toHaveBeenCalledWith({
            error: expect.any(JsonParseError),
        });
        expect(callback2).toHaveBeenCalledWith({
            error: expect.any(JsonParseError),
        });

        unsubscribe1();
        unsubscribe2();
    });

    test("all callbacks receive a JsonStringifyError when non-serializeable JSON is passed", async () => {
        const callback1 = vi.fn<Callbacks["onClientError"]>();
        const callback2 = vi.fn<Callbacks["onClientError"]>();

        const unsubscribe1 = f.callbacks.onClientError(callback1);
        const unsubscribe2 = f.callbacks.onClientError(callback2);

        try {
            await f.post(HOST + "/api/user", {
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

        expect(callback1).toHaveBeenCalledWith({
            error: expect.any(JsonStringifyError),
        });
        expect(callback2).toHaveBeenCalledWith({
            error: expect.any(JsonStringifyError),
        });

        unsubscribe1();
        unsubscribe2();
    });

    test("all callbacks receive an Error when an `onRequestStart` modifier throws an error", async () => {
        const error = new Error("uh oh");

        const unsubscribe1 = f.modifiers.beforeRequest(() => {
            throw error;
        });

        const callback1 = vi.fn<Callbacks["onClientError"]>();
        const callback2 = vi.fn<Callbacks["onClientError"]>();
        const unsubscribe2 = f.callbacks.onClientError(callback1);
        const unsubscribe3 = f.callbacks.onClientError(callback2);

        try {
            await f.get(HOST + "/api/user");
            expect(true).toBe(false); // Fail the test if no error is thrown
        } catch (e) {
            //
        }

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);

        expect(callback1).toHaveBeenCalledWith({ error });
        expect(callback2).toHaveBeenCalledWith({ error });

        // cleanup
        unsubscribe1();
        unsubscribe2();
        unsubscribe3();
    });

    test("all callbacks receive an Error when a `beforeSuccessResponse` modifier throws an error", async () => {
        const error = new Error("uh oh");

        const unsubscribe1 = f.modifiers.beforeSuccessResponse(() => {
            throw error;
        });

        const callback1 = vi.fn<Callbacks["onClientError"]>();
        const callback2 = vi.fn<Callbacks["onClientError"]>();
        const unsubscribe2 = f.callbacks.onClientError(callback1);
        const unsubscribe3 = f.callbacks.onClientError(callback2);

        nock(HOST).get("/api/user").reply(200);

        try {
            await f.get(HOST + "/api/user");
            expect(true).toBe(false); // Fail the test if no error is thrown
        } catch (e) {
            //
        }

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);

        expect(callback1).toHaveBeenCalledWith({ error });
        expect(callback2).toHaveBeenCalledWith({ error });

        // cleanup
        unsubscribe1();
        unsubscribe2();
        unsubscribe3();
    });

    test("`onClientError` is not called when a `beforeSuccessResponse` modifier throws a HttpError", async () => {
        const unsubscribe1 = f.modifiers.beforeSuccessResponse(({ request, response }) => {
            throw new HttpError(request, response);
        });

        const callback1 = vi.fn<Callbacks["onClientError"]>();
        const callback2 = vi.fn<Callbacks["onClientError"]>();
        const unsubscribe2 = f.callbacks.onClientError(callback1);
        const unsubscribe3 = f.callbacks.onClientError(callback2);

        nock(HOST).get("/api/user").reply(200);

        try {
            await f.get(HOST + "/api/user");
            expect(true).toBe(false); // Fail the test if no error is thrown
        } catch (e) {
            //
        }

        expect(callback1).toHaveBeenCalledTimes(0);
        expect(callback2).toHaveBeenCalledTimes(0);

        // cleanup
        unsubscribe1();
        unsubscribe2();
        unsubscribe3();
    });

    test("`onClientError` is not called when a `beforeSuccessResponse` modifier throws a NetworkError", async () => {
        const unsubscribe1 = f.modifiers.beforeSuccessResponse(({ request, response }) => {
            throw new NetworkError(request, response);
        });

        const callback1 = vi.fn<Callbacks["onClientError"]>();
        const callback2 = vi.fn<Callbacks["onClientError"]>();
        const unsubscribe2 = f.callbacks.onClientError(callback1);
        const unsubscribe3 = f.callbacks.onClientError(callback2);

        nock(HOST).get("/api/user").reply(200);

        try {
            await f.get(HOST + "/api/user");
            expect(true).toBe(false); // Fail the test if no error is thrown
        } catch (e) {
            //
        }

        expect(callback1).toHaveBeenCalledTimes(0);
        expect(callback2).toHaveBeenCalledTimes(0);

        // cleanup
        unsubscribe1();
        unsubscribe2();
        unsubscribe3();
    });
});
