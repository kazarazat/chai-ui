import { useState } from "react";
import { Composer, ResultCard, useComposer, type ComposerAttachment } from "@chai-ui/react";

/**
 * Not a demo of CHAI's design — a packaging smoke test. If this renders a
 * working Composer whose submit produces a ResultCard, the tarballs this
 * app installed (built by ../../scripts/pack-test.sh, not linked via the
 * pnpm workspace) have correct `exports`/`files`/`peerDependencies` and
 * actually work as a real external consumer would experience them. Mirrors
 * the docs site's `useComposer` example on purpose, minus the real engines, so this stays offline (`useComposer` falls back
 * to `mockEngine`).
 */
export function App() {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const { run, submit } = useComposer();

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: "1.1rem" }}>CHAI UI packaging smoke test</h1>
      <p style={{ color: "#666", fontSize: "0.85rem" }}>
        Rendered from real installed tarballs, not the pnpm workspace.
      </p>
      <Composer
        value={value}
        onChange={setValue}
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        useCase={{ kind: "image", label: "Image" }}
        models={[{ id: "mock-model", label: "Mock model", provider: "mock", speed: "fast" }]}
        modelId="mock-model"
        onSubmit={submit}
      />
      {run && <ResultCard results={run.results} prompt={run.request.prompt} onAction={() => {}} />}
    </main>
  );
}
