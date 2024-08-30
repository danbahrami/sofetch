import nock from "nock";
import { describe, test, expect, vi } from "vitest";

import {
    f,
    HttpError,
    JsonParseError,
    JsonStringifyError,
    NetworkError,
} from "../src";
import { Callbacks } from "@/types";

type User = {
    firstName: string;
    lastName: string;
    age: number;
};

const mockConsoleError = () => {
    return vi.spyOn(console, "error").mockImplementation(() => null);
};

const HOST = "http://that-is-so-fetch.com";

describe("f.get()", () => {
    test("It performs a GET request and returns a response", async () => {
        nock(HOST)
            .get("/api/user")
            .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

        const response = await f.get(HOST + "/api/user");
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
    });

    test("You can unwrap the JSON response directly on the return promise", async () => {
        nock(HOST)
            .get("/api/user")
            .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

        const user = await f.get(HOST + "/api/user").json<User>();

        expect(user).toEqual({
            firstName: "Shane",
            lastName: "MacGowan",
            age: 65,
        });
    });

    test("You can unwrap the JSON response on the response instance", async () => {
        nock(HOST)
            .get("/api/user")
            .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

        const user = await f
            .get(HOST + "/api/user")
            .then(response => response.json<User>());

        expect(user).toEqual({
            firstName: "Shane",
            lastName: "MacGowan",
            age: 65,
        });
    });

    test("4xx responses throw an HttpError", async () => {
        nock(HOST)
            .get("/api/user")
            .reply(404, "Oh no, that page don't exist baby");

        try {
            await f.get(HOST + "/api/user");
            expect(true).toBe(false); // Fail the test if no error is thrown
        } catch (e) {
            expect(e).toBeInstanceOf(HttpError);

            // Lets check we have everything we need on the error
            const error = e as HttpError;

            expect(error.request).toBeInstanceOf(Request);
            expect(error.request.url).toBe(HOST + "/api/user");
            expect(error.request.method).toBe("GET");

            expect(error.statusCode).toBe(404);
            expect(await error.response.text()).toBe(
                "Oh no, that page don't exist baby"
            );
            expect(error.message).toBe(
                `Request failed with status code 404 Not Found: GET ${HOST}/api/user`
            );
        }

        // Now we've dived into detail on a single error response lets also
        // check we get an HttpError for other 4xx status codes
        for (const statusCode of [400, 401, 402, 403, 405]) {
            nock(HOST).get("/api/user").reply(statusCode);

            try {
                await f.get(HOST + "/api/user");
                expect(true).toBe(false); // Fail the test if no error is thrown
            } catch (error) {
                expect(error).toBeInstanceOf(HttpError);
            }
        }
    });

    test("5xx responses throw an HttpError", async () => {
        for (const statusCode of [500, 501, 502, 503, 505]) {
            nock(HOST).get("/api/user").reply(statusCode);

            try {
                await f.get(HOST + "/api/user");
                expect(true).toBe(false); // Fail the test if no error is thrown
            } catch (error) {
                expect(error).toBeInstanceOf(HttpError);
            }
        }
    });

    test("Network errors will throw a NetworkError", async () => {
        const err = new Error("something bad happened");

        nock(HOST).get("/api/user").replyWithError(err);

        try {
            await f.get(HOST + "/api/user");
            expect(true).toBe(false); // Fail the test if no error is thrown
        } catch (e) {
            expect(e).toBeInstanceOf(NetworkError);

            // Lets check we have everything we need on the error
            const error = e as NetworkError;

            expect(error.request.url).toBe(HOST + "/api/user");
            expect(error.request.method).toBe("GET");
        }
    });

    test("Calling .json() on a non JSON response will throw a JsonParseError", async () => {
        nock(HOST).get("/api/user").reply(200, "Oh hello");

        try {
            await f.get(HOST + "/api/user").json();

            expect(true).toBe(false); // Fail the test if no error is thrown
        } catch (e) {
            expect(e).toBeInstanceOf(JsonParseError);
        }
    });

    test("Calling Response.json() on a non JSON response body will throw a JsonParseError", async () => {
        nock(HOST).get("/api/user").reply(200, "Oh hello");

        try {
            await f.get(HOST + "/api/user").then(response => response.json());

            expect(true).toBe(false); // Fail the test if no error is thrown
        } catch (e) {
            expect(e).toBeInstanceOf(JsonParseError);
        }
    });

    test("You can set headers", async () => {
        nock(HOST)
            .matchHeader("Content-Type", "application/text")
            .matchHeader("Accept", "application/text")
            .matchHeader("Foo", "bar")
            .get("/api/user")
            .reply(200);

        await f.get(HOST + "/api/user", {
            headers: {
                "Content-Type": "application/text",
                Accept: "application/text",
                Foo: "bar",
            },
        });
    });
});

