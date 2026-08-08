import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";

// Distinct storage key from the affiliate dashboard — the two logins must
// never bleed into each other.
setAuthTokenGetter(() => localStorage.getItem("client_token"));

createRoot(document.getElementById("root")!).render(<App />);
