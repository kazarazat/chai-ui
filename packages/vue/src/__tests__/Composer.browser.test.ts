import Composer from "../Composer.vue";
import { composerContract, type ComposerProps } from "../../../react/src/__tests__/contracts/composer.contract.js";
import { renderWith } from "./render.js";

/** React's `value`/`onXChange` pairs are Vue's `v-model` props and `update:x` events. */
const V_MODEL: Record<string, string> = {
  onChange: "onUpdate:modelValue",
  onAttachmentsChange: "onUpdate:attachments",
  onUseCasesChange: "onUpdate:useCases",
  onModelIdsChange: "onUpdate:modelIds",
  onModelChange: "onUpdate:modelId",
  onAutoSelectModelChange: "onUpdate:autoSelectModel",
  onAspectRatioChange: "onUpdate:aspectRatio",
  onRegionsChange: "onUpdate:regions",
};

composerContract(
  renderWith(Composer, ({ value, ...props }: ComposerProps) => ({
    modelValue: value,
    ...Object.fromEntries(Object.entries(props).map(([key, v]) => [V_MODEL[key] ?? key, v])),
  }))
);
