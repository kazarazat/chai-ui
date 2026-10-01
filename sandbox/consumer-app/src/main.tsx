import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@chai-ui/tokens/css";
import "@chai-ui/react/style.css";
import { App } from "./App.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
