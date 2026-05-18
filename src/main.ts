import "./style.css";

// Epic 1 placeholder shell. The hash router + game registry + SW
// registration replace this body in later epics; the bootstrap entry
// point itself stays here.
const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  app.innerHTML = `
    <main class="starter">
      <h1>PWA Games</h1>
      <p>Skeleton up. Games land in later epics.</p>
    </main>
  `;
}
