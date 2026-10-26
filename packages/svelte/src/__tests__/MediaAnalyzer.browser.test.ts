import MediaAnalyzer from "../MediaAnalyzer.svelte";
import { mediaAnalyzerContract } from "../../../react/src/__tests__/contracts/media-analyzer.contract.js";
import { renderWith } from "./render.js";

mediaAnalyzerContract(renderWith(MediaAnalyzer));
