import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ActionFeedbackProvider } from "./context/ActionFeedbackContext";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ActionFeedbackProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ActionFeedbackProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
