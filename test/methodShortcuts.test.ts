import nock from "nock";
import { describe, test, expect } from "vitest";

import { f } from "../src";

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

    test("If you pass a Request with a different HTTP method, it will overwrite the method to GET", async () => {
        nock(HOST)
            .get("/api/user")
            .reply(200, { firstName: "Shane", lastName: "MacGowan", age: 65 });

        const request = new Request(HOST + "/api/user", { method: "PUT" });

        const response = await f.get(request);
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
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

    test("If you pass a Request with a different HTTP method, it will overwrite the method to POST", async () => {
        nock(HOST)
            .post("/api/user", { firstName: "Mad Dog", lastName: "Mcrea" })
            .reply(200, { id: "567" });

        const request = new Request(HOST + "/api/user", {
            method: "PUT",
            body: JSON.stringify({ firstName: "Mad Dog", lastName: "Mcrea" }),
        });

        const response = await f.post(request);
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
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

    test("If you pass a Request with a different HTTP method, it will overwrite the method to PUT", async () => {
        nock(HOST)
            .put("/api/user", { firstName: "Mad Dog", lastName: "Mcrea" })
            .reply(200, { id: "567" });

        const request = new Request(HOST + "/api/user", {
            method: "PATCH",
            body: JSON.stringify({ firstName: "Mad Dog", lastName: "Mcrea" }),
        });

        const response = await f.put(request);
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
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

    test("If you pass a Request with a different HTTP method, it will overwrite the method to PATCH", async () => {
        nock(HOST)
            .patch("/api/user", { firstName: "Mad Dog", lastName: "Mcrea" })
            .reply(200, { id: "567" });

        const request = new Request(HOST + "/api/user", {
            method: "POST",
            body: JSON.stringify({ firstName: "Mad Dog", lastName: "Mcrea" }),
        });

        const response = await f.patch(request);
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
    });
});

describe("f.delete()", () => {
    test("It performs a DELETE request and returns a response", async () => {
        nock(HOST).delete("/api/user", { id: "4" }).reply(200, { success: true });

        const response = await f.delete(HOST + "/api/user", {
            json: { id: "4" },
        });

        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
        expect(await response.json()).toEqual({ success: true });
    });

    test("If you pass a Request with a different HTTP method, it will overwrite the method to DELETE", async () => {
        nock(HOST).delete("/api/user", { id: "4" }).reply(200, { success: true });

        const request = new Request(HOST + "/api/user", {
            method: "POST",
            body: JSON.stringify({ id: "4" }),
        });

        const response = await f.delete(request);
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
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

    test("If you pass a Request with a different HTTP method, it will overwrite the method to OPTIONS", async () => {
        nock(HOST).options("/api/user").reply(200, { success: true });

        const request = new Request(HOST + "/api/user", { method: "PUT" });

        const response = await f.options(request);
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
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

    test("If you pass a Request with a different HTTP method, it will overwrite the method to HEAD", async () => {
        nock(HOST).head("/api/user").reply(200, { success: true });

        const request = new Request(HOST + "/api/user", { method: "PUT" });

        const response = await f.head(request);
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
    });
});
