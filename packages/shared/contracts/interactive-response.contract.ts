import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { INTERACTIVE_OTHER_ID, type ChaiEvent, type InteractiveAnswer, type InteractiveElement } from "@chai-ui/core";
import { wcagViolations } from "./axe.js";
import type { Render } from "./render.js";

/** React-shaped InteractiveResponse props: `onAnswer` and `onEvent` are `@answer` and `@event` in Vue. */
export type InteractiveResponseProps = {
  text?: string;
  element: InteractiveElement;
  answer?: InteractiveAnswer | null;
  onAnswer?: (answer: InteractiveAnswer) => void;
  onEvent?: (event: ChaiEvent) => void;
};

const ACTION: InteractiveElement = { type: "action", label: "Run migration" };
const CONFIRM: InteractiveElement = { type: "action", label: "Create table", confirm: true, declineLabel: "Cancel" };
const CHOICE: InteractiveElement = {
  type: "choice",
  allowOther: true,
  options: [
    { id: "slack", label: "Slack", description: "The on-call channel" },
    { id: "email", label: "Email" },
  ],
};
const MULTI: InteractiveElement = { ...CHOICE, multiple: true, allowOther: false };
const CARDS: InteractiveElement = {
  type: "choice",
  display: "cards",
  options: [
    { id: "strict", label: "Strict", description: "Any failure" },
    { id: "relaxed", label: "Relaxed", image: "data:image/gif;base64,R0lGODlhAQABAAAAACw=" },
  ],
};
const FORM: InteractiveElement = {
  type: "form",
  submitLabel: "Continue",
  fields: [
    { id: "provider", label: "Cloud provider", kind: "select", required: true, options: ["AWS", "Azure"] },
    { id: "table", label: "Table name", required: true, placeholder: "user_sessions" },
    { id: "notes", label: "Notes", kind: "textarea" },
  ],
};
const MEDIA: InteractiveElement = { type: "media", accept: ["image"], max: 2, skipLabel: "Skip" };

const answeredLabel = () => document.querySelector(".chai-interactive__answered")?.textContent?.trim();
const locked = () => document.querySelector(".chai-interactive--locked") !== null;

