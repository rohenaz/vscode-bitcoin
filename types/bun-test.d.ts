declare module 'bun:test' {
  export interface TestContext {
    name: string;
    meta: Record<string, unknown>;
  }

  export type TestFunction = (t: TestContext) => void | Promise<void>;

  export interface TestOptions {
    name?: string;
    timeout?: number;
    skip?: boolean;
    only?: boolean;
  }

  export interface DescribeOptions {
    name?: string;
    skip?: boolean;
    only?: boolean;
  }

  export interface ExpectResult {
    pass: boolean;
    message: string;
  }

  export interface Expect {
    (value: unknown): Matchers;
    extend(matchers: Record<string, unknown>): void;
  }

  export interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeNull(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeGreaterThan(expected: number): void;
    toBeLessThan(expected: number): void;
    toContain(expected: unknown): void;
    toThrow(expected?: string | RegExp): void;
    toHaveLength(expected: number): void;
    toHaveProperty(property: string, value?: unknown): void;
    toMatch(expected: RegExp): void;
    toMatchObject(expected: object): void;
    resolves: Matchers;
    rejects: Matchers;
  }

  export const expect: Expect;
  export const describe: (
    name: string,
    fn: () => void,
    options?: DescribeOptions
  ) => void;
  export const test: (
    name: string,
    fn: TestFunction,
    options?: TestOptions
  ) => void;
  export const it: typeof test;
  export const beforeAll: (fn: () => void | Promise<void>) => void;
  export const afterAll: (fn: () => void | Promise<void>) => void;
  export const beforeEach: (fn: () => void | Promise<void>) => void;
  export const afterEach: (fn: () => void | Promise<void>) => void;
}
