// src/utils/actionLock.js
//
// Global protection against double clicks on buttons that write data.
// The admin site has a few hundred plain <button> elements; instead of adding isSubmitting state to each one,
// every write request made through apiClient.request() locks the control that triggered it:
//   * the button gets data-submitting, which index.css shows as a disabled button with a spinner;
//   * further clicks on that button, and further submits of its form, are swallowed in the capture phase,
//     before React sees them (other controls of the form, e.g. "Hủy", keep working);
//   * the lock is released as soon as the server answers (success or error).
// Buttons are never given the `disabled` property here, so React stays the only owner of that attribute.

const TRIGGER_WINDOW_MS = 2000; // a write that starts this long after a click is attributed to that click
const BUTTON_BUSY = "data-submitting";
const FORM_BUSY = "data-form-submitting";

let lastTrigger = null; // { button, form, at }
const lockCounts = new WeakMap();

if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest("button, [role='button'], input[type='submit']");
      if (!button) return;
      if (button.hasAttribute(BUTTON_BUSY) ||
          (button.type === "submit" && button.form?.hasAttribute(FORM_BUSY))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      lastTrigger = { button, form: button.type === "submit" ? button.form : null, at: performance.now() };
    },
    true
  );

  // Pressing Enter in a field submits the form without clicking a button.
  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form) return;
      if (form.hasAttribute(FORM_BUSY)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      lastTrigger = { button: event.submitter || null, form, at: performance.now() };
    },
    true
  );
}

function acquire(element, attribute) {
  if (!element) return;
  lockCounts.set(element, (lockCounts.get(element) || 0) + 1);
  element.setAttribute(attribute, "true");
  element.setAttribute("aria-busy", "true");
}

function release(element, attribute) {
  if (!element) return;
  const remaining = (lockCounts.get(element) || 1) - 1;
  lockCounts.set(element, remaining);
  if (remaining > 0) return;
  element.removeAttribute(attribute);
  element.removeAttribute("aria-busy");
}

/**
 * Locks the button/form the user just activated. Returns a release function (safe to call more than once).
 * Nothing is locked when the write was not started by a recent click (e.g. a timer or realtime event).
 */
export function lockTriggeringControl() {
  const trigger = lastTrigger;
  if (!trigger || performance.now() - trigger.at > TRIGGER_WINDOW_MS) return () => {};
  const button = trigger.button?.isConnected ? trigger.button : null;
  const form = trigger.form?.isConnected ? trigger.form : null;
  if (!button && !form) return () => {};
  acquire(button, BUTTON_BUSY);
  acquire(form, FORM_BUSY);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    release(button, BUTTON_BUSY);
    release(form, FORM_BUSY);
  };
}
