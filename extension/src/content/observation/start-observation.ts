import { startElementObservers, stopElementObservers } from "./element-observers.js";
import {
  refreshMutationObservation,
  startMutationObservation,
  stopMutationObservation,
} from "./mutation-observer.js";
import {
  markRevision,
  subscribeRevision,
  type ObservationChange,
} from "./revision.js";

let observerUsers = 0;
let refreshTimer: number | undefined;
let currentUrl = "";

const detectNavigation = (): void => {
  if (currentUrl === location.href) return;
  currentUrl = location.href;
  markRevision("navigation");
};

const refreshObservation = (): void => {
  detectNavigation();
  refreshMutationObservation();
};

const startGlobalObservation = (): void => {
  currentUrl = location.href;
  startElementObservers();
  startMutationObservation();
  window.addEventListener("popstate", detectNavigation);
  window.addEventListener("hashchange", detectNavigation);
  window.addEventListener("scroll", markScroll, { capture: true, passive: true });
  window.addEventListener("resize", markViewport, { passive: true });
  document.addEventListener("input", markInput, true);
  document.addEventListener("change", markInput, true);
  document.addEventListener("focusin", markFocus, true);
  document.addEventListener("focusout", markFocus, true);
  document.addEventListener("visibilitychange", markVisibility);
  refreshTimer = window.setInterval(refreshObservation, 1_000);
};

const markScroll = (): void => { markRevision("scroll"); };
const markViewport = (): void => { markRevision("viewport"); };
const markVisibility = (): void => { markRevision("visibility"); };
const markInput = (): void => { markRevision("input"); };
const markFocus = (): void => { markRevision("focus"); };

const stopGlobalObservation = (): void => {
  stopMutationObservation();
  stopElementObservers();
  window.removeEventListener("popstate", detectNavigation);
  window.removeEventListener("hashchange", detectNavigation);
  window.removeEventListener("scroll", markScroll, true);
  window.removeEventListener("resize", markViewport);
  document.removeEventListener("input", markInput, true);
  document.removeEventListener("change", markInput, true);
  document.removeEventListener("focusin", markFocus, true);
  document.removeEventListener("focusout", markFocus, true);
  document.removeEventListener("visibilitychange", markVisibility);
  refreshTimer !== undefined && window.clearInterval(refreshTimer);
  refreshTimer = undefined;
};

export const startObservation = (onChange: (change: ObservationChange) => void): (() => void) => {
  const unsubscribe = subscribeRevision(onChange);
  observerUsers += 1;
  observerUsers === 1 && startGlobalObservation();
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    unsubscribe();
    observerUsers -= 1;
    observerUsers === 0 && stopGlobalObservation();
  };
};
