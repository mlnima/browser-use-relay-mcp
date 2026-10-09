import { hydrateRoot } from 'react-dom/client';
import { App } from './app.jsx';
import { getRoute } from './settings.mjs';
import { preloadPage } from './pages.mjs';
import './styles/shell.css';
import './styles/scenarios.css';
import './styles/pages.css';

const initial = JSON.parse(document.getElementById('initial-state').textContent);
await preloadPage(getRoute(initial.pathname).id);
hydrateRoot(document.getElementById('app'), <App initial={initial} />);
