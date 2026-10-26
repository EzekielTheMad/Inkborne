import { expect, type Locator, type Page } from "@playwright/test";

// These measurements target solid auth reading/form surfaces. They do not claim
// to assess the notebook's decorative texture, disabled controls, or icon art.
async function expectRenderedContrast(
  locator: Locator,
  options: { placeholder?: boolean; boundary?: boolean; focus?: boolean } = {},
) {
  const measured = await locator.evaluate((element, flags) => {
    type Color = [number, number, number, number];
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    const color = (css: string): Color => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = css;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
      return [r / 255, g / 255, b / 255, alpha / 255];
    };
    const over = (front: Color, back: Color): Color => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      if (alpha === 0) return [0, 0, 0, 0];
      return [
        (front[0] * front[3] + back[0] * back[3] * (1 - front[3])) / alpha,
        (front[1] * front[3] + back[1] * back[3] * (1 - front[3])) / alpha,
        (front[2] * front[3] + back[2] * back[3] * (1 - front[3])) / alpha,
        alpha,
      ];
    };
    const surface = (start: Element | null): Color => {
      let result: Color = [0, 0, 0, 0];
      for (let current = start; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (Number(style.opacity) !== 1 || style.backgroundImage !== "none") {
          throw new Error("Contrast helper requires an opaque compositing context without background images.");
        }
        result = over(result, color(style.backgroundColor));
        if (result[3] >= .999) return result;
      }
      throw new Error("No opaque background found for contrast measurement.");
    };
    const luminance = (value: Color) => {
      const linear = value.slice(0, 3).map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
      return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
    };
    const contrast = (first: Color, second: Color) => {
      const a = luminance(first), b = luminance(second);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    };
    const style = getComputedStyle(element);
    const background = surface(element);
    const textStyle = flags.placeholder ? getComputedStyle(element, "::placeholder") : style;
    const foreground = color(textStyle.color);
    foreground[3] *= Number(textStyle.opacity);
    const outside = surface(element.parentElement);
    return {
      text: contrast(over(foreground, background), background),
      boundary: flags.boundary ? contrast(over(color(style.borderTopColor), outside), outside) : null,
      borderWidth: parseFloat(style.borderTopWidth),
      borderStyle: style.borderTopStyle,
      focus: flags.focus ? contrast(over(color(style.outlineColor), outside), outside) : null,
      outlineWidth: parseFloat(style.outlineWidth),
      outlineStyle: style.outlineStyle,
      outlineOffset: parseFloat(style.outlineOffset),
      focusVisible: element.matches(":focus-visible"),
    };
  }, options);
  const description = `${await locator.getAttribute("id") ?? await locator.textContent() ?? "auth control"}${options.placeholder ? " placeholder" : ""}`;
  expect(measured.text, `${description}: rendered text contrast`).toBeGreaterThanOrEqual(4.5);
  if (options.boundary) {
    expect(measured.borderWidth, `${description}: visible boundary`).toBeGreaterThan(0);
    expect(measured.borderStyle).not.toBe("none");
    expect(measured.boundary, `${description}: boundary against adjacent surface`).toBeGreaterThanOrEqual(3);
  }
  if (options.focus) {
    expect(measured.focusVisible, `${description}: keyboard focus state`).toBe(true);
    expect(measured.outlineWidth, `${description}: focus outline width`).toBeGreaterThanOrEqual(3);
    expect(measured.outlineStyle).not.toBe("none");
    expect(measured.outlineOffset).toBeGreaterThanOrEqual(0);
    expect(measured.focus, `${description}: focus against adjacent surface`).toBeGreaterThanOrEqual(3);
  }
}

// Invoke on the existing /signup layout case at width 1440 for each theme. It
// samples normal controls, their hover treatment, and actual keyboard focus.
async function expectAuthFormContrast(page: Page) {
  const settle = async (locator: Locator) => locator.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {})));
  });
  for (const input of await page.locator("main input").all()) {
    if (!await input.isVisible()) continue;
    await expectRenderedContrast(input, { boundary: true });
    if (await input.getAttribute("placeholder")) {
      await expectRenderedContrast(input, { placeholder: true });
    }
  }
  for (const label of await page.locator("main label").all()) await expectRenderedContrast(label);
  const oauth = page.getByRole("button", { name: "Continue with Google", exact: true });
  await expectRenderedContrast(oauth, { boundary: true });
  await oauth.hover();
  await settle(oauth);
  await expectRenderedContrast(oauth, { boundary: true });
  const submit = page.locator('button[type="submit"]');
  await page.mouse.move(0, 0);
  await expectRenderedContrast(submit);
  await submit.hover();
  await settle(submit);
  await expectRenderedContrast(submit);
  await page.keyboard.press("Tab");
  const field = page.locator("main input:visible").first();
  await field.focus();
  await expectRenderedContrast(field, { boundary: true, focus: true });
  await submit.focus();
  await expectRenderedContrast(submit, { focus: true });
  await page.mouse.move(0, 0);
}

export { expectAuthFormContrast, expectRenderedContrast };
