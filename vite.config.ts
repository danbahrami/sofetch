/// <reference types="vitest" />
import path from "path";
import { defineConfig } from "vite";

const fileName = {
    es: "sofetch.js",
    iife: "sofetch.iife.js",
    cjs: "sofetch.cjs.js",
    umd: "sofetch.umd.js",
};

export default defineConfig({
    base: "./",
    build: {
        outDir: "./build/dist",
        lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            name: "sofetch",
            formats: ["es", "iife", "cjs", "umd"],
            fileName: format => fileName[format],
        },
    },
    test: {
        watch: false,
    },
    resolve: {
        alias: [
            { find: "@", replacement: path.resolve(__dirname, "src") },
            { find: "@@", replacement: path.resolve(__dirname) },
        ],
    },
});
