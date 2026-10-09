import MediaAnalyzer from "../MediaAnalyzer.vue";
import { mediaAnalyzerContract, type MediaAnalyzerProps } from "../../../react/src/__tests__/contracts/media-analyzer.contract.js";
import { renderWith } from "./render.js";

mediaAnalyzerContract(
  renderWith(
    MediaAnalyzer,
    ({ onAttachmentsChange, onModelChange, onAutoSelectModelChange, onPromptLengthChange, ...props }: MediaAnalyzerProps) => ({
      ...props,
      "onUpdate:attachments": onAttachmentsChange,
      "onUpdate:modelId": onModelChange,
      "onUpdate:autoSelectModel": onAutoSelectModelChange,
      "onUpdate:promptLength": onPromptLengthChange,
    })
  )
);
