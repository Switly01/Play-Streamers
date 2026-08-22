import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installTauriBridge } from "./tauriBridge";
import "./styles.css";

void installTauriBridge().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
