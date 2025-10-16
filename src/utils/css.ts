/**
 * Template literal tag for CSS syntax highlighting in VSCode
 * This provides proper syntax highlighting for CSS within template literals
 */
export function css(
  strings: TemplateStringsArray,
  ...values: (string | number)[]
): string {
  return String.raw({ raw: strings }, ...values);
}

/**
 * Template literal tag for JavaScript syntax highlighting in VSCode
 * This provides proper syntax highlighting for JS within template literals
 */
export function js(
  strings: TemplateStringsArray,
  ...values: (string | number)[]
): string {
  return String.raw({ raw: strings }, ...values);
}
