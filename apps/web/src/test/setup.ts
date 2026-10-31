/** Vitest 全局 setup：接入 jest-dom 断言并在每个用例后清理 DOM。 */

/// <reference types="vitest" />
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/** 非 globals 模式下 testing-library 不自动清理，必须显式接上。 */
afterEach(cleanup);
