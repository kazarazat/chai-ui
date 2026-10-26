import MediaAnalyzer from "../MediaAnalyzer.svelte";
import { mediaAnalyzerContract } from "../../../shared/contracts/media-analyzer.contract.js";
import { renderWith } from "./render.js";

mediaAnalyzerContract(renderWith(MediaAnalyzer));
