import "./style.css";
import { startRouter } from "./router.ts";
import { renderMenu } from "./ui/menu.ts";

// Bootstrap: hash router drives the single `#app` container. Registry +
// SW registration plug in via later epics; the contract is already here.
const app = document.querySelector<HTMLElement>("#app");
if (app) {
  startRouter({ app, renderMenu });
}
