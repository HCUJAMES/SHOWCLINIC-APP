const API_BASE =
  process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000`;

const UPLOADS_BASE = `${API_BASE}/uploads`;
const DOCS_BASE = `${UPLOADS_BASE}/docs`;

export { API_BASE, UPLOADS_BASE, DOCS_BASE };
export default API_BASE;
