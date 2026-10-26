import { expect, type Locator } from "@playwright/test";

// Solid surfaces and every 5% of the identity band's explicit sRGB gradient.
// Other background images remain unsupported rather than silently skipped.
async function expectRenderedContrast(
  locator: Locator,
  options: { placeholder?: boolean; boundary?: boolean; focus?: boolean; graphical?: boolean } = {},
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
    const surface = (start: Element | null): Color[] => {
      let result: Color[] = [[0, 0, 0, 0]];
      for (let current = start; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (Number(style.opacity) !== 1) throw new Error("Contrast helper requires an opaque compositing context.");
        let backgrounds = [color(style.backgroundColor)];
        if (style.backgroundImage !== "none") {
          // Chromium can omit the default interpolation space when serializing.
          const gradient = style.backgroundImage.match(/^linear-gradient\(120deg(?: in srgb)?, (rgb\([^)]+\)) 0%, (rgb\([^)]+\)) 100%\)$/);
          if (!gradient) throw new Error(`Unsupported contrast background: ${style.backgroundImage}`);
          const first = color(gradient[1]), last = color(gradient[2]);
          backgrounds = Array.from({ length: 21 }, (_, step) => first.map((value, index) =>
            value + (last[index] - value) * step / 20,
          ) as Color);
        }
        result = result.flatMap(front => backgrounds.map(back => over(front, back)));
        if (result.every(sample => sample[3] >= .999)) return result;
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
      text: Math.min(...background.map(sample => contrast(over(foreground, sample), sample))),
      boundary: flags.boundary ? Math.min(...outside.map(sample => contrast(over(color(style.borderTopColor), sample), sample))) : null,
      borderWidth: parseFloat(style.borderTopWidth),
      borderStyle: style.borderTopStyle,
      focus: flags.focus ? Math.min(...outside.map(sample => contrast(over(color(style.outlineColor), sample), sample))) : null,
      outlineWidth: parseFloat(style.outlineWidth),
      outlineStyle: style.outlineStyle,
      outlineOffset: parseFloat(style.outlineOffset),
      focusVisible: element.matches(":focus-visible"),
    };
  }, options);
  const description = `${await locator.getAttribute("id") ?? await locator.textContent() ?? "sheet control"}${options.placeholder ? " placeholder" : ""}`;
  if (!options.graphical) expect(measured.text, `${description}: rendered text contrast`).toBeGreaterThanOrEqual(4.5);
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

export { expectRenderedContrast };
