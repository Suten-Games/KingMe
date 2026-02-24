// src/utils/swapEvents.ts
// Lightweight event bus so components can react to swap completions
// without prop-drilling or rebuilding global state.

type SwapCompletedPayload = {
  mint: string;       // the token that was sold
  symbol: string;
  tokenAmount: number;  // how many tokens were sold
  usdReceived: number;  // approximate USD received
  signature: string;
};

type Listener = (payload: SwapCompletedPayload) => void;

const listeners = new Set<Listener>();

export const SwapEvents = {
  on(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn); // returns unsubscribe
  },
  emit(payload: SwapCompletedPayload) {
    listeners.forEach(fn => fn(payload));
  },
};

export type { SwapCompletedPayload };
