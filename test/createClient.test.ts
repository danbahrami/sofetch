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

    test("It lets you instantiate the client with some build in modifiers", async () => {
        nock(HOST)
            .post("/api/user", { id: "6686" })
            .matchHeader("X-CSRF", "token-123")
            .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

        const f = createClient({
            modifiers: {
                beforeRequest: [
                    ({ request }) => {
                        request.headers.set("X-CSRF", "token-123");
                    },
                ],
            },
        });

        const user = await f.post(HOST + "/api/user", { json: { id: "6686" } }).json<User>();

        expect(user).toEqual({ firstName: "Shane", lastName: "MacGowan", age: 65 });
    });
});
