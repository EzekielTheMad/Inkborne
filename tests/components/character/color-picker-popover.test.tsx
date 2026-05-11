import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorPickerPopover } from "@/components/character/color-picker-popover";

function renderPicker(overrides?: Partial<React.ComponentProps<typeof ColorPickerPopover>>) {
  const onChange = vi.fn();
  const utils = render(
    <ColorPickerPopover
      currentColor={null}
      onChange={onChange}
      {...overrides}
    >
      <button type="button">avatar</button>
    </ColorPickerPopover>,
  );
  return { onChange, ...utils };
}

describe("<ColorPickerPopover>", () => {
  it("renders the trigger children", () => {
    renderPicker();
    expect(screen.getByText("avatar")).toBeInTheDocument();
  });

  it("commits a preset hex on click", async () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByText("avatar"));
    const purpleBtn = await screen.findByLabelText(/Set character color to Purple/i);
    fireEvent.click(purpleBtn);
    expect(onChange).toHaveBeenCalledWith("#7c3aed");
  });

  it("commits a valid hex from the text input on blur", async () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByText("avatar"));
    const input = await screen.findByPlaceholderText("#xxxxxx");
    fireEvent.change(input, { target: { value: "#abc123" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith("#abc123");
  });

  it("flags an invalid hex via aria-invalid and does not commit", async () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByText("avatar"));
    const input = await screen.findByPlaceholderText("#xxxxxx");
    fireEvent.change(input, { target: { value: "not-hex" } });
    fireEvent.blur(input);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits null on Reset", async () => {
    const { onChange } = renderPicker({ currentColor: "#7c3aed" });
    fireEvent.click(screen.getByText("avatar"));
    const resetBtn = await screen.findByLabelText(/Reset character color/i);
    fireEvent.click(resetBtn);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("native color picker commits once on blur, not on every change", async () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByText("avatar"));
    // The native input is hidden inside the label; find it by type
    const nativeInput = document.querySelector('input[type="color"]') as HTMLInputElement;
    expect(nativeInput).toBeTruthy();
    fireEvent.change(nativeInput, { target: { value: "#11aa22" } });
    fireEvent.change(nativeInput, { target: { value: "#22bb33" } });
    fireEvent.change(nativeInput, { target: { value: "#33cc44" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(nativeInput);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("#33cc44");
  });

  it("commits a bare 6-char hex (no leading #) by normalizing with #", async () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByText("avatar"));
    const input = await screen.findByPlaceholderText("#xxxxxx");
    fireEvent.change(input, { target: { value: "abc123" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith("#abc123");
  });
});
