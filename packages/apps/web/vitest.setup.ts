import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Without vitest globals, RTL can't register its own afterEach — do it here.
afterEach(cleanup);
