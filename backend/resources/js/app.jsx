import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';

createInertiaApp({
    title: (title) => `${title} - Hostel Attendance`,
    resolve: (name) => {
        // Look in both root src/dashboards and local resources/js/Pages
        const pages = import.meta.glob(['../../src/dashboards/**/*.tsx', './Pages/**/*.tsx'], { eager: true });
        for (const path in pages) {
            if (path.endsWith(`/${name}.tsx`) || path.endsWith(`/${name}.jsx`)) {
                return pages[path];
            }
        }
        throw new Error(`Inertia page component not found: ${name}`);
    },
    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(<App {...props} />);
    },
    progress: {
        color: '#4f46e5',
        showSpinner: true,
    },
});
