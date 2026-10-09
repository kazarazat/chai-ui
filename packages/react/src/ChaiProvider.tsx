import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createReasoning, reasoningEngineFor, type Reasoning, type ReasoningConfig } from "@chai-ui/core";

export {
  DEFAULT_REASONING_MODEL,
  DEFAULT_REASONING_MODEL_BY_KIND,
  reasoningModelFor,
  type Reasoning,
} from "@chai-ui/core";

const ReasoningContext = createContext<Reasoning | undefined>(undefined);

export interface ChaiProviderProps extends ReasoningConfig {
  children?: ReactNode;
}

export function ChaiProvider({ reasoningModel, reasoningModelByKind, reasoningEngine, children }: ChaiProviderProps) {
  const engine = useMemo(() => reasoningEngineFor({ reasoningEngine }), [reasoningEngine]);
  const { video, audio, image, text } = reasoningModelByKind ?? {};
  const value = useMemo(
    () => createReasoning({ reasoningModel, reasoningModelByKind: { video, audio, image, text } }, engine),
    [engine, reasoningModel, video, audio, image, text]
  );
  return <ReasoningContext.Provider value={value}>{children}</ReasoningContext.Provider>;
}

/** The nearest `ChaiProvider`'s reasoning engine and models, or `undefined` outside one. */
export function useReasoning(): Reasoning | undefined {
  return useContext(ReasoningContext);
}
