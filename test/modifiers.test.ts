import nock from "nock";
import { describe, test, expect, vi } from "vitest";

import { f, HttpError } from "../src";
import { Callbacks } from "@/types";

const HOST = "http://that-is-so-fetch.com";

describe("beforeRequest()", () => {
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

describe("beforeSuccessResponse()", () => {
    test("It lets you modify the response before its returned", async () => {
        nock(HOST).get("/api/user").reply(200, { id: "567" });

        // Add a modifier which mutates the response and return undefined
        const unsubscribe1 = f.modifiers.beforeSuccessResponse(({ response }) => {
            response.headers.set("test-header-1", "11-11-11");
        });

        // Add a modifier which returns a new response
        const unsubscribe2 = f.modifiers.beforeSuccessResponse(({ response }) => {
            const updated = response.clone();
            updated.headers.set("test-header-2", "22-22-22");
            return updated;
        });

        // Add an async modifier which mutates the response and returns undefined
        const unsubscribe3 = f.modifiers.beforeSuccessResponse(async ({ response }) => {
            await Promise.resolve();
            response.headers.set("test-header-3", "33-33-33");
        });

        // Add an async modifier which returns a new request
        const unsubscribe4 = f.modifiers.beforeSuccessResponse(async ({ response }) => {
            await Promise.resolve();
            const updated = response.clone();
            updated.headers.set("test-header-4", "44-44-44");
            return updated;
        });

        const onSuccessResponseSpy = vi.fn<Callbacks["onSuccessResponse"]>();
        const unsubscribe5 = f.callbacks.onSuccessResponse(onSuccessResponseSpy);

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

describe("beforeErrorResponse()", () => {
    test("It lets you modify the response error before its thrown", async () => {
        nock(HOST).get("/api/user").reply(404);

        // Add a modifier which mutates the error and return undefined
        const unsubscribe1 = f.modifiers.beforeErrorResponse(({ error }) => {
            error.message = "This is not what I had planned";
        });

        const onErrorResponseSpy = vi.fn<Callbacks["onErrorResponse"]>();
        const unsubscribe2 = f.callbacks.onErrorResponse(onErrorResponseSpy);

        try {
            await f.get(HOST + "/api/user");
            expect(true).toBe(false); // Fail the test if no error is thrown
        } catch (e) {
            expect(e).toBeInstanceOf(HttpError);

            const error = e as HttpError;

            expect(error.statusCode).toBe(404);
            expect(error.message).toBe("This is not what I had planned");
        }

        // get the request that was passed to onRequestStart and make sure it
        // has all the modifications we applied
        const e = onErrorResponseSpy.mock.calls[0][0].error;

        expect(e).toBeInstanceOf(HttpError);

        const error = e as HttpError;

        expect(error.statusCode).toBe(404);
        expect(error.message).toBe("This is not what I had planned");

        unsubscribe1();
        unsubscribe2();
    });
});
