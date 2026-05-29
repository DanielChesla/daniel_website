// Vercel Web Analytics initialization
// This script injects Vercel Web Analytics for vanilla HTML/JavaScript projects
import { inject } from 'https://cdn.jsdelivr.net/npm/@vercel/analytics@2.0.1/+esm';

inject({
  mode: 'auto',
  debug: false
});
