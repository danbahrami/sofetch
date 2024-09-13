import nock from "nock";
import { describe, test, expect, beforeAll, afterAll } from "vitest";

import { f, HttpError, JsonParseError, JsonStringifyError, NetworkError } from "../src";

type User = {
    firstName: string;
    lastName: string;
    age: number;
};

const HOST = "http://that-is-so-fetch.com";

describe("f.request()", () => {
    describe("Making requests", () => {
        test("By default it performs a GET request and returns a response", async () => {
            nock(HOST)
                .get("/api/user")
                .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

            const response = await f.request(HOST + "/api/user");
            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(200);
            expect(response.statusText).toBe("OK");
        });

        test("You can provide an HTTP method to make a PUT, POST, PATCH etc. request", async () => {
            nock(HOST)
                .put("/api/user")
                .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

            const response = await f.request(HOST + "/api/user", { method: "put" });
            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(200);
            expect(response.statusText).toBe("OK");
        });

        test("You can pass headers as an object", async () => {
            nock(HOST)
                .matchHeader("Content-Type", "application/text")
                .matchHeader("Accept", "application/text")
                .matchHeader("Foo", "bar")
                .get("/api/user")
                .reply(200);

            await f.request(HOST + "/api/user", {
                headers: {
                    "Content-Type": "application/text",
                    Accept: "application/text",
                    Foo: "bar",
                },
            });
        });

        test("You can pass headers as a Headers instance", async () => {
            nock(HOST)
                .matchHeader("Content-Type", "application/text")
                .matchHeader("Accept", "application/text")
                .matchHeader("Foo", "bar")
                .get("/api/user")
                .reply(200);

            await f.request(HOST + "/api/user", {
                headers: new Headers({
                    "Content-Type": "application/text",
                    Accept: "application/text",
                    Foo: "bar",
                }),
            });
        });

        test("You can pass a full Request instance", async () => {
            nock(HOST)
                .get("/api/user")
                .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

            const request = new Request(HOST + "/api/user");
            const response = await f.request(request);
            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(200);
            expect(response.statusText).toBe("OK");
        });

        test("You can pass a URL instance", async () => {
            nock(HOST)
                .get("/api/user")
                .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

            const response = await f.request(new URL("/api/user", HOST));
            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(200);
            expect(response.statusText).toBe("OK");
        });

        test("When JSON is passed it sends it as the request body", async () => {
            nock(HOST)
                .post("/api/user", { firstName: "Mad Dog", lastName: "Mcrea" })
                .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

            const response = await f.request(HOST + "/api/user", {
                method: "post",
                json: { firstName: "Mad Dog", lastName: "Mcrea" },
            });
            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(200);
            expect(response.statusText).toBe("OK");
        });

        test("When JSON is passed it sets the content-type header to application/json", async () => {
            nock(HOST)
                .post("/api/user", { firstName: "Mad Dog", lastName: "Mcrea" })
                .matchHeader("content-type", "application/json")
                .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

            const response = await f.request(HOST + "/api/user", {
                method: "post",
                json: { firstName: "Mad Dog", lastName: "Mcrea" },
            });
            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(200);
            expect(response.statusText).toBe("OK");
        });

        test("You can override the default content-type header when sending json", async () => {
            nock(HOST)
                .post("/api/user", { firstName: "Mad Dog", lastName: "Mcrea" })
                .matchHeader("content-type", "application/text")
                .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

            const response = await f.request(HOST + "/api/user", {
                method: "post",
                json: { firstName: "Mad Dog", lastName: "Mcrea" },
                headers: {
                    "content-type": "application/text",
                },
            });
            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(200);
            expect(response.statusText).toBe("OK");
        });
    });

    describe("Defaults", () => {
        beforeAll(() => {
            f.configure({
                defaults: {
                    common: {
                        headers: {
                            "common-header": "common",
                            "method-header": "none",
                        },
                    },
                    get: {
                        headers: {
                            "method-header": "get",
                        },
                    },
                    post: {
                        headers: {
                            "method-header": "post",
                        },
                    },
                },
            });
        });

        afterAll(() => {
            f.configure(); // reset
        });

        test("By default it uses the `get` method default init", async () => {
            nock(HOST)
                .get("/api/user")
                .matchHeader("common-header", "common")
                .matchHeader("method-header", "get")
                .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

            const user = await f.request(HOST + "/api/user").json<User>();
            expect(user).toEqual({ firstName: "Shane", lastName: "MacGowan", age: 65 });
        });

        test("When you provide a method it uses that to pick a default init", async () => {
            nock(HOST)
                .post("/api/user")
                .matchHeader("common-header", "common")
                .matchHeader("method-header", "post")
                .twice()
                .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

            const user = await f.request(HOST + "/api/user", { method: "post" }).json<User>();
            const user2 = await f.request(HOST + "/api/user", { method: "POST" }).json<User>();
            expect(user).toEqual({ firstName: "Shane", lastName: "MacGowan", age: 65 });
            expect(user2).toEqual({ firstName: "Shane", lastName: "MacGowan", age: 65 });
        });

        test("When you provide an invalid method it doesnt use any default", async () => {
            nock(HOST)
                .intercept("/api/user", "bloop")
                .matchHeader("common-header", "common")
                .matchHeader("method-header", "none")
                .twice()
                .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

            const user = await f.request(HOST + "/api/user", { method: "bloop" }).json<User>();
            expect(user).toEqual({ firstName: "Shane", lastName: "MacGowan", age: 65 });
        });
    });

    describe("Unwrapping a JSON response", () => {
        test("You can unwrap the JSON response directly on the return promise", async () => {
            nock(HOST)
                .get("/api/user")
                .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

            const user = await f.request(HOST + "/api/user").json<User>();

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
                .request(HOST + "/api/user")
                .then(response => response.json<User>());

            expect(user).toEqual({
                firstName: "Shane",
                lastName: "MacGowan",
                age: 65,
            });
        });
    });

    describe("Errors", () => {
        test("4xx responses throw an HttpError", async () => {
            nock(HOST).get("/api/user").reply(404, "Oh no, that page don't exist baby");

            try {
                await f.request(HOST + "/api/user");
                expect(true).toBe(false); // Fail the test if no error is thrown
            } catch (e) {
                expect(e).toBeInstanceOf(HttpError);

                // Lets check we have everything we need on the error
                const error = e as HttpError;

                expect(error.request).toBeInstanceOf(Request);
                expect(error.request.url).toBe(HOST + "/api/user");
                expect(error.request.method).toBe("GET");

                expect(error.statusCode).toBe(404);
                expect(await error.response.text()).toBe("Oh no, that page don't exist baby");
                expect(error.message).toBe(
                    `Request failed with status code 404 Not Found: GET ${HOST}/api/user`
                );
            }

            // Now we've dived into detail on a single error response lets also
            // check we get an HttpError for other 4xx status codes
            for (const statusCode of [400, 401, 402, 403, 405]) {
                nock(HOST).get("/api/user").reply(statusCode);

                try {
                    await f.request(HOST + "/api/user");
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
                    await f.request(HOST + "/api/user");
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
                await f.request(HOST + "/api/user");
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
                await f.request(HOST + "/api/user").json();

                expect(true).toBe(false); // Fail the test if no error is thrown
            } catch (e) {
                expect(e).toBeInstanceOf(JsonParseError);
            }
        });

        test("Calling Response.json() on a non JSON response body will throw a JsonParseError", async () => {
            nock(HOST).get("/api/user").reply(200, "Oh hello");

            try {
                await f.request(HOST + "/api/user").then(response => response.json());

                expect(true).toBe(false); // Fail the test if no error is thrown
            } catch (e) {
                expect(e).toBeInstanceOf(JsonParseError);
            }
        });

        test("If you try to post non-serializeable JSON data it throws a JsonStringifyError", async () => {
            try {
                await f.request(HOST + "/api/user", {
                    method: "post",
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
            const request = f.request(HOST + "/api/user", {
                method: "post",
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
});
