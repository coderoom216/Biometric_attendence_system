import React from 'react';
import AppLayout from '../Layouts/AppLayout';
import { StudentsPage } from '../pages/StudentsPage';

export default function Students({ initialTab = 'directory' }: { initialTab?: 'directory' | 'verification' }) {
    return <AppLayout><StudentsPage initialTab={initialTab} /></AppLayout>;
}
