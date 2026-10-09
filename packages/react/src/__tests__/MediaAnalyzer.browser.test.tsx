import { render } from "vitest-browser-react";
import { MediaAnalyzer } from "../MediaAnalyzer.js";
import { mediaAnalyzerContract, type MediaAnalyzerProps } from "./contracts/media-analyzer.contract.js";

mediaAnalyzerContract((props: MediaAnalyzerProps) => {
  const screen = render(<MediaAnalyzer {...props} />);
  return { ...screen, rerender: (next: MediaAnalyzerProps) => screen.rerender(<MediaAnalyzer {...next} />) };
});
