import './style.css';
import { ExplorerApp } from './ui/ExplorerApp';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app mount element.');

let app: ExplorerApp | null = null;

try {
  app = new ExplorerApp(root);
} catch (error) {
  console.error('Curvature Lab could not start.', error);
  root.innerHTML = `
    <main class="startup-error" role="alert">
      <h1>Curvature Lab could not start</h1>
      <p>This browser may not support WebGL.</p>
    </main>`;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => app?.dispose());
}
