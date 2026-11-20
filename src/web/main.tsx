import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { Shell } from "./Shell.js";
import { Overview } from "./pages/Overview.js";
import { Delivery } from "./pages/Delivery.js";
import { Loop } from "./pages/Loop.js";
import { darkTheme } from "../theme/index.js";

const root = document.getElementById("root");
if (root === null) throw new Error("no #root to mount on");
createRoot(root).render(
  <StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Overview />} />
            <Route path="/delivery" element={<Delivery />} />
            <Route path="/loop" element={<Loop />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
