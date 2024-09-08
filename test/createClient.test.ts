import nock from "nock";
import { describe, test, expect, vi } from "vitest";

import { createClient } from "../src";
import { Callbacks } from "@/types";

type User = {
    firstName: string;
    lastName: string;
    age: number;
};

const HOST = "http://that-is-so-fetch.com";

describe("createClient", () => {
    test("It creates a client and lets you register some default properties for different requests", async () => {
        nock(HOST)
            .post("/api/user", { id: "6686" })
            .matchHeader("X-CSRF", "token-123")
            .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 })
            .get("/api/user")
            .matchHeader("X-CSRF", "token-456")
            .reply(200, { firstName: "Bob", lastName: "Dylan", age: 83 });

        const f = createClient({
            defaults: {
                request: {
                    method: "POST",
                    headers: {
                        "X-CSRF": "token-123",
                    },
                },
                get: {
                    headers: new Headers({
                        "X-CSRF": "token-456",
                    }),
                },
            },
        });

        const response1 = await f
            .request(HOST + "/api/user", { json: { id: "6686" } })
            .json<User>();
        const response2 = await f.get(HOST + "/api/user").json<User>();

        expect(response1).toEqual({ firstName: "Shane", lastName: "MacGowan", age: 65 });
        expect(response2).toEqual({ firstName: "Bob", lastName: "Dylan", age: 83 });
    });

    test("The order of precedence for configs is common default -> method default -> request", async () => {
        const f = createClient({
            defaults: {
                common: {
                    headers: {
                        "header-1": "common-header-1",
                        "header-2": "common-header-2",
                        "header-3": "common-header-3",
                    },
                },
                get: {
                    headers: {
                        "header-2": "get-header-2",
                        "header-3": "get-header-3",
                        "header-4": "get-header-4",
                    },
                },
            },
        });

        nock(HOST)
            .get("/api/user")
            .matchHeader("header-1", "common-header-1")
            .matchHeader("header-2", "get-header-2")
            .matchHeader("header-3", "request-header-3")
            .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

        const user = await f
            .get(HOST + "/api/user", { headers: { "header-3": "request-header-3" } })
            .json<User>();

        expect(user).toEqual({ firstName: "Shane", lastName: "MacGowan", age: 65 });
    });

    test("You can pass request init factory functions to create a new default init on each request", async () => {
        let requestCount = 0;

        const f = createClient({
            baseUrl: HOST,
            defaults: {
                common: () => ({
                    headers: {
                        "request-count": `${requestCount++}`,
                    },
                }),
            },
        });

        nock(HOST)
            .get("/api/user")
            .matchHeader("request-count", "0")
            .once()
            .reply(200)
            .get("/api/user")
            .matchHeader("request-count", "1")
            .once()
            .reply(200)
            .get("/api/user")
            .matchHeader("request-count", "2")
            .once()
            .reply(200);

        await f.get("/api/user");
        await f.get("/api/user");
        await f.get("/api/user");
    });

    test("It lets you instantiate the client with some built in callbacks", async () => {
        nock(HOST)
            .post("/api/user", { id: "6686" })
            .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

        const onRequestStart1Spy = vi.fn<Callbacks["onRequestStart"]>();
        const onRequestStart2Spy = vi.fn<Callbacks["onRequestStart"]>();
        const onSuccessResponseSpy = vi.fn<Callbacks["onSuccessResponse"]>();

        const f = createClient({
            callbacks: {
                onRequestStart: [onRequestStart1Spy, onRequestStart2Spy],
                onSuccessResponse: [onSuccessResponseSpy],
            },
        });

        await f.post(HOST + "/api/user", { json: { id: "6686" } }).json<User>();

        expect(onRequestStart1Spy).toHaveBeenCalledTimes(1);
        expect(onRequestStart1Spy).toHaveBeenCalledWith({
            request: expect.any(Request),
        });

        expect(onRequestStart2Spy).toHaveBeenCalledTimes(1);
        expect(onRequestStart2Spy).toHaveBeenCalledWith({
            request: expect.any(Request),
        });

        expect(onSuccessResponseSpy).toHaveBeenCalledTimes(1);
        expect(onSuccessResponseSpy).toHaveBeenCalledWith({
            request: expect.any(Request),
            response: expect.any(Response),
        });
    });

    describe("baseUrl", () => {
        test("When you specify a base URL it's used for all requests", async () => {
            nock(HOST)
                .post("/api/org", { id: "6686" })
                .reply(200, { id: "6686", name: "The Pogues" })
                .get("/api/user")
                .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

            const f = createClient({
                baseUrl: HOST,
            });

            const response1 = await f.post("/api/org", { json: { id: "6686" } }).json<User>();
            const response2 = await f.get("/api/user").json<User>();

            expect(response1).toEqual({ id: "6686", name: "The Pogues" });
            expect(response2).toEqual({ firstName: "Shane", lastName: "MacGowan", age: 65 });
        });

        test("It removes additional forward slashes", async () => {
            nock(HOST)
                .post("/api/org", { id: "6686" })
                .reply(200, { id: "6686", name: "The Pogues" })
                .get("/api/user")
                .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

            const f = createClient({
                baseUrl: `${HOST}///`,
            });

            const response1 = await f.post("/api/org", { json: { id: "6686" } }).json<User>();
            const response2 = await f.get("/api/user").json<User>();

            expect(response1).toEqual({ id: "6686", name: "The Pogues" });
            expect(response2).toEqual({ firstName: "Shane", lastName: "MacGowan", age: 65 });
        });

        test("If you provide a full URL as a string to the request it takes precedence of the base URL", async () => {
            nock(HOST)
                .get("/api/user")
                .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

            const f = createClient({
                baseUrl: "http://some-other-url.com",
            });

            const response = await f.get(HOST + "/api/user").json<User>();

            expect(response).toEqual({ firstName: "Shane", lastName: "MacGowan", age: 65 });
        });

        test("If you provide a full URL as a URL instance to the request it takes precedence of the base URL", async () => {
            nock(HOST)
                .get("/api/user")
                .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

            const f = createClient({
                baseUrl: "http://some-other-url.com",
            });

            const response = await f.get(new URL(HOST + "/api/user")).json<User>();

            expect(response).toEqual({ firstName: "Shane", lastName: "MacGowan", age: 65 });
        });

        test("if you pass an invalid base URL it throws TypeError", async () => {
            const f = createClient({
                baseUrl: "some kind of bad string",
            });

            await expect(() => f.get(new URL(HOST + "/api/user"))).rejects.toThrowError(TypeError);
        });
    });
});