describe("f.post()", () => {
    test("It performs a POST request and returns a response", async () => {
        nock(HOST)
            .post("/api/user", { firstName: "Mad Dog", lastName: "Mcrea" })
            .reply(200, { id: "567" });

        const response = await f.post(HOST + "/api/user", {
            json: { firstName: "Mad Dog", lastName: "Mcrea" },
        });
        const body = await response.json();

        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
        expect(body).toEqual({ id: "567" });
    });

    test("If you try to post non-serializeable JSON data it throws a JsonStringifyError", async () => {
        nock(HOST).post("/api/user").reply(200, { id: "567" });

        try {
            await f.post(HOST + "/api/user", {
                json: {
                    // JS doesn't know how to parse a BigInt into JSON
                    userId: BigInt(9007199254740991),
                },
            });
            // Fail the test if no error is thrown
            expect(true).toBe(false);
        } catch (e) {
            expect(e).toBeInstanceOf(JsonStringifyError);

            const error = e as JsonStringifyError;
            expect(error.request.url).toBe(HOST + "/api/user");
            expect(error.request.method).toBe("POST");
        }
    });

    test("JsonStringifyError when you await the request, not when you make the request", async () => {
        nock(HOST).post("/api/user").reply(200, { id: "567" });

        const request = f.post(HOST + "/api/user", {
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
    test("It performs a PUT request and returns a response", async () => {
        nock(HOST)
            .put("/api/user", { firstName: "Mad Dog", lastName: "Mcrea" })
            .reply(200, { id: "567" });

        const response = await f.put(HOST + "/api/user", {
            json: { firstName: "Mad Dog", lastName: "Mcrea" },
        });

        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
        expect(await response.json()).toEqual({ id: "567" });
    });
});

describe("f.patch()", () => {
    test("It performs a PATCH request and returns a response", async () => {
        nock(HOST)
            .patch("/api/user", { firstName: "Mad Dog", lastName: "Mcrea" })
            .reply(200, { id: "567" });

        const response = await f.patch(HOST + "/api/user", {
            json: { firstName: "Mad Dog", lastName: "Mcrea" },
        });

        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
        expect(await response.json()).toEqual({ id: "567" });
    });
});

describe("f.delete()", () => {
    test("It performs a DELETE request and returns a response", async () => {
        nock(HOST)
            .delete("/api/user", { id: "4" })
            .reply(200, { success: true });

        const response = await f.delete(HOST + "/api/user", {
            json: { id: "4" },
        });

        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
        expect(await response.json()).toEqual({ success: true });
    });
});

describe("f.options()", () => {
    test("It performs an OPTIONS request and returns a response", async () => {
        nock(HOST).options("/api/user").reply(200, { success: true });

        const response = await f.options(HOST + "/api/user");

        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
        expect(await response.json()).toEqual({ success: true });
    });
});

describe("f.head()", () => {
    test("It performs an HEAD request and returns a response", async () => {
        nock(HOST).head("/api/user").reply(200, { success: true });

        const response = await f.head(HOST + "/api/user");

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

describe("onSuccessResponse callback", () => {
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

        nock(HOST)
            .get("/api/user?workspace=3")
            .replyWithError(new Error("something bad happened"));

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

describe("onErrorResponse callback", () => {
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

        nock(HOST)
            .get("/api/user?workspace=3")
            .replyWithError(new Error("something bad happened"));

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

describe("onJsonParseError callback", () => {
    test("all `onJsonParseError` callbacks are called when calling .json() on a non-JSON response", async () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const unsubscribe1 = f.callbacks.onJsonParseError(callback1);
        const unsubscribe2 = f.callbacks.onJsonParseError(callback2);

        nock(HOST).get("/api/user").reply(200, "Oh hello");

        try {
            await f.get(HOST + "/api/user").json();
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

        nock(HOST).get("/api/user").reply(200, "Oh hello");

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

        unsubscribe1();
        unsubscribe2();
    });

    test("`onJsonStringifyError` is not called when valid JSON is passed", async () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const unsubscribe1 = f.callbacks.onJsonStringifyError(callback1);
        const unsubscribe2 = f.callbacks.onJsonStringifyError(callback2);

        nock(HOST).get("/api/user").reply(200, "Oh hello");

        try {
            await f.post(HOST + "/api/user", {
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

describe("beforeRequest modifier", () => {
    test("It lets you modify the request before its sent", async () => {
        nock(HOST)
            .post("/api/user")
            .matchHeader("test-header-0", "00-00-00")
            .matchHeader("test-header-1", "11-11-11")
            .matchHeader("test-header-2", "22-22-22")
            .reply(200, { id: "567" });

        // Add a modifier which mutates the request and return undefined
        const unsubscribe1 = f.modifiers.beforeRequest(({ request }) => {
            request.headers.set("test-header-1", "11-11-11");
        });

        // Add a modifier which returns a new request
        const unsubscribe2 = f.modifiers.beforeRequest(({ request }) => {
            return new Request(request, { method: "POST" });
        });

        // Add an async modifier which mutates the request and returns undefined
        const unsubscribe3 = f.modifiers.beforeRequest(async ({ request }) => {
            await Promise.resolve();
            request.headers.set("test-header-2", "22-22-22");
        });

        // Add an async modifier which returns a new request
        const unsubscribe4 = f.modifiers.beforeRequest(async ({ request }) => {
            await Promise.resolve();
            return new Request(HOST + "/api/user", {
                method: request.method,
                headers: request.headers,
            });
        });

        const onRequestStartSpy = vi.fn<Callbacks["onRequestStart"]>();
        const unsubscribe5 = f.callbacks.onRequestStart(onRequestStartSpy);

        await f.get(HOST + "/api/organisation", {
            headers: {
                "test-header-0": "00-00-00",
            },
        });

        // get the request that was passed to onRequestStart and make sure it
        // has all the modifications we applied
        const r = onRequestStartSpy.mock.calls[0][0].request;
        expect(r.method).toBe("POST");
        expect(r.url).toBe(HOST + "/api/user");
        expect(r.headers.get("test-header-0")).toBe("00-00-00");
        expect(r.headers.get("test-header-1")).toBe("11-11-11");
        expect(r.headers.get("test-header-2")).toBe("22-22-22");

        unsubscribe1();
        unsubscribe2();
        unsubscribe3();
        unsubscribe4();
        unsubscribe5();
    });
});

describe("beforeSuccessResponse modifier", () => {
    test("It lets you modify the response before its returned", async () => {
        nock(HOST).get("/api/user").reply(200, { id: "567" });

        // Add a modifier which mutates the response and return undefined
        const unsubscribe1 = f.modifiers.beforeSuccessResponse(
            ({ response }) => {
                response.headers.set("test-header-1", "11-11-11");
            }
        );

        // Add a modifier which returns a new response
        const unsubscribe2 = f.modifiers.beforeSuccessResponse(
            ({ response }) => {
                const updated = response.clone();
                updated.headers.set("test-header-2", "22-22-22");
                return updated;
            }
        );

        // Add an async modifier which mutates the response and returns undefined
        const unsubscribe3 = f.modifiers.beforeSuccessResponse(
            async ({ response }) => {
                await Promise.resolve();
                response.headers.set("test-header-3", "33-33-33");
            }
        );

        // Add an async modifier which returns a new request
        const unsubscribe4 = f.modifiers.beforeSuccessResponse(
            async ({ response }) => {
                await Promise.resolve();
                const updated = response.clone();
                updated.headers.set("test-header-4", "44-44-44");
                return updated;
            }
        );

        const onSuccessResponseSpy = vi.fn<Callbacks["onSuccessResponse"]>();
        const unsubscribe5 =
            f.callbacks.onSuccessResponse(onSuccessResponseSpy);

        const response = await f.get(HOST + "/api/user");

        expect(response.status).toBe(200);
        expect(response.headers.get("test-header-1")).toBe("11-11-11");
        expect(response.headers.get("test-header-2")).toBe("22-22-22");
        expect(response.headers.get("test-header-3")).toBe("33-33-33");
        expect(response.headers.get("test-header-4")).toBe("44-44-44");

        // get the request that was passed to onRequestStart and make sure it
        // has all the modifications we applied
        const spyResponse = onSuccessResponseSpy.mock.calls[0][0].response;

        expect(spyResponse.status).toBe(200);
        expect(spyResponse.headers.get("test-header-1")).toBe("11-11-11");
        expect(spyResponse.headers.get("test-header-2")).toBe("22-22-22");
        expect(spyResponse.headers.get("test-header-3")).toBe("33-33-33");
        expect(spyResponse.headers.get("test-header-4")).toBe("44-44-44");

        unsubscribe1();
        unsubscribe2();
        unsubscribe3();
        unsubscribe4();
        unsubscribe5();
    });
});