export function interactiveResponseContract(render: Render<InteractiveResponseProps>) {
  let screen: ReturnType<Render<InteractiveResponseProps>> | null = null;
  afterEach(() => {
    screen?.unmount();
    screen = null;
    vi.restoreAllMocks();
  });

  const show = (element: InteractiveElement, extra: Partial<InteractiveResponseProps> = {}) => {
    const onAnswer = vi.fn();
    const onEvent = vi.fn();
    screen = render({ text: "Pick one.", element, onAnswer, onEvent, ...extra });
    return { screen, onAnswer, onEvent };
  };

  describe("InteractiveResponse", () => {
    it("shows the agent's words above the element and reports it shown once", async () => {
      const { screen, onEvent } = show(ACTION);
      await expect.element(screen.getByText("Pick one.")).toBeInTheDocument();
      await expect.poll(() => onEvent.mock.calls.length).toBe(1);
      expect(onEvent).toHaveBeenCalledWith({ name: "chai_interactive_shown", properties: { element_type: "action" } });
    });

    it("answers a call to action once, then locks with a label", async () => {
      const { screen, onAnswer, onEvent } = show(ACTION);
      await screen.getByRole("button", { name: "Run migration" }).click();
      expect(onAnswer).toHaveBeenCalledExactlyOnceWith({ type: "action", decision: "accepted" });
      await expect.poll(answeredLabel).toBe("You clicked Run migration");
      await expect.element(screen.getByRole("button", { name: "Run migration" })).toBeDisabled();
      expect(onEvent).toHaveBeenLastCalledWith({
        name: "chai_interactive_answered",
        properties: { element_type: "action", decision: "accepted" },
      });
      expect(await wcagViolations()).toEqual([]);
    });

    it("approves or declines, and locks on the choice made", async () => {
      const { screen, onAnswer } = show(CONFIRM);
      expect(await wcagViolations()).toEqual([]);
      await screen.getByRole("button", { name: "Cancel" }).click();
      expect(onAnswer).toHaveBeenCalledExactlyOnceWith({ type: "action", decision: "declined" });
      await expect.poll(answeredLabel).toBe("You clicked Cancel");
      await expect.element(screen.getByRole("button", { name: "Create table" })).toBeDisabled();
    });

    it("keeps Send off until a pick, and Other needs its text", async () => {
      const { screen, onAnswer } = show(CHOICE);
      const send = screen.getByRole("button", { name: "Send" });
      await expect.element(send).toBeDisabled();
      expect(await wcagViolations()).toEqual([]);
      await screen.getByText("Other").click();
      await expect.element(send).toBeDisabled();
      await userEvent.fill(screen.getByRole("textbox", { name: "Other" }), "Teams");
      await expect.element(send).toBeEnabled();
      await send.click();
      expect(onAnswer).toHaveBeenCalledExactlyOnceWith({ type: "choice", selected: [INTERACTIVE_OTHER_ID], other: "Teams" });
      await expect.poll(answeredLabel).toBe("You chose Teams");
      expect(locked()).toBe(true);
    });

    it("picks one with radio buttons", async () => {
      const one = show(CHOICE);
      await one.screen.getByText("Slack").click();
      await one.screen.getByText("Email").click();
      await expect.element(one.screen.getByRole("radio", { name: /Email/ })).toBeChecked();
      await expect.element(one.screen.getByRole("radio", { name: /Slack/ })).not.toBeChecked();
    });

    it("picks several with checkboxes, which stay as chosen once locked", async () => {
      const several = show(MULTI);
      await several.screen.getByRole("checkbox", { name: /Slack/ }).click();
      await several.screen.getByText("Email").click();
      await several.screen.getByRole("button", { name: "Send" }).click();
      expect(several.onAnswer).toHaveBeenCalledWith({ type: "choice", selected: ["slack", "email"] });
      await expect.poll(answeredLabel).toBe("You chose Slack and Email");
      // Locked: the chosen boxes stay checked, and the options take no clicks.
      await expect.element(several.screen.getByRole("checkbox", { name: /Slack/ })).toBeChecked();
      expect(getComputedStyle(document.querySelector(".chai-interactive__option")!).pointerEvents).toBe("none");
      expect(several.onAnswer).toHaveBeenCalledTimes(1);
    });

    it("shows choice cards with descriptions and images, pressed when picked", async () => {
      const { screen, onAnswer, onEvent } = show(CARDS);
      expect(await wcagViolations()).toEqual([]);
      const strict = screen.getByRole("button", { name: /Strict/ });
      await strict.click();
      await expect.element(strict).toHaveAttribute("aria-pressed", "true");
      await screen.getByRole("button", { name: "Send" }).click();
      expect(onAnswer).toHaveBeenCalledWith({ type: "choice", selected: ["strict"] });
      expect(onEvent).toHaveBeenLastCalledWith({
        name: "chai_interactive_answered",
        properties: { element_type: "choice", picked_count: 1, other: false, multiple: false, display: "cards" },
      });
      await expect.element(strict).toBeDisabled();
      expect(document.querySelector(".chai-interactive__card-image")).not.toBeNull();
    });

    it("sends a form once its required fields are filled, with the dropdown named by its label", async () => {
      const { screen, onAnswer } = show(FORM);
      const send = screen.getByRole("button", { name: "Continue" });
      await expect.element(send).toBeDisabled();
      expect(await wcagViolations()).toEqual([]);
      await screen.getByText("Cloud provider").click();
      await screen.getByRole("button", { name: "AWS" }).click();
      await userEvent.fill(screen.getByRole("textbox", { name: /Table name/ }), "user_sessions");
      await userEvent.fill(screen.getByRole("textbox", { name: "Notes" }), "Hot path");
      await expect.element(send).toBeEnabled();
      await send.click();
      expect(onAnswer).toHaveBeenCalledExactlyOnceWith({
        type: "form",
        values: { provider: "AWS", table: "user_sessions", notes: "Hot path" },
      });
      await expect.poll(answeredLabel).toBe("You sent the form");
      await expect.element(screen.getByRole("textbox", { name: /Table name/ })).toBeDisabled();
    });

    it("takes files through the drop zone, up to its limit, and can be skipped", async () => {
      const { screen, onAnswer } = show(MEDIA);
      const send = screen.getByRole("button", { name: "Send" });
      await expect.element(send).toBeDisabled();
      expect(await wcagViolations()).toEqual([]);
      const input = document.querySelector<HTMLInputElement>(".chai-interactive__dropzone input[type=file]")!;
      expect(input.accept).toBe("image/*");
      const png = (name: string) => new File(["x"], name, { type: "image/png" });
      await userEvent.upload(input, [png("a.png"), png("b.png"), new File(["x"], "c.pdf", { type: "application/pdf" })]);
      await expect.element(screen.getByText("a.png")).toBeInTheDocument();
      await screen.getByRole("button", { name: "Remove a.png" }).click();
      await expect.element(screen.getByText("a.png")).not.toBeInTheDocument();
      await send.click();
      expect(onAnswer.mock.calls[0]?.[0]).toMatchObject({ type: "media", files: [{ name: "b.png" }] });
      await expect.poll(answeredLabel).toBe("You added b.png");
    });

    it("takes a dropped file, highlights while dragging, and opens the picker from the keyboard", async () => {
      const { screen, onAnswer } = show(MEDIA);
      const zone = document.querySelector<HTMLElement>(".chai-interactive__dropzone")!;
      const input = zone.querySelector<HTMLInputElement>("input[type=file]")!;
      const opened = vi.spyOn(input, "click").mockImplementation(() => {});
      zone.focus();
      await userEvent.keyboard("{Enter}");
      await userEvent.keyboard(" ");
      zone.click();
      expect(opened).toHaveBeenCalledTimes(3);

      const transfer = new DataTransfer();
      transfer.items.add(new File(["x"], "drop.png", { type: "image/png" }));
      zone.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
      await expect.poll(() => zone.classList.contains("chai-interactive__dropzone--drag-active")).toBe(true);
      zone.dispatchEvent(new DragEvent("dragleave", { bubbles: true }));
      await expect.poll(() => zone.classList.contains("chai-interactive__dropzone--drag-active")).toBe(false);
      zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
      await expect.element(screen.getByText("drop.png")).toBeInTheDocument();
      await screen.getByRole("button", { name: "Send" }).click();
      expect(onAnswer.mock.calls[0]?.[0]).toMatchObject({ type: "media", files: [{ name: "drop.png" }] });
    });

    it("sends Other with Enter", async () => {
      const { screen, onAnswer } = show(CHOICE);
      await screen.getByText("Other").click();
      const field = screen.getByRole("textbox", { name: "Other" });
      await userEvent.type(field, "{Enter}");
      expect(onAnswer).not.toHaveBeenCalled();
      await userEvent.type(field, "Teams{Enter}");
      expect(onAnswer).toHaveBeenCalledWith({ type: "choice", selected: [INTERACTIVE_OTHER_ID], other: "Teams" });
    });

    it("can skip a media request", async () => {
      const skip = show(MEDIA);
      await skip.screen.getByRole("button", { name: "Skip" }).click();
      expect(skip.onAnswer).toHaveBeenCalledWith({ type: "media", files: [] });
      await expect.poll(answeredLabel).toBe("You skipped this");
    });

    it("shows a saved answer locked, without reporting it shown again", async () => {
      const { screen, onEvent } = show(CHOICE, { answer: { type: "choice", selected: ["email"] } });
      await expect.poll(answeredLabel).toBe("You chose Email");
      await expect.element(screen.getByRole("radio", { name: /Email/ })).toBeChecked();
      expect(screen.container.querySelector(".chai-interactive__actions")).toBeNull();
      expect(onEvent).not.toHaveBeenCalled();
      expect(await wcagViolations()).toEqual([]);
    });
  });
}
