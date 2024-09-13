/// <reference types="vitest" />
import path from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const fileName = {
    es: "index.js",
    iife: "index.iife.js",
    cjs: "index.cjs.js",
    umd: "index.umd.js",
};

export default defineConfig({
    base: "./",
    build: {
        outDir: "./dist",
        lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            name: "sofetch",
            formats: ["es", "iife", "cjs", "umd"],
            fileName: format => fileName[format],
        },
    },
    plugins: [dts({ rollupTypes: true })],
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
