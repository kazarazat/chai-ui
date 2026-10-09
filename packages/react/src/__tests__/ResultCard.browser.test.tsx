import { render } from "vitest-browser-react";
import { ResultCard } from "../ResultCard.js";
import { resultCardContract, type ResultCardProps } from "./contracts/result-card.contract.js";

resultCardContract((props: ResultCardProps) => {
  const screen = render(<ResultCard {...props} />);
  return { ...screen, rerender: (next: ResultCardProps) => screen.rerender(<ResultCard {...next} />) };
});
