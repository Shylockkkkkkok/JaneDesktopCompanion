import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import SettingsWindow from "./SettingsWindow";
import GoalsWindow from "./components/GoalsWindow";
import ConcertWindow from "./components/ConcertWindow";
import TimelineWindow from "./components/TimelineWindow";
import BubbleWindow from "./BubbleWindow";
import "./styles.css";

function componentFor(label: string) {
  if (label === "settings") return SettingsWindow;
  if (label === "goals") return GoalsWindow;
  if (label === "concert") return ConcertWindow;
  if (label === "timeline") return TimelineWindow;
  if (label === "bubble") return BubbleWindow;
  return App;
}

const Component = componentFor(getCurrentWindow().label);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>,
);
