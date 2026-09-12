import React from "react";
import ReactDOM from "react-dom/client";
import { ResultsApp } from "./ResultsApp";

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ResultsApp />
    </React.StrictMode>
  );
}
